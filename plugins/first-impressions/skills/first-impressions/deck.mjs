#!/usr/bin/env node
// Build a self-contained HTML slide deck from a first-impressions journey.
//
//   node $SKILL_DIR/deck.mjs <journey.json> [--out deck.html]
//
// Screenshot paths in the journey are relative to the journey file. They're
// embedded as data URIs, so the deck is one file you can publish or send.
// Arrow keys / space / click to move; print to PDF gives one slide per page.
//
// journey.json (strings can be a string or an array of bullet strings):
//
// {
//   "product": "OpenFn Lightning",          // shows in the title
//   "url": "https://demo.openfn.org",
//   "date": "2026-10-12",
//   "persona": "A program manager who's never used it",   // optional
//   "goal": "Find out why last night's sync failed",       // optional
//   "source": "live" | "screenshots",
//   "steps": [{
//     "screenshot": "01-sign-in.png",
//     "title": "Sign in",                   // short name for the page
//     "url": "https://...",                 // optional
//     "action": "Opened the URL",           // how we got here
//     "seeing": "...",                      // 1. what I'm looking at
//     "bigPicture": "...",                  // 2. the big picture
//     "confusing": ["...", "..."],          // 3. what's confusing
//     "surprises": "...",                   // 3b. vs what I predicted (not on step 1)
//     "next": "...",                        // 4. where I'll go next
//     "prediction": "..."                   // 5. what I expect to happen
//   }],
//   "reflection": {
//     "outcome": "achieved" | "stuck" | "stopped",
//     "summary": "...",
//     "mentalModel": "...",                 // how I think it works now
//     "informationArchitecture": "...",
//     "clarity": "...",
//     "feel": "...",
//     "worked": ["..."],
//     "issues": [{ "title": "...", "detail": "...", "steps": [3, 4] }],
//     "recommendations": ["..."]
//   }
// }

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const argv = process.argv.slice(2);
const outIdx = argv.indexOf('--out');
const file = argv.find((a, k) => !a.startsWith('--') && (outIdx < 0 || k !== outIdx + 1));
if (!file) {
  console.error('usage: deck.mjs <journey.json> [--out deck.html]');
  process.exit(1);
}
const dir = path.dirname(path.resolve(file));
const out = outIdx >= 0 ? argv[outIdx + 1] : path.join(dir, 'deck.html');
const j = JSON.parse(readFileSync(file, 'utf8'));
const steps = j.steps || [];
const r = j.reflection || {};

const esc = s =>
  String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const list = v => (Array.isArray(v) ? v : v ? [v] : []).filter(Boolean);
const prose = v => {
  const items = list(v);
  if (items.length > 1) return `<ul>${items.map(i => `<li>${esc(i)}</li>`).join('')}</ul>`;
  return items.map(i => `<p>${esc(i)}</p>`).join('');
};
const mime = f => ({ '.jpg': 'jpeg', '.jpeg': 'jpeg', '.webp': 'webp', '.gif': 'gif' })[path.extname(f).toLowerCase()] || 'png';
const img = (f, alt) => {
  if (!f) return '';
  const p = path.resolve(dir, f);
  if (!existsSync(p)) {
    console.warn(`missing screenshot: ${f}`);
    return `<div class="missing">missing: ${esc(f)}</div>`;
  }
  return `<img src="data:image/${mime(p)};base64,${readFileSync(p).toString('base64')}" alt="${esc(alt)}">`;
};
const section = (label, body, cls = '') =>
  body ? `<div class="note ${cls}"><h4>${label}</h4>${body}</div>` : '';

const outcome = { achieved: 'Goal achieved', stuck: 'Got stuck', stopped: 'Stopped' }[r.outcome] || '';
const product = j.product || j.url || 'Untitled';

const slides = [];

slides.push(`
<section class="slide title">
  <div class="kicker">First impressions</div>
  <h1>${esc(product)}</h1>
  <p class="lede">A fresh pair of eyes, one screen at a time.</p>
  <dl class="meta">
    ${j.persona ? `<dt>Persona</dt><dd>${esc(j.persona)}</dd>` : ''}
    ${j.goal ? `<dt>Goal</dt><dd>${esc(j.goal)}</dd>` : ''}
    ${j.url ? `<dt>Started at</dt><dd>${esc(j.url)}</dd>` : ''}
    <dt>Screens</dt><dd>${steps.length}${outcome ? `; ${esc(outcome.toLowerCase())}` : ''}</dd>
    ${j.date ? `<dt>Date</dt><dd>${esc(j.date)}</dd>` : ''}
  </dl>
</section>`);

