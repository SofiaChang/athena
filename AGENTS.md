# AGENTS.md

This file guides coding agents in this repository.

## Scope and current repo shape

- Repo is a lightweight project scaffold, not a full app package.
- There is no `package.json` in this repository.
- Main code artifacts are:
  - `agent-plan.jsx` (React-style plan UI + Linear sync logic)
  - `scripts/sync-linear.mjs` (Node CLI sync script)
  - `personal-ai-agent-project-brief.md` (source plan data)
  - `docs/architecture.md` and `docs/roadmap.md` (project docs)
  - `vault/Abyss/` (Obsidian vault content)

## Tooling reality (important)

- No configured build system detected.
- No configured lint runner detected.
- No configured test runner detected.
- No TypeScript project config (`tsconfig`) detected.
- No ESLint/Prettier/Biome config detected.

Treat this repo as script-first and document-first.

## Build / lint / test command matrix

Because no package-level toolchain is configured, use the practical checks below.

### Build

- `N/A` (no build script or build config present).

### Lint

- `N/A` (no lint script/config present).

### Typecheck

- `N/A` (JS/JSX only in current repo; no TypeScript compiler config).

### Test

- `N/A` (no Jest/Vitest/Mocha test suite present).

### Script validation checks

- Syntax check the CLI script:

```bash
node --check scripts/sync-linear.mjs
```

- Dry-run sync execution (requires valid Linear credentials even in dry run):

```bash
LINEAR_API_KEY="<token>" LINEAR_TEAM_KEY="<team>" LINEAR_DRY_RUN=true node scripts/sync-linear.mjs
```

- Full sync execution:

```bash
LINEAR_API_KEY="<token>" LINEAR_TEAM_KEY="<team>" node scripts/sync-linear.mjs
```

### Running a single test

There is no test framework here. For a single-file validation, use:

```bash
node --check scripts/sync-linear.mjs
```

If you need a behavioral one-off check, run one dry-run sync invocation as the single test.

## Environment variables used by CLI

Required:

- `LINEAR_API_KEY`
- `LINEAR_TEAM_KEY`

Optional:

- `LINEAR_PROJECT_NAME`
- `LINEAR_PROJECT_ID`
- `LINEAR_DRY_RUN`
- `ATHENA_BRIEF_PATH`
- `LINEAR_SYNC_MAP_PATH`

## Code style conventions (evidence-based from repo)

### Imports and modules

- Use ESM import syntax in scripts (`import ... from "..."`).
- Use double quotes for import specifiers.
- Keep imports grouped at the top of file.
- Prefer Node builtin `node:` specifiers in scripts.

### Formatting

- Use semicolons consistently.
- Use 2-space indentation.
- Keep line lengths readable; wrap long conditions over multiple lines.
- Use template literals for composed strings and error messages.

### Naming conventions

- Constants: `UPPER_SNAKE_CASE` for stable config values.
- Variables/functions: `camelCase`.
- React component names: `PascalCase`.
- Prefer descriptive names over abbreviations.
- Use explicit domain names (`workspaceMap`, `projectIdOverride`, `linearRequest`).

### Data and state patterns

- Prefer `const` by default; use `let` only when reassignment is required.
- Use plain JSON-like objects for mapping structures.
- Persist external sync state in dedicated map objects (`projectsByTeam`, `workspaces`).
- Keep key formats explicit and deterministic.

### React/JSX patterns (`agent-plan.jsx`)

- Functional component style with hooks.
- Use `useCallback` for handlers that are passed around/reused.
- Keep UI state local with `useState`.
- Use inline style objects in current code style; maintain consistency when editing.

### Error handling

- Fail fast for required input using explicit throws (`throw new Error(...)`).
- Wrap network and IO in `try/catch` and continue safely when appropriate.
- Include actionable context in error messages (status code, sliced response body).
- For expected fallback branches, allow silent catch only when intentional and safe.

### API integration conventions (Linear)

- Use GraphQL endpoint constant (`https://api.linear.app/graphql`).
- Send JSON body with `{ query, variables }`.
- Handle auth header variations (Bearer vs raw token fallback).
- Validate team lookup before creating/updating project artifacts.
- Make sync idempotent via persistent mapping files/state.

### File/content conventions

- Keep markdown docs concise and operational.
- Use ASCII unless file already requires special characters.
- Do not commit secrets; use env vars for credentials.
- Keep generated runtime state in dedicated files (`.linear-sync-map.json`).

## Cursor / Copilot rules status

Checked and not found in this repo:

- `.cursorrules`
- `.cursor/rules/`
- `.github/copilot-instructions.md`

If these files are added later, treat them as higher-priority behavioral constraints and update this document.

## Agent workflow guidance for this repo

1. Read `README.md` and `docs/` before editing behavior.
2. If changing Linear sync logic, update both:
   - `agent-plan.jsx`
   - `scripts/sync-linear.mjs`
3. Keep UI flow and CLI flow semantically aligned.
4. Validate CLI changes with `node --check` and one dry-run invocation.
5. If sync map shape changes, document migration implications.
6. Never log raw secrets or paste tokens into committed files.
7. Prefer additive, non-destructive edits to Obsidian vault content.
