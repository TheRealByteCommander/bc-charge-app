## Description: <br>
Delegate coding tasks to Codex, Claude Code, OpenCode, or Pi agents through acpx and related command-line workflows. <br>

This skill is ready for commercial/non-commercial use. <br>

## Publisher: <br>
[seanford](https://clawhub.ai/user/seanford) <br>

### License/Terms of Use: <br>
MIT-0 <br>


## Use Case: <br>
Developers and engineering teams use this skill to delegate feature work, code review, refactoring, and longer coding workflows to coding agents while preserving session and working-directory context. <br>

### Deployment Geography for Use: <br>
Global <br>

## Known Risks and Mitigations: <br>
Risk: Delegated coding agents may receive broad authority over the selected working directory. <br>
Mitigation: Use read-only or narrowly approved modes where possible, isolate the repository before delegation, and review the task before granting write or execution authority. <br>
Risk: Auto-approval, permission bypass, and background runs can modify code or run commands without enough user control. <br>
Mitigation: Avoid `--approve-all` and permission-bypass modes unless the workspace has been isolated and the requested changes are well understood. <br>
Risk: Running the skill near sensitive credentials or live production code could cause accidental exposure or modification. <br>
Mitigation: Do not use it in workspaces containing sensitive credentials or live production code unless those files are protected and the delegated agent's permissions are constrained. <br>


## Reference(s): <br>
- [ClawHub skill page](https://clawhub.ai/seanford/skills/coding-agent) <br>
- [Publisher profile](https://clawhub.ai/user/seanford) <br>


## Skill Output: <br>
**Output Type(s):** [Shell commands, Code, Markdown, Configuration instructions, Guidance] <br>
**Output Format:** [Markdown with inline shell command examples and workflow guidance] <br>
**Output Parameters:** [1D] <br>
**Other Properties Related to Output:** [May produce delegated agent prompts, command invocations, review summaries, code changes, or follow-up instructions depending on the selected agent and task.] <br>

## Skill Version(s): <br>
1.0.0 (source: server release metadata) <br>

## Ethical Considerations: <br>
Users should evaluate whether this skill is appropriate for their environment, review any generated or modified files before relying on them, and apply their organization's safety, security, and compliance requirements before deployment. <br>
