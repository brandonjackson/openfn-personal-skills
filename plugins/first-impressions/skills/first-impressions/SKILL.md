---
name: first-impressions
description: Do a first impressions analysis of a web experience. Act as a fresh pair of eyes, go one screen at a time, write down what you see, what's confusing and what you predict will happen next, then reflect on the information architecture, clarity and feel, and turn the journey into a slide deck. Use when asked for a "first impressions analysis", a fresh-eyes or cold walkthrough, or "how clear is this design" for a URL or a set of screenshots, optionally with login details, a persona and/or a goal.
---

# First impressions analysis

You are a fresh pair of eyes. Your job is to look at an experience and try to
work out how it works, building a mental model from limited information, the
way a real newcomer would. The point is to learn how clear the design is, so
the most useful thing you can produce is an honest record of where your model
matched the product and where it broke.

Scripts live next to this file, in the base directory shown when the skill
loads. Set `SKILL_DIR` to that path.

- `browse.mjs` keeps one browser open across commands, so you can move a page
  at a time. Every action saves a numbered screenshot.
- `deck.mjs` turns your notes (`journey.json`) and the screenshots into one
  self-contained HTML slide deck.

## Inputs

Work out what you've been given before you start. Ask only if you have no
starting point at all.

- **A URL** (most common), maybe with **login details**.
- **A set of screenshots** instead of a URL. Then you walk them in order
  instead of browsing (see below).
- **A persona** (optional): be that person. Their background, vocabulary and
  patience shape what's confusing.
- **A goal** (optional): something to achieve. Without one, your goal is
  "understand what this is and what I can do here".

## Stay fresh

This only works if you really don't know more than a newcomer would.

- Don't read docs, source code, marketing pages or anything else about the
  product unless the persona would plausibly do that, and if you do, make it a
  step in the journey.
- Don't lean on what you already know about the product from training. If you
  recognise it, say so once in your notes and then judge only what's on screen.
- **Decide from the screenshot, not the element list.** `browse.mjs` prints
  the clickable elements so you can act precisely. Read the screenshot first,
  decide where you'd go as a person, then find that thing's ref. If what you
  want isn't visible, that's a finding.
- Don't scroll, hover or open menus "just to check" before writing your notes
  for the screen. Each of those is its own step if you do it.
- Keep it honest: if something was easy, say so. Don't invent confusion.

## Process

Start the browser once. Put the run in its own folder (in the scratchpad, or
the working directory if the user wants to keep it):

```bash
OUT=<scratchpad>/first-impressions/<product>-<yyyy-mm-dd>
node $SKILL_DIR/browse.mjs start --out $OUT     # --width/--height, default 1440x900
node $SKILL_DIR/browse.mjs goto <url>
```

Then go **one page at a time**. After every screen loads:

0. **Screenshot.** The command already saved it and printed the path. Open it
   with Read and actually look at it.
1. **Describe what you're looking at.** Layout, the main things on the screen,
   what draws the eye first.
2. **Describe the big picture.** What do you think this place is for? Where do
   you think you are in the product? How does it seem to be organised?
3. **Describe what's confusing or doesn't make sense.** Unclear labels, jargon,
   competing calls to action, missing feedback, things you can't tell are
   clickable. **After the first screen, note any surprises** against the
   prediction you made last step: did you land where you expected? Did it do
   what you thought?
4. **Decide where to go next**, and why, from what's on the screen.
5. **Predict what will happen** when you go there. Be specific: "a form to
   create a project, probably asking for a name".

Record each step in `$OUT/journey.json` as you go (format below), then act:

```bash
node $SKILL_DIR/browse.mjs click 7                 # ref from the last listing
node $SKILL_DIR/browse.mjs click 'text=Create project'
node $SKILL_DIR/browse.mjs fill 3 "My first project" # no screenshot
node $SKILL_DIR/browse.mjs press Enter
node $SKILL_DIR/browse.mjs scroll down            # or up
node $SKILL_DIR/browse.mjs hover 4
node $SKILL_DIR/browse.mjs back
node $SKILL_DIR/browse.mjs look                   # re-shoot, e.g. after an animation
```

A scroll, an opened menu or a modal counts as a new screen: run through steps
0 to 5 again. If an action fails, the command still prints a fresh screenshot
of where you are; treat "I couldn't do what I meant to" as a finding.

### Logging in

Never put a password in a command line, in your notes, or in the deck. Put it
in an environment variable for the one command that needs it and use
`fill-secret`:

```bash
node $SKILL_DIR/browse.mjs fill 1 someone@example.org
FI_PASSWORD='...' node $SKILL_DIR/browse.mjs fill-secret 2 FI_PASSWORD
node $SKILL_DIR/browse.mjs click 'button:has-text("Log in")'
```

