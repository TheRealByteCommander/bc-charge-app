## Description: <br>
Back up and restore OpenClaw data by archiving ~/.openclaw with exclusions, backup rotation, scheduling guidance, and restore steps. <br>

This skill is ready for commercial/non-commercial use. <br>

## Publisher: <br>
[alex3alex](https://clawhub.ai/user/alex3alex) <br>

### License/Terms of Use: <br>


## Use Case: <br>
Developers and OpenClaw users use this skill to create local backups, configure daily backup schedules, restore OpenClaw state, and manage backup rotation for OpenClaw configuration, credentials, agents, workspace files, Telegram session data, and cron tasks. <br>

### Deployment Geography for Use: <br>
Global <br>

## Known Risks and Mitigations: <br>
Risk: Backup archives can contain credentials, API keys, tokens, session data, and user files. <br>
Mitigation: Keep generated archives private, restrict file permissions, prefer encrypted storage, and avoid syncing or sharing them with untrusted services. <br>
Risk: Restore and rollback commands can replace or delete the current ~/.openclaw state. <br>
Mitigation: Review commands before execution and preserve the current ~/.openclaw directory until the restored environment has been verified. <br>
Risk: Scheduled backups may fail or run the wrong script if the cron path is incorrect. <br>
Mitigation: Verify the backup script path and schedule before enabling automatic backups. <br>


## Reference(s): <br>
- [Restore OpenClaw from Backup](references/restore.md) <br>


## Skill Output: <br>
**Output Type(s):** [Shell commands, Configuration, Guidance] <br>
**Output Format:** [Markdown with bash and JSON code blocks] <br>
**Output Parameters:** [1D] <br>
**Other Properties Related to Output:** [May guide creation of local .tar.gz backup archives and rotation of the last 7 backups when the provided shell commands are executed.] <br>

## Skill Version(s): <br>
1.0.0 (source: server release metadata) <br>

## Ethical Considerations: <br>
Users should evaluate whether this skill is appropriate for their environment, review any generated or modified files before relying on them, and apply their organization's safety, security, and compliance requirements before deployment. <br>
