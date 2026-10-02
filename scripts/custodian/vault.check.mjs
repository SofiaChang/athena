// Self-check for the vault tools. Run: node scripts/custodian/vault.check.mjs
// Uses a throwaway vault; never touches the real one.

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "custodian-check-"));
process.env.OBSIDIAN_VAULT = tmp;
const vault = await import("./vault.mjs");

// Confinement: no escaping the vault, no non-markdown files.
assert.throws(() => vault.resolveNote("../outside.md"), /escapes/);
assert.throws(() => vault.resolveNote("/etc/passwd.md"), /escapes/);
assert.throws(() => vault.resolveNote("notes/script.sh"), /Only .md/);

// Create never overwrites.
await vault.createNote({ path: "daily/2026-10-02.md", content: "# Day\n\n## Notes\n\n- a\n\n## Follow-ups\n\n- [ ] x\n" });
await assert.rejects(vault.createNote({ path: "daily/2026-10-02.md", content: "" }), /already exists/);

// Append lands at the end of the named section, not the file.
await vault.appendToNote({ path: "daily/2026-10-02.md", text: "- b", heading: "Notes" });
await vault.appendToNote({ path: "daily/2026-10-02.md", text: "- [ ] y", heading: "## Follow-ups" });
assert.equal(
  await vault.readNote({ path: "daily/2026-10-02.md" }),
  "# Day\n\n## Notes\n\n- a\n- b\n\n## Follow-ups\n\n- [ ] x\n- [ ] y\n",
);
await assert.rejects(vault.appendToNote({ path: "daily/2026-10-02.md", text: "z", heading: "Nope" }), /not found/);

// Edit requires a unique exact match; "$&" in replacement stays literal.
await vault.editNote({ path: "daily/2026-10-02.md", old_text: "- [ ] x", new_text: "- [x] x $&" });
assert.match(await vault.readNote({ path: "daily/2026-10-02.md" }), /- \[x\] x \$&/);
await assert.rejects(vault.editNote({ path: "daily/2026-10-02.md", old_text: "- ", new_text: "" }), /exactly once/);

assert.match(await vault.searchNotes({ query: "FOLLOW" }), /daily\/2026-10-02.md:\d+: ## Follow-ups/);
assert.deepEqual((await vault.listNotes()).map((n) => n.path), ["daily/2026-10-02.md"]);

fs.rmSync(tmp, { recursive: true, force: true });
console.log("vault.check: ok");
