## Git

Do not commit or push unless asked. If asked, follow the rules:

- Don't append "coauthored by" line
- Commit as the repo owner, not as Claude: author and committer must be `Timur Cravtov <timurcravtov04@gmail.com>`. Before committing, set it in the repo (`git config user.name "Timur Cravtov"`, `git config user.email "timurcravtov04@gmail.com"`), and never leave `Claude <noreply@anthropic.com>` as the identity.
- No Claude attribution anywhere in commits: no "Co-Authored-By", no "Generated with Claude Code", no session links.
- Follow the converntion: `feat/fix/docs/chore(module): description`

## Deploy

On each push to main the website is automatically redeployed, so don't mention the need to do that. 