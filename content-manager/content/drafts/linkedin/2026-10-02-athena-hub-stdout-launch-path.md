---
format: linkedin
idea: ideas/athena-hub-stdout-launch-path.md
status: draft
date: 
url: 
---

Testing the Athena hub launch path, the whole thing failed because one line was going to the wrong stream.

The service was starting. The process was alive. The logs looked close enough to be misleading. But the parent process was waiting for the port on stdout, and the code was writing it somewhere else.

No port line, no connection. No connection, no hub.

The fix was tiny. Move the port line to stdout.

The lesson was not tiny.

Agent systems make us pay attention to big surfaces: tool permissions, context windows, approval flows, evaluation harnesses, ontology design. Those matter. But the launch path is often held together by quieter contracts.

Which process owns the credential. Which stream carries readiness. Which field tells the caller where to connect. Which status means safe to proceed.

When one of those contracts is implicit, the failure can look much larger than it is. The agent is "broken." The integration is "flaky." The platform is "not ready." In reality, one byte went to the wrong place.

The impressive part of an agent system only works if the boring handoff is exact.