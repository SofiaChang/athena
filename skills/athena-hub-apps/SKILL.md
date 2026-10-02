---
name: athena-hub-apps
description: Register a new app into the Athena desktop hub (desktop/ Tauri shell) so it appears as a tile beside Quantum Trader. Use whenever creating a new app/service in this repo, when the user asks to "add an app to the hub/desktop app/launcher", or when an existing project folder (e.g. keryx, content-manager) gets turned into something runnable.
---

# Adding Apps to the Athena Hub

The hub is a Tauri shell in `desktop/`. It reads ONE registry file —
`desktop/apps.json` — and renders a tile per entry. Clicking a tile launches
the app and opens it in its own native window. To add an app you add one JSON
entry; you never touch the Rust code unless you need a new launch *kind*.

## Steps

1. **Make the app runnable.** The hub launches; it does not build. The entry
   point must work today from the repo root.

2. **Pick the launch kind** (the `kind` field):

   | kind | Use for | Hub behavior |
   | --- | --- | --- |
   | `node-server` | Node HTTP servers in this repo | Spawns `node <entry>` from the repo root with `env`, parses the port from stdout, opens the window |
   | `docker-service` | Docker Compose stacks | Runs `docker compose -f <composeFile> up -d`, waits for the port, opens `url` |
   | `external` | Anything already reachable at a URL | Opens `url` directly |

3. **Add the entry** to `desktop/apps.json`:

   ```json
   {
     "id": "my-app",
     "name": "My App",
     "description": "One sentence shown on the tile.",
     "kind": "node-server",
     "entry": "scripts/my-app/server.mjs",
     "env": { "MY_APP_PORT": "0" }
   }
   ```

   Fields by kind:
   - `node-server`: `entry` (repo-root-relative path), `env` (optional).
   - `docker-service`: `composeFile` (repo-root-relative), `url` (full URL
     including port; the hub derives the health-check port from it).
   - `external`: `url`.

4. **Verify** (required, in order):
   - `node --check <entry>` for node-server apps.
   - The port contract below holds.
   - Restart the hub (or it rebuilds itself under `tauri dev`), click the
     tile, confirm the app opens in a new window.

Done when: the tile appears in the hub and clicking it opens a working app
window.

## The node-server port contract (load-bearing)

The hub learns the port by parsing the app's **stdout**. Break this and every
launch hangs 60s and fails:

- With the port env var set to `"0"`, the server MUST listen on an ephemeral
  port (`server.listen(0)`) and then print the REAL port from
  `server.address().port`.
- The line MUST go to **stdout** (the hub nulls stderr) and MUST contain
  `0.0.0.0:<port>` as contiguous text. Canonical form, copied from
  `scripts/qt/web-server.mjs`:

  ```js
  process.stdout.write(`listening on http://0.0.0.0:${server.address().port}\n`);
  ```

- Validate the port env var: integer 0-65535, empty string falls back to the
  app's default. See `resolvePort()` in `scripts/qt/web-server.mjs`.
- The server MUST stay in the foreground (the hub kills the child on exit).
- Every run log line BEFORE the port line is fine; the parser scans until it
  finds the marker.

## Rules

- `id` must be unique and kebab-case; it keys the window label (`app-<id>`)
  and the running-process map. Never use `main`.
- Two entries may not listen on the same fixed port; prefer ephemeral (`"0"`)
  for node-server apps.
- Registry edits are picked up on hub restart; no rebuild needed (the Rust
  only reads `apps.json` at runtime — but `tauri dev` hot-rebuilds anyway).
- If an app needs build steps before it can serve (React, etc.), build at
  authoring time and point `entry` at a small static/server entry — the hub
  will not wait for a bundler.
- Tile copy renders via `textContent`; markup in `name`/`description` shows
  literally, so keep it plain text.

## Packaging (Athena.app)

`npm run build` in `desktop/` produces
`desktop/src-tauri/target/release/bundle/macos/Athena.app`; copy it to
`/Applications/` to install. The packaged hub still reads the registry and
launches apps from THIS repo's working tree (paths are baked in at compile
time): moving or deleting the repo breaks the installed app, and editing
`apps.json` takes effect on next launch without rebuilding. After changing
hub code or the icon, rebuild and re-copy.

## Reference

- Registry: `desktop/apps.json`
- Launch logic (kinds, window labels, child reaping):
  `desktop/src-tauri/src/main.rs`
- Contract example (port resolution + stdout line):
  `scripts/qt/web-server.mjs`
- Hub tile UI: `desktop/ui/index.html`
