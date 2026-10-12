# personal-plugins

A Claude Code plugin marketplace.

| plugin | skills |
| --- | --- |
| `lightning-screenshots` | `lightning-screenshots`: run OpenFn Lightning locally with the demo.openfn.org data and screenshot any page.<br>`lightning-pr-screenshots`: screenshot what a PR changes, then zip the images or post them as a PR comment. |

## Install

```
/plugin marketplace add brandonjackson/openfn-personal-skills
/plugin install lightning-screenshots@personal-plugins
```

For a private repo, Claude Code clones with your existing git credentials.
Pull updates with `/plugin marketplace update personal-plugins`.

## Layout

```
.claude-plugin/marketplace.json
plugins/lightning-screenshots/
  .claude-plugin/plugin.json
  skills/lightning-screenshots/      SKILL.md, setup.sh, shoot.mjs
  skills/lightning-pr-screenshots/   SKILL.md, zip.sh, publish.sh
```

Bump `version` in both `plugin.json` and `marketplace.json` when you change a
skill, so installs pick up the update. Keep the `.sh` files executable
(`git update-index --chmod=+x` if they lose the bit).

Check before committing: `claude plugin validate --strict .`