slides.push(`
<section class="slide">
  <h2>How this works</h2>
  <p class="lede">I came in with ${j.source === 'screenshots' ? 'only a set of screenshots' : 'only the URL'}${j.goal ? ' and a goal' : ''}, no docs and no prior knowledge of the product. At every screen I wrote down:</p>
  <ol class="method">
    <li><b>What I'm looking at</b></li>
    <li><b>The big picture</b>: what I think this place is for</li>
    <li><b>What's confusing</b>, and any <b>surprises</b> versus what I expected</li>
    <li><b>Where I'll go next</b></li>
    <li><b>What I predict</b> will happen when I get there</li>
  </ol>
  <p>The gap between prediction and reality is the signal: it shows where the design's model and a newcomer's model part ways.</p>
</section>`);

if (steps.length > 1) {
  slides.push(`
<section class="slide">
  <h2>The route</h2>
  <ol class="route">
    ${steps
      .map(
        (s, i) => `<li><a href="#s${i + 3}" data-go="${i + 2}">${img(s.screenshot, s.title)}</a>
        <span><b>${i + 1}</b> ${esc(s.title || '')}</span></li>`,
      )
      .join('')}
  </ol>
</section>`);
}

steps.forEach((s, i) => {
  slides.push(`
<section class="slide step">
  <header>
    <span class="num">${i + 1}<small>/${steps.length}</small></span>
    <h2>${esc(s.title || `Screen ${i + 1}`)}</h2>
    ${s.action ? `<span class="action">${esc(s.action)}</span>` : ''}
  </header>
  <div class="cols">
    <figure>${img(s.screenshot, s.title)}${s.url ? `<figcaption>${esc(s.url)}</figcaption>` : ''}</figure>
    <div class="notes">
      ${section('What I see', prose(s.seeing))}
      ${section('Big picture', prose(s.bigPicture))}
      ${i > 0 ? section('Surprises', prose(s.surprises), 'surprise') : ''}
      ${section('Confusing', prose(s.confusing), 'confusing')}
      ${section('Next', prose(s.next))}
      ${section('I predict', prose(s.prediction), 'predict')}
    </div>
  </div>
</section>`);
});

slides.push(`
<section class="slide">
  <div class="kicker">Reflection</div>
  <h2>${esc(outcome || 'Where I ended up')}</h2>
  ${prose(r.summary)}
  ${r.mentalModel ? `<div class="callout"><h4>My mental model now</h4>${prose(r.mentalModel)}</div>` : ''}
</section>`);

const lenses = [
  ['Information architecture', r.informationArchitecture],
  ['Clarity of design', r.clarity],
  ['Overall feel', r.feel],
].filter(([, v]) => list(v).length);
if (lenses.length) {
  slides.push(`
<section class="slide">
  <h2>Looking back</h2>
  <div class="grid g${lenses.length}">
    ${lenses.map(([h, v]) => `<div class="card"><h3>${h}</h3>${prose(v)}</div>`).join('')}
  </div>
</section>`);
}