The login screen is part of the experience, so it gets its own step.

### Working from screenshots

When the user gives you screenshots instead of a URL, skip `browse.mjs`. Copy
them into `$OUT` in the order given (or ask for the order if it isn't clear)
and take them one at a time with Read. Don't look ahead. Steps 0 to 5 are the
same, except that "where to go next" is what you'd click on this screen, and
the next screenshot shows you whether your prediction held. If the next
screenshot isn't where your choice would lead, say so: that gap is a finding
too.

### When to stop

Stop and reflect when you:

- **achieve the goal**,
- **get totally stuck** (you've tried a couple of sensible routes and can't see
  a way forward; don't brute-force every link), or
- reach a **logical stopping point** (you've formed a model of the main areas,
  or about 15 to 20 screens without a goal).

Then `node $SKILL_DIR/browse.mjs stop`.

## Reflect

Step back and look at the whole journey, not just a list of the individual
problems. Write in plain language, the way you'd talk a colleague through it.

- **Outcome and summary**: did you get there, and how did it feel overall?
- **Mental model**: describe how you now think the product works, in a few
  sentences. Where is it still fuzzy?
- **Information architecture**: how things are grouped and named, whether you
  could tell where you were and how to get where you wanted.
- **Clarity of design**: labels, hierarchy, affordances, feedback, empty
  states.
- **Overall feel**: tone, pace, confidence, how much effort it took.
- **What worked**: be specific; this matters as much as the problems.
- **Where the model broke**: the few biggest moments of confusion or surprise,
  each tied to the screens where it happened. Group repeated small issues
  into one theme rather than listing every nit.
- **What I'd try**: a handful of concrete suggestions, most valuable first.

## Output: the deck

The default output is a slide deck that walks people through the journey. It
has a title slide, the method, the route (thumbnails), one slide per screen
(screenshot plus your notes for steps 1 to 5), then the reflection slides.

```bash
node $SKILL_DIR/deck.mjs $OUT/journey.json      # writes $OUT/deck.html
```

Then **open the deck and check it**: screenshot a couple of slides with
Playwright (or Read the HTML) to make sure every screenshot is there and the
notes fit.

Hand it over:

- If the `Artifact` tool is available, publish `deck.html` with it (load
  `artifact-design` first if the tool asks) and give the user the link. The
  deck is one file with the screenshots embedded, and `deck.mjs` warns if it
  gets too big to publish.
- Otherwise send it with `SendUserFile`.
- In your reply, give the outcome and the three or four biggest takeaways in a
  few lines. Don't paste the whole journey into chat.

If the user wants Google Slides or a .pptx instead, build that from the same
`journey.json` and screenshots with the matching skill, keeping the same
structure.

## journey.json

Notes can be a string or a list of short points. Screenshot paths are
relative to the journey file.

```json
{
  "product": "OpenFn Lightning",
  "url": "https://demo.openfn.org",
  "date": "2026-10-12",
  "persona": "A program manager who's never used it",
  "goal": "Find out why last night's sync failed",
  "source": "live",
  "steps": [
    {
      "screenshot": "01-log-in.png",
      "title": "Log in",
      "url": "https://demo.openfn.org/users/log_in",
      "action": "Opened the URL",
      "seeing": "A plain login form with email and password.",
      "bigPicture": "Some kind of tool behind an account.",
      "confusing": ["Nothing says what the product is before I sign in."],
      "surprises": "",
      "next": "Log in with the details I was given.",
      "prediction": "A dashboard showing my recent activity."
    }
  ],
  "reflection": {
    "outcome": "achieved",
    "summary": "...",
    "mentalModel": "...",
    "informationArchitecture": "...",
    "clarity": "...",
    "feel": "...",
    "worked": ["..."],
    "issues": [{ "title": "...", "detail": "...", "steps": [2, 3] }],
    "recommendations": ["..."]
  }
}
```

`source` is `live` or `screenshots`. `outcome` is `achieved`, `stuck` or
`stopped`. Leave `surprises` empty on the first step.

## Gotchas

- `browse.mjs` uses the Playwright in the current project if there is one,
  otherwise the global install, and the browser at `/opt/pw-browsers/chromium`
  (override with `CHROMIUM_PATH`). Don't run `playwright install`.
- Only one browser runs at a time. `start` says so if one is already up;
  `stop` it before starting a new run. Its log is `$OUT/.browser.log`.
- After each action it waits for the network to go quiet and the page text to
  stop changing (it handles typewriter-style greetings), up to about 6
  seconds. If a shot catches a spinner, run `look`.
- Links that open a new tab are followed automatically.
- Screenshots are 1x to keep the deck small. Around 30 screens is still well
  under the publish limit.
