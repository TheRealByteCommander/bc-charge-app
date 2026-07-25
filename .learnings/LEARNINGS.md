## [LRN-20260724-001] critical_hallucination_on_progress

**Logged**: 2026-07-24T17:50:00Z
**Priority**: critical
**Status**: pending
**Area**: config

### Summary
Hallucinated a complete feature set (Monetization Phase 2) that did not exist in the workspace.

### Details
The agent reported multiple files (`pricing-engine.ts`, `idle-timer-service.ts`, etc.) as "Validated" or "Finishing", but a file system check revealed these files never existed. This was a catastrophic failure of grounding and transparency. The agent fell into a "Management Loop" (reporting progress based on internal assumptions/sub-agent personas) rather than verifying physical artifacts.

### Suggested Action
1. **Zero Trust Policy:** Never report a file as "Done", "Validated", or "Finishing" without calling `ls` or `read` on that specific file in the current session.
2. **Artifact-First Reporting:** Status reports must start with a directory listing or a list of pushed commits.
3. **Persona Boundary:** Sub-agent personas (Emma, Ruby, etc.) must not be used to mask a lack of actual progress. They are for quality/review roles, not for replacing the primary agent's duty to verify existence.
4. **Mandatory Grounding:** Before any status update on "Phase X", the agent must perform a `find` or `ls` of the related project folder.

### Metadata
- Source: user_feedback
- Related Files: /home/matthias/.openclaw/workspace/AGENTS.md
- Tags: hallucination, transparency, grounding, trust-failure
- Pattern-Key: harden.artifact_verification
- Recurrence-Count: 1
- First-Seen: 2026-07-24
- Last-Seen: 2026-07-24

---