if (list(r.issues).length || list(r.worked).length) {
  slides.push(`
<section class="slide">
  <h2>Where the model broke</h2>
  <div class="split">
    <div>
      ${list(r.issues)
        .map(
          x => `<div class="issue"><h3>${esc(x.title || x)}</h3>${x.detail ? `<p>${esc(x.detail)}</p>` : ''}${
            list(x.steps).length ? `<p class="refs">Screens ${list(x.steps).join(', ')}</p>` : ''
          }</div>`,
        )
        .join('')}
    </div>
    ${list(r.worked).length ? `<div class="card worked"><h3>What worked</h3><ul>${list(r.worked).map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}
  </div>
</section>`);
}

if (list(r.recommendations).length) {
  slides.push(`
<section class="slide">
  <h2>What I'd try</h2>
  <ol class="recs">${list(r.recommendations).map(x => `<li>${esc(x)}</li>`).join('')}</ol>
</section>`);
}

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(product)} first impressions</title>
<style>
:root {
  --bg: #f4f3ef; --slide: #ffffff; --ink: #1d1d1f; --muted: #6b6b70; --line: #e3e1db;
  --accent: #3a5bd9; --accent-soft: #e8edfc; --warn: #b4540a; --warn-soft: #fdf0e3;
  --good: #2c7a4b; --good-soft: #e5f3ea; --shadow: 0 1px 3px rgba(0,0,0,.08), 0 8px 24px rgba(0,0,0,.06);
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --bg: #121214; --slide: #1c1c1f; --ink: #ececef; --muted: #9a9aa2; --line: #2e2e33;
    --accent: #8ea6ff; --accent-soft: #232a45; --warn: #f2a65a; --warn-soft: #3a2a19;
    --good: #6fcf97; --good-soft: #1b3326; --shadow: none;
  }
}
:root[data-theme="dark"] {
  --bg: #121214; --slide: #1c1c1f; --ink: #ececef; --muted: #9a9aa2; --line: #2e2e33;
  --accent: #8ea6ff; --accent-soft: #232a45; --warn: #f2a65a; --warn-soft: #3a2a19;
  --good: #6fcf97; --good-soft: #1b3326; --shadow: none;
}
* { box-sizing: border-box; }
html, body { margin: 0; }
body { background: var(--bg); color: var(--ink); font: 16px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; }
.deck { padding: 24px 16px 80px; display: flex; flex-direction: column; align-items: center; gap: 24px; }
.slide { width: min(1200px, 100%); aspect-ratio: 16 / 9; background: var(--slide); border: 1px solid var(--line);
  border-radius: 12px; box-shadow: var(--shadow); padding: 48px 56px; overflow: hidden; position: relative;
  display: flex; flex-direction: column; justify-content: center; }
h1 { font-size: 56px; line-height: 1.05; margin: 8px 0 12px; letter-spacing: -.02em; }
h2 { font-size: 34px; line-height: 1.15; margin: 0 0 20px; letter-spacing: -.01em; }
h3 { font-size: 18px; margin: 0 0 6px; }
h4 { font-size: 12px; text-transform: uppercase; letter-spacing: .08em; color: var(--muted); margin: 0 0 4px; }
p, li { margin: 0 0 8px; }
ul, ol { margin: 0; padding-left: 20px; }
.kicker { color: var(--accent); font-weight: 600; text-transform: uppercase; letter-spacing: .1em; font-size: 13px; }
.lede { font-size: 20px; color: var(--muted); }
.meta { display: grid; grid-template-columns: max-content 1fr; gap: 6px 20px; margin-top: 28px; font-size: 17px; }
.meta dt { color: var(--muted); } .meta dd { margin: 0; }
.method { font-size: 19px; margin: 12px 0 20px; } .method li { margin-bottom: 6px; }
.route { list-style: none; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 14px; overflow: auto; }
.route img { width: 100%; aspect-ratio: 16/10; object-fit: cover; object-position: top; border: 1px solid var(--line); border-radius: 6px; display: block; }
.route span { font-size: 13px; color: var(--muted); } .route b { color: var(--accent); margin-right: 4px; }
.route a { display: block; }
.step { justify-content: flex-start; padding: 28px 32px; }
.step header { display: flex; align-items: baseline; gap: 14px; margin-bottom: 14px; flex-wrap: wrap; }
.step h2 { margin: 0; font-size: 26px; }
.num { font-size: 26px; font-weight: 700; color: var(--accent); } .num small { font-size: 14px; color: var(--muted); font-weight: 500; }
.action { font-size: 14px; color: var(--muted); background: var(--accent-soft); padding: 2px 10px; border-radius: 999px; }
.cols { display: grid; grid-template-columns: 1.55fr 1fr; gap: 24px; min-height: 0; flex: 1; }
figure { margin: 0; min-height: 0; display: flex; flex-direction: column; }
figure img { width: 100%; height: auto; max-height: 100%; object-fit: contain; object-position: top left; border: 1px solid var(--line); border-radius: 8px; }
figcaption { font-size: 12px; color: var(--muted); margin-top: 6px; word-break: break-all; }
.notes { overflow: auto; font-size: 14.5px; line-height: 1.45; padding-right: 4px; }
.note { margin-bottom: 12px; } .note p, .note li { margin-bottom: 4px; }
.note.confusing { border-left: 3px solid var(--warn); padding-left: 10px; }
.note.surprise { background: var(--warn-soft); padding: 8px 10px; border-radius: 6px; }
.note.predict { background: var(--accent-soft); padding: 8px 10px; border-radius: 6px; }
.callout { margin-top: 18px; background: var(--accent-soft); padding: 16px 20px; border-radius: 10px; }
.grid { display: grid; gap: 18px; } .g2 { grid-template-columns: 1fr 1fr; } .g3 { grid-template-columns: repeat(3, 1fr); }
.card { background: var(--bg); border: 1px solid var(--line); border-radius: 10px; padding: 18px 20px; font-size: 15px; overflow: auto; }
.split { display: grid; grid-template-columns: 1.6fr 1fr; gap: 24px; overflow: auto; }
.issue { border-left: 3px solid var(--warn); padding: 2px 0 2px 14px; margin-bottom: 14px; font-size: 15px; }
.issue p { margin-bottom: 2px; } .refs { color: var(--muted); font-size: 13px; }
.worked { background: var(--good-soft); border-color: transparent; } .worked h3 { color: var(--good); }
.recs { font-size: 19px; } .recs li { margin-bottom: 12px; }
.missing { padding: 40px; border: 1px dashed var(--warn); color: var(--warn); border-radius: 8px; }
.bar { position: fixed; bottom: 12px; right: 16px; display: flex; gap: 6px; }
.bar button { background: var(--slide); color: var(--ink); border: 1px solid var(--line); border-radius: 8px; padding: 6px 12px; font: inherit; cursor: pointer; }
body.present .deck { padding: 0; height: 100vh; justify-content: center; }
body.present .slide { display: none; width: min(100vw, 177.78vh); }
body.present .slide.on { display: flex; }
@media (max-width: 760px) {
  .slide { aspect-ratio: auto; padding: 24px 20px; }
  h1 { font-size: 36px; } h2 { font-size: 24px; }
  .cols, .split, .g2, .g3 { grid-template-columns: 1fr; }
  .bar { display: none; }
}
@media print {
  @page { size: 13.333in 7.5in; margin: 0; }
  body { background: #fff; } .bar { display: none; }
  .deck { padding: 0; gap: 0; }
  .slide, body.present .slide { display: flex; width: 100%; height: 100vh; border: 0; border-radius: 0; box-shadow: none; break-after: page; }
}
</style>
</head>
<body>
<main class="deck">
${slides.map((s, i) => s.replace('<section class="slide', `<section id="s${i + 1}" class="slide`)).join('\n')}
</main>
<div class="bar"><button id="mode">Present</button></div>
<script>
(() => {
  const slides = [...document.querySelectorAll('.slide')];
  let i = 0;
  const show = n => {
    i = Math.max(0, Math.min(slides.length - 1, n));
    slides.forEach((s, k) => s.classList.toggle('on', k === i));
  };
  const toggle = on => {
    document.body.classList.toggle('present', on);
    document.getElementById('mode').textContent = on ? 'Scroll view' : 'Present';
    if (on) show(i); else slides[i].scrollIntoView();
  };
  document.getElementById('mode').onclick = () => toggle(!document.body.classList.contains('present'));
  document.querySelectorAll('[data-go]').forEach(a => a.addEventListener('click', e => {
    if (!document.body.classList.contains('present')) return;
    e.preventDefault(); show(+a.dataset.go + 1);
  }));
  addEventListener('keydown', e => {
    const present = document.body.classList.contains('present');
    if (e.key === 'Escape' && present) return toggle(false);
    if (!present) { if (e.key === 'p') toggle(true); return; }
    if (['ArrowRight', 'ArrowDown', ' ', 'PageDown'].includes(e.key)) { e.preventDefault(); show(i + 1); }
    if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(e.key)) { e.preventDefault(); show(i - 1); }
  });
})();
</script>
</body>
</html>
`;

writeFileSync(out, html);
const mb = Buffer.byteLength(html) / 1e6;
console.log(`${out}  (${slides.length} slides, ${mb.toFixed(1)} MB)`);
if (mb > 15) console.warn('Over 15 MB: too big to publish as an artifact. Use fewer or JPEG screenshots.');
