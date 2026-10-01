---
description: Critique a draft against its format file and voice.md.
argument-hint: <draft path>
---

Draft: $ARGUMENTS (if empty, use the most recent file in `drafts/`).

1. Read the draft, its `formats/<format>.md`, `voice.md`, and `CLAUDE.md`.
   If `voice.md` is empty, say the voice check is skipped and why.
2. Check, in this order:
   - **Opening**: specific event, or generic setup/hook? Quote it.
   - **Unsupported claims**: every claim with no evidence in the draft.
   - **Voice**: lines that do not sound like the samples in `voice.md`.
   - **Writing rules**: em dashes, rhetorical openers, bait, emoji bullets,
     sentences that could be on anyone's LinkedIn.
   - **Format rules**: length, structure, ending.
   - **Confidentiality**: client names, client data, non-public engagement detail.
3. Output concrete edits as `line or quote -> replacement` (or `cut`), with a
   one-line reason each. Do not rewrite the whole piece. Do not edit the file
   unless asked.
