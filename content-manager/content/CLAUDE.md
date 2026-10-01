# Content system

Sofia's content workflow. LinkedIn is active (2 posts a week). YouTube is planned.

## Who this is for

Sofia: Forward Deployed Engineer at Accenture (Palantir Foundry, AI agents),
co-founder and CTO of Raava (technical consulting), building Meridian (a TMS
for freight forwarders).

Audience: engineers working with Foundry and agents, and enterprise buyers
evaluating AI systems. Not a general tech audience.

Goal: credibility that feeds Raava's pipeline and recruiting.

## Flow

1. `inbox.md`: raw ideas, one line each.
2. `ideas/`: developed angles, one file each (`ideas/<slug>.md`).
3. `drafts/<format>/`: drafts in progress.
4. `published/<format>/`: final text as posted, with date and link.

Name files `YYYY-MM-DD-<slug>.md`. Format rules live in `formats/<format>.md`.

## Operating rules (all formats)

- Every piece comes from something Sofia actually did or observed. No generic
  advice, no listicles, no thought leadership with nothing under it.
- If the inbox has no raw material, say so. Do not invent a topic.
- Never include client names, client data, or anything from an engagement that
  is not already public. When unsure, flag it and ask.
- Match `voice.md`. If it is empty, say so and ask for samples. Do not guess.
- One idea can become a post and a script. Check `ideas/` and `published/`
  before treating something as new.

## Writing rules

- No em dashes.
- No rhetorical questions as openers.
- No "here's the thing".
- No engagement bait ("Agree?", "Thoughts?", "Comment below").
- No emoji bullets.
- Short sentences. Specifics over claims.
- If a sentence could appear on anyone's LinkedIn, cut it.

## Commands

- `/ideate`: propose 5 angles from the inbox. Writes nothing.
- `/draft <idea> <format>`: write a draft to `drafts/<format>/`.
- `/review <draft>`: critique against format and voice. Edits, not a rewrite.
- `/repurpose <published piece> <format>`: adapt to another medium.
