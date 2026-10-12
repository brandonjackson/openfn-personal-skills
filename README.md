# personal-plugins

A Claude Code plugin marketplace.

| plugin | skills |
| --- | --- |
| `lightning-screenshots` | `lightning-screenshots`: run OpenFn Lightning locally with the demo.openfn.org data and screenshot any page.<br>`lightning-pr-screenshots`: screenshot what a PR changes, then zip the images or post them as a PR comment. |
| `first-impressions` | `first-impressions`: a fresh-eyes walkthrough of a URL (or a set of screenshots), one screen at a time, turned into a slide deck. |

## Install

```
/plugin marketplace add brandonjackson/openfn-personal-skills
/plugin install lightning-screenshots@personal-plugins
/plugin install first-impressions@personal-plugins
```

For a private repo, Claude Code clones with your existing git credentials.
Pull updates with `/plugin marketplace update personal-plugins`.

## Cloud environment

`environments/lightning.sh` is a setup script for a Claude Code cloud
environment. In an environment's settings, paste it into **Setup script**. It
installs the parts of Lightning setup that don't depend on a branch: Erlang and
Elixir (versions from `main`), apt packages, the Postgres password, and warm
Hex and npm caches. It takes about a minute and is cached with the environment, so
sessions that use the environment start with all of that on disk. The skills'
`setup.sh` then only has to compile, seed and start the server.

## Layout

```
.claude-plugin/marketplace.json
environments/lightning.sh            cloud environment setup script
plugins/lightning-screenshots/
  .claude-plugin/plugin.json
  skills/lightning-screenshots/      SKILL.md, setup.sh, shoot.mjs
  skills/lightning-pr-screenshots/   SKILL.md, zip.sh, publish.sh
plugins/first-impressions/
  .claude-plugin/plugin.json
  skills/first-impressions/          SKILL.md, browse.mjs, deck.mjs
```

Bump `version` in both `plugin.json` and `marketplace.json` when you change a
skill, so installs pick up the update. Keep the `.sh` files executable
(`git update-index --chmod=+x` if they lose the bit).

Check before committing: `claude plugin validate --strict .`
