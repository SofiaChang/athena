---
description: Write a draft from an idea in a given format.
argument-hint: <idea file or description> <format>
---

Input: $ARGUMENTS

1. Parse the idea and the format name (`linkedin` or `youtube`). If either is
   missing, or `formats/<format>.md` does not exist, ask.
2. Read `CLAUDE.md`, `formats/<format>.md`, and `voice.md`.
3. If `voice.md` has no samples, say so and ask for them. Do not draft.
4. If the idea has no concrete event or observation behind it, ask for the
   specific detail. Do not fill the gap with generic material.
5. If the format file says it is not active, follow what it says instead.
6. Write the draft following the format rules and the writing rules in
   `CLAUDE.md`. Use the format's file header.
7. Save to `drafts/<format>/YYYY-MM-DD-<slug>.md`. If the idea is new, also
   save it to `ideas/<slug>.md` (a few lines: the detail, the angle, audience).
8. Report the path, word count (or target runtime), and any claim that needs a
   fact check or a confidentiality check.
