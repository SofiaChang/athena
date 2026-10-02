// Athena hub: Tauri shell that launches registered apps into native windows.
// Registry: desktop/apps.json (single source of truth for tiles).

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::{BufRead, BufReader};
use std::net::TcpStream;
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use parking_lot::Mutex;
use tauri::Manager;
use std::sync::mpsc;
use std::time::{Duration, Instant};

#[derive(Serialize, Deserialize, Clone)]
struct AppEntry {
    id: String,
    name: String,
    description: String,
    kind: String,
    #[serde(default)]
    entry: String,
    #[serde(default)]
    env: HashMap<String, String>,
    #[serde(default, rename = "composeFile")]
    compose_file: String,
    #[serde(default)]
    url: String,
}

struct RunningApp {
    child: Child,
    url: String,
}

struct HubState {
    running: Mutex<HashMap<String, RunningApp>>,
}

// Packaged .app processes get a minimal PATH (/usr/bin:/bin:...), so resolve
// Homebrew/Docker-Desktop install locations explicitly before falling back
// to PATH lookup (dev mode).
fn resolve_bin(name: &str, candidates: &[&str]) -> String {
    for candidate in candidates {
        if std::path::Path::new(candidate).exists() {
            return (*candidate).to_string();
        }
    }
    name.to_string()
}

const NODE_CANDIDATES: &[&str] = &["/opt/homebrew/bin/node", "/usr/local/bin/node"];
const DOCKER_CANDIDATES: &[&str] = &["/usr/local/bin/docker", "/opt/homebrew/bin/docker"];

fn repo_root() -> PathBuf {
    // src-tauri -> desktop -> repo root.
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("..")
        .join("..")
}

fn registry_path() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("..").join("apps.json")
}

fn load_registry() -> Result<Vec<AppEntry>, String> {
    let data = std::fs::read_to_string(registry_path())
        .map_err(|error| format!("cannot read apps.json: {error}"))?;
    serde_json::from_str(&data).map_err(|error| format!("cannot parse apps.json: {error}"))
}

#[tauri::command]
fn list_apps() -> Result<Vec<AppEntry>, String> {
    load_registry()
}

fn find_app(id: &str) -> Result<AppEntry, String> {
    load_registry()?
        .into_iter()
        .find(|app| app.id == id)
        .ok_or_else(|| format!("no app registered with id '{id}'"))
}

fn wait_for_port(host: &str, port: u16, timeout: Duration) -> Result<(), String> {
    let deadline = Instant::now() + timeout;
    while Instant::now() < deadline {
        if TcpStream::connect((host, port)).is_ok() {
            return Ok(());
        }
        std::thread::sleep(Duration::from_millis(500));
    }
    Err(format!("{host}:{port} did not come up within {}s", timeout.as_secs()))
}

fn port_from_url(url: &str) -> Option<u16> {
    url.rsplit(':').next()?.trim_end_matches('/').parse().ok()
}

