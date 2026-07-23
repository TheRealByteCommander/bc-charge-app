## Description: <br>
GitHub API integration with managed OAuth for accessing repositories, issues, pull requests, commits, branches, users, and related workflow data. <br>

This skill is ready for commercial/non-commercial use. <br>

## Publisher: <br>
[byungkyu](https://clawhub.ai/user/byungkyu) <br>

### License/Terms of Use: <br>
MIT-0 <br>


## Use Case: <br>
Developers and automation agents use this skill to inspect and manage GitHub repositories, issues, pull requests, branches, commits, and users through Maton-managed OAuth access. <br>

### Deployment Geography for Use: <br>
Global <br>

## Known Risks and Mitigations: <br>
Risk: The skill depends on Maton-managed OAuth/API access to GitHub accounts. <br>
Mitigation: Install only when the user trusts Maton to broker GitHub OAuth access and confirms the intended account connection before use. <br>
Risk: Write-capable GitHub actions can change repositories, branches, collaborators, pull requests, or organization resources. <br>
Mitigation: Before writes, confirm the exact repository, account connection, target object, and whether the action is reversible. <br>


## Reference(s): <br>
- [ClawHub GitHub Skill](https://clawhub.ai/byungkyu/skills/github-api) <br>
- [GitHub REST API Documentation](https://docs.github.com/en/rest) <br>
- [GitHub Repositories API](https://docs.github.com/en/rest/repos/repos) <br>
- [GitHub Issues API](https://docs.github.com/en/rest/issues/issues) <br>
- [GitHub Pull Requests API](https://docs.github.com/en/rest/pulls/pulls) <br>
- [GitHub Search API](https://docs.github.com/en/rest/search/search) <br>
- [GitHub REST API Rate Limiting](https://docs.github.com/en/rest/overview/resources-in-the-rest-api#rate-limiting) <br>
- [Maton CLI Manual](https://cli.maton.ai/manual) <br>
- [ClawHub API Gateway Skill](https://clawhub.ai/byungkyu/api-gateway) <br>


## Skill Output: <br>
**Output Type(s):** [Text, Markdown, Code, Shell commands, Configuration, Guidance] <br>
**Output Format:** [Markdown with REST endpoint examples, shell commands, and code snippets] <br>
**Output Parameters:** [1D] <br>
**Other Properties Related to Output:** [Requires network access, MATON_API_KEY, and an active GitHub OAuth connection through Maton.] <br>

## Skill Version(s): <br>
1.0.7 (source: server release evidence) <br>

## Ethical Considerations: <br>
Users should evaluate whether this skill is appropriate for their environment, review any generated or modified files before relying on them, and apply their organization's safety, security, and compliance requirements before deployment. <br>
