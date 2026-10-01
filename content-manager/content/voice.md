# Voice

> EMPTY. Paste 3 to 5 pieces of your own writing below: past posts, Slack
> messages, emails, anything written fast and unedited. Unpolished is better.
> Until this is filled, commands will stop and ask for samples.

## Samples

<!-- Paste each sample under its own heading, with where it came from. -->

- linkeding post:
I connected an ElevenLabs agent to Palantir Foundry and gave it a phone number.

You call it, key in a PIN, and ask about your tickets. If you describe a new problem, it first checks whether someone has already fixed it, and only if nothing matches does it read the title, description, and priority back to you and open the ticket through a Foundry Action. The whole call takes about a minute.

The interesting part was the seam between the two products. ElevenLabs handles the conversation, while a small service in the middle holds the only Foundry credential and turns each tool call into either a read or a single governed write, so every ticket lands with its permissions checked, its parameters validated, and a record of who created it and when.

ElevenLabs makes the call feel natural. Foundry makes the result something you can trust. The work is the bridge between them.

What's the first thing you'd put behind a phone line in your ontology?


- linkedin post:
I spent the weekend building a Medical AI app in Palantir Foundry.

Patient encounters, patients, and treatment plans are all ontology objects. When a clinician opens an encounter, an AI agent drafts a treatment plan with diagnosis, ICD-10 code, medications, and clinical rationale. They can ask follow-ups in chat, request modifications, or approve it, which writes the plan back to the patient's record.

The interesting part wasn't getting the agent to generate plans. That was the easy 20%. The hard part was the review surface.

A draft a clinician can't verify quickly is worse than no draft. So most of the design work went into making the agent's reasoning legible, making modifications a single message instead of a form, and making approval feel like a deliberate action instead of a rubber stamp. For example, the status transitions had to reflect real clinical accountability (Pending Review, Active, Completed).

When it comes to working with agents in high-stakes workflows, that's the pattern I keep coming back to. The model is rarely the bottleneck. The interface between the agent's output and the human's judgment is where the product lives.


- networking email:
Hi Tony,

It's great to meet you, and thank you for making the time to chat. Harry has spoken highly of you, and having read about Tribridge, I'd love to hear about how you approached growing and positioning the firm over the years.

Would you have 30 minutes over the next couple of weeks? I'm happy to work around your schedule.

Harry, thank you for the introduction! Moving you to bcc.

Best,
Sofia


- recruiting email:
Hi Maria,

After some consideration I don't think I can continue with the interview process right now.

I'm committed to a client delivery that runs through the end of the year and I'd like to see it through. Leaving partway would mean too much disruption for the team. Rather than take up your time on a timeline I can't meet, I'd rather be upfront about it.

I'm still very interested in ElevenLabs and the Deployment Strategist role, and I'd love to stay in touch for when my time changes. Thanks for reaching out, and I hope we can continue the conversation next year.

Best,
Sofia

## Notes

<!-- Patterns worth keeping or avoiding, added as they come up in /review. -->
- I like varying sentence structure as needed.
- I don't like using varying punctuation unless absolutely necessary, so minimal dashes, semi-colons, and colons.