fn launch_node_server(app: &AppEntry, state: &HubState) -> Result<String, String> {
    // Hold the lock across check-and-spawn: concurrent launches for the same
    // id must not both spawn a server.
    let mut running = state.running.lock();

    // Fast path: reuse the URL if the child is alive. try_wait also reaps a
    // dead child, so a crashed server is detected here and respawned below
    // instead of returning a dead URL forever.
    if let Some(entry) = running.get_mut(&app.id) {
        match entry.child.try_wait() {
            Ok(None) => return Ok(entry.url.clone()),
            Ok(Some(_)) | Err(_) => {
                running.remove(&app.id);
            }
        }
    }

    let mut command = Command::new(resolve_bin("node", NODE_CANDIDATES));
    command
        .arg(&app.entry)
        .current_dir(repo_root())
        .envs(&app.env)
        .stdout(Stdio::piped())
        .stderr(Stdio::null());
    let mut child = command
        .spawn()
        .map_err(|error| format!("failed to start {}: {error}", app.name))?;

    // The server prints "listening on http://0.0.0.0:<port>" to STDOUT;
    // capture the real (possibly ephemeral) port from it.
    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "node server has no stdout".to_string())?;
    let (sender, receiver) = mpsc::channel();
    std::thread::spawn(move || {
        for line in BufReader::new(stdout).lines() {
            let Ok(line) = line else { break };
            if let Some(marker) = line.find("0.0.0.0:") {
                let digits: String = line[marker + 8..]
                    .chars()
                    .take_while(|c| c.is_ascii_digit())
                    .collect();
                if let Ok(port) = digits.parse::<u16>() {
                    let _ = sender.send(port);
                    break;
                }
            }
        }
    });

    let port = match receiver.recv_timeout(Duration::from_secs(60)) {
        Ok(port) => port,
        Err(_) => {
            // Dropping a Child does not kill it: reap before erroring out.
            let _ = child.kill();
            let _ = child.wait();
            return Err(format!("{} did not report a port within 60s", app.name));
        }
    };
    let url = format!("http://127.0.0.1:{port}");
    running.insert(app.id.clone(), RunningApp { child, url: url.clone() });
    Ok(url)
}

fn launch_docker_service(app: &AppEntry) -> Result<String, String> {
    let port = port_from_url(&app.url)
        .ok_or_else(|| format!("cannot parse port from {}", app.url))?;

    // Fast path: the service is already up.
    if TcpStream::connect(("127.0.0.1", port)).is_ok() {
        return Ok(app.url.clone());
    }

    let status = Command::new(resolve_bin("docker", DOCKER_CANDIDATES))
        .args(["compose", "-f", &app.compose_file, "up", "-d"])
        .current_dir(repo_root())
        .status()
        .map_err(|error| format!("failed to run docker compose: {error}"))?;
    if !status.success() {
        return Err(format!("docker compose up failed for {}", app.name));
    }
    wait_for_port("127.0.0.1", port, Duration::from_secs(90))?;
    Ok(app.url.clone())
}

// async: sync commands run on Tauri's main thread; launching can block for
// 60-90s (port wait, docker compose up) and would freeze the hub UI.
#[tauri::command(async)]
fn launch_app(
    id: String,
    app_handle: tauri::AppHandle,
    state: tauri::State<HubState>,
) -> Result<String, String> {
    let app = find_app(&id)?;
    let url = match app.kind.as_str() {
        "node-server" => launch_node_server(&app, &state)?,
        "docker-service" => launch_docker_service(&app)?,
        "external" => app.url.clone(),
        other => return Err(format!("unknown app kind '{other}'")),
    };

    // Labels are prefixed so an app id can never collide with the hub's own
    // "main" window label.
    let label = format!("app-{}", app.id);
    if let Some(window) = app_handle.get_webview_window(&label) {
        window.set_focus().map_err(|error| error.to_string())?;
    } else {
        let parsed: tauri::Url = url.parse().map_err(|_| format!("bad url {url}"))?;
        tauri::WebviewWindowBuilder::new(
            &app_handle,
            &label,
            tauri::WebviewUrl::External(parsed),
        )
        .title(&app.name)
        .inner_size(1100.0, 800.0)
        .build()
        .map_err(|error| format!("failed to open window: {error}"))?;
    }
    Ok(url)
}

fn main() {
    let state = HubState {
        running: Mutex::new(HashMap::new()),
    };
    tauri::Builder::default()
        .manage(state)
        .invoke_handler(tauri::generate_handler![list_apps, launch_app])
        .build(tauri::generate_context!())
        .expect("error while building Athena hub")
        .run(|app_handle, event| {
            if let tauri::RunEvent::Exit = event {
                // Kill child app servers so no orphans outlive the hub.
                // Known limitation: a hub panic or SIGKILL skips this handler
                // and orphans children; acceptable for a personal dev-mode hub.
                let state = app_handle.state::<HubState>();
                for (_, mut running) in state.running.lock().drain() {
                    let _ = running.child.kill();
                }
            }
        });
}
