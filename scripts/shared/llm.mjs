// Shared LLM provider layer for Athena apps.
// Providers: Anthropic API, OpenAI API, or the Codex CLI (ChatGPT
// subscription, no API billing). Plain fetch / child process; zero deps.

import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_DEFAULT_MODEL = "claude-sonnet-4-5";
const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const OPENAI_DEFAULT_MODEL = "gpt-4o";

const CODEX_DEFAULT_BIN = "/opt/homebrew/lib/node_modules/@openai/codex/bin/codex.js";
const CODEX_DEFAULT_MODEL = "gpt-5.5";
const CODEX_TIMEOUT_MS = 300_000;

function codexBin() {
  const configured = process.env.QT_CODEX_BIN?.trim();
  if (configured) {
    return configured;
  }
  if (fs.existsSync(CODEX_DEFAULT_BIN)) {
    return CODEX_DEFAULT_BIN;
  }
  return "codex";
}

function resolveProvider() {
  const explicit = process.env.QT_LLM_PROVIDER?.trim().toLowerCase();
  if (explicit) {
    return explicit;
  }
  if (process.env.ANTHROPIC_API_KEY?.trim()) {
    return "anthropic";
  }
  if (process.env.OPENAI_API_KEY?.trim()) {
    return "openai";
  }
  // ChatGPT-subscription path: Codex CLI signed in via `codex login`.
  if (fs.existsSync(path.join(os.homedir(), ".codex", "auth.json"))) {
    return "codex";
  }
  return null;
}

function requireKey(provider) {
  const envName = provider === "anthropic" ? "ANTHROPIC_API_KEY" : "OPENAI_API_KEY";
  const key = process.env[envName]?.trim();
  if (!key) {
    throw new Error(`Missing required env var: ${envName}`);
  }
  return key;
}

async function anthropicChat(systemPrompt, userPrompt) {
  const key = requireKey("anthropic");
  const model = process.env.QT_LLM_MODEL?.trim() || ANTHROPIC_DEFAULT_MODEL;
  const response = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });
  const payload = await response.json();
  if (!response.ok) {
    const detail = payload?.error?.message || JSON.stringify(payload).slice(0, 300);
    throw new Error(`Anthropic request failed: HTTP ${response.status} — ${detail}`);
  }
  const text = (payload.content || [])
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("");
  if (!text) {
    throw new Error("Anthropic returned no text content.");
  }
  return text;
}

async function openaiChat(systemPrompt, userPrompt) {
  const key = requireKey("openai");
  const model = process.env.QT_LLM_MODEL?.trim() || OPENAI_DEFAULT_MODEL;
  const response = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });
  const payload = await response.json();
  if (!response.ok) {
    const detail = payload?.error?.message || JSON.stringify(payload).slice(0, 300);
    throw new Error(`OpenAI request failed: HTTP ${response.status} — ${detail}`);
  }
  const text = payload.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error("OpenAI returned no message content.");
  }
  return text;
}

function codexChat(systemPrompt, userPrompt) {
  // ChatGPT-subscription provider: drives the Codex CLI (OAuth login, no API
  // key billing). Runs read-only in a temp workspace; the last agent message
  // is the response.
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "qt-codex-"));
  const outputFile = path.join(workDir, "last-message.txt");
  const args = [
    "exec",
    "-s", "read-only",
    "--skip-git-repo-check",
    "-C", workDir,
    "-o", outputFile,
  ];
  // Always pass -m: ~/.codex/config.toml may name a model the ChatGPT-account
  // endpoint rejects; QT_LLM_MODEL overrides our default.
  args.push("-m", process.env.QT_LLM_MODEL?.trim() || CODEX_DEFAULT_MODEL);
  args.push(`${systemPrompt}\n\n---\n\n${userPrompt}`);

  return new Promise((resolve, reject) => {
    const child = spawn(codexBin(), args, {
      stdio: ["ignore", "pipe", "pipe"],
    });
    // Drain stdout: an undrained pipe fills its OS buffer and the child
    // blocks forever, surfacing as a spurious timeout.
    child.stdout.resume();
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`Codex CLI timed out after ${CODEX_TIMEOUT_MS / 1000}s.`));
    }, CODEX_TIMEOUT_MS);
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(new Error(`Codex CLI failed to start: ${error.message}`));
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      let text = "";
      try {
        text = fs.readFileSync(outputFile, "utf8").trim();
      } catch {
        // Fall through to the error below.
      }
      fs.rmSync(workDir, { recursive: true, force: true });
      if (code === 0 && text) {
        resolve(text);
        return;
      }
      const detail = stderr.trim().split("\n").slice(-3).join(" ").slice(0, 400);
      reject(
        new Error(
          `Codex CLI failed (exit ${code}): ${detail || "no output"}. ` +
            "If your login expired, run `codex login`.",
        ),
      );
    });
  });
}

async function llmChat(systemPrompt, userPrompt) {
  const provider = resolveProvider();
  if (!provider) {
    throw new Error(
      "No LLM configured. Set ANTHROPIC_API_KEY or OPENAI_API_KEY, or sign in " +
        "with the Codex CLI (`codex login`) to use your ChatGPT subscription.",
    );
  }
  if (provider === "anthropic") {
    return anthropicChat(systemPrompt, userPrompt);
  }
  if (provider === "openai") {
    return openaiChat(systemPrompt, userPrompt);
  }
  if (provider === "codex") {
    return codexChat(systemPrompt, userPrompt);
  }
  throw new Error(`Unknown QT_LLM_PROVIDER: ${provider}`);
}

function extractJson(text) {
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenceMatch ? fenceMatch[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("LLM response did not contain a JSON object.");
  }
  return JSON.parse(candidate.slice(start, end + 1));
}

export { llmChat, resolveProvider, extractJson };
