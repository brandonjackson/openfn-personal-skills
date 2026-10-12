#!/usr/bin/env node
// A browser that stays open between commands, so a first-impressions walk can
// go one page at a time and keep its state (logins, open modals, SPA routes).
//
//   node $SKILL_DIR/browse.mjs start [--out DIR] [--width N] [--height N]
//   node $SKILL_DIR/browse.mjs goto <url>
//   node $SKILL_DIR/browse.mjs click <ref | selector>
//   node $SKILL_DIR/browse.mjs fill <ref | selector> <text>
//   node $SKILL_DIR/browse.mjs fill-secret <ref | selector> <ENV_VAR>
//   node $SKILL_DIR/browse.mjs press <key>            e.g. Enter, Escape
//   node $SKILL_DIR/browse.mjs hover <ref | selector>
//   node $SKILL_DIR/browse.mjs scroll [down | up]
//   node $SKILL_DIR/browse.mjs back
//   node $SKILL_DIR/browse.mjs look                   re-shoot without acting
//   node $SKILL_DIR/browse.mjs stop
//
// Every command except start, stop, fill and fill-secret waits for the page to
// settle, saves a screenshot as <out>/NN-<slug>.png (NN counts up), and prints:
//
//   shot:  first-impressions/03-projects.png
//   url:   https://...
//   title: ...
//   [1] link "Projects"
//   [2] button "New project"
//   ...
//
// The [N] refs are the interactive elements visible in the viewport. Use them
// to act (`click 2`), not to decide: decide from the screenshot, like a person
// would. Any other target is a Playwright selector, e.g. 'text=Sign in'.
//
// fill-secret reads the value from an environment variable so passwords never
// appear in commands, logs or notes.
//
// Defaults: --out ./first-impressions, 1440x900 viewport. Playwright is loaded
// from the current project if it has it, otherwise from the global install.
// The browser is CHROMIUM_PATH, defaulting to the cloud container's
// /opt/pw-browsers/chromium, so nothing is downloaded.

import { createRequire } from 'node:module';
import { execSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CONTROL = path.join(os.tmpdir(), 'first-impressions-browser.json');
const [cmd, ...args] = process.argv.slice(2);

function flags(list, defaults) {
  const o = { ...defaults };
  for (let i = 0; i < list.length; i++) {
    if (list[i].startsWith('--')) o[list[i].slice(2)] = list[++i];
  }
  return o;
}

function loadPlaywright() {
  const bases = [path.join(process.cwd(), 'package.json')];
  try {
    bases.push(path.join(execSync('npm root -g').toString().trim(), 'noop.js'));
  } catch {}
  for (const base of bases) {
    const req = createRequire(base);
    for (const mod of ['playwright', '@playwright/test']) {
      try {
        return req(mod);
      } catch {}
    }
  }
  throw new Error('Playwright not found. Run `npm install -g playwright` (no browser download needed).');
}

// ---------------------------------------------------------------- server

async function serve(opts) {
  const { chromium } = loadPlaywright();
  const launch = { args: ['--no-sandbox'] };
  const exe = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
  if (existsSync(exe)) launch.executablePath = exe;

  const browser = await chromium.launch(launch);
  const context = await browser.newContext({
    viewport: { width: +opts.width, height: +opts.height },
    deviceScaleFactor: 1,
  });
  let page = await context.newPage();
  // Links that open a new tab: follow them, the way a person's eyes would.
  context.on('page', p => {
    page = p;
  });
  mkdirSync(opts.out, { recursive: true });
  let n = 0;

  const resolve = t => (/^\d+$/.test(t) ? `[data-fi-ref="${t}"]` : t);

  async function settle() {
    await page.waitForTimeout(300); // give a click's navigation time to start
    await page.waitForLoadState('domcontentloaded').catch(() => {});
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
    // Wait for the text to stop changing (typewriter effects, late data).
    let last = null;
    for (let i = 0; i < 15; i++) {
      const text = await page.evaluate(() => document.body?.innerText || '').catch(() => '');
      if (text === last) break;
      last = text;
      await page.waitForTimeout(400);
    }
  }

  async function snapshot(label) {
    await settle();
    n++;
    const slug = (label || (await page.title()) || 'page')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40);
    const file = path.join(opts.out, `${String(n).padStart(2, '0')}-${slug || 'page'}.png`);
    await page.screenshot({ path: file });
    const elements = await page.evaluate(() => {
      document.querySelectorAll('[data-fi-ref]').forEach(el => el.removeAttribute('data-fi-ref'));
      const sel = [
        'a[href]', 'button', 'input:not([type=hidden])', 'select', 'textarea', 'summary',
        '[role=button]', '[role=link]', '[role=tab]', '[role=menuitem]', '[role=checkbox]',
        '[role=switch]', '[role=option]', '[onclick]', '[contenteditable=true]', '[phx-click]',
      ].join(',');
      // Plus anything that looks clickable (pointer cursor) and isn't inside
      // something already listed, e.g. clickable table rows and cards.
      const candidates = new Set(document.querySelectorAll(sel));
      for (const el of document.body.querySelectorAll('*')) {
        if (getComputedStyle(el).cursor !== 'pointer') continue;
        if (el.parentElement && getComputedStyle(el.parentElement).cursor === 'pointer') continue;
        if ([...candidates].some(c => c.contains(el) || el.contains(c))) continue;
        if (el.innerText?.trim() || el.getAttribute('aria-label')) candidates.add(el);
      }
      const out = [];
      let i = 0;
      const ordered = [...candidates].sort((a, b) =>
        a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1);
      for (const el of ordered) {
        const r = el.getBoundingClientRect();
        const s = getComputedStyle(el);
        const inView = r.width > 0 && r.height > 0 && r.bottom > 0 && r.right > 0 &&
          r.top < innerHeight && r.left < innerWidth;
        if (!inView || s.visibility === 'hidden' || s.display === 'none' || +s.opacity === 0) continue;
        el.setAttribute('data-fi-ref', ++i);
        const tag = el.getAttribute('role') || el.tagName.toLowerCase();
        const kind = el.tagName === 'INPUT' ? `input[${el.type}]` : tag;
        const text = (
          el.getAttribute('aria-label') || el.labels?.[0]?.innerText || el.innerText ||
          el.placeholder || el.title || el.querySelector('img, svg title')?.alt ||
          el.querySelector('svg title')?.textContent ||
          (['submit', 'button'].includes(el.type) ? el.value : '') || el.getAttribute('name') || ''
        ).replace(/\s+/g, ' ').trim().slice(0, 70);
        out.push(`[${i}] ${kind} "${text}"`);
      }
      return out;
    });
    return [`shot:  ${file}`, `url:   ${page.url()}`, `title: ${await page.title()}`, ...elements].join('\n');
  }

  const actions = {
    goto: async ([url]) => page.goto(url, { waitUntil: 'domcontentloaded' }),
    click: async ([t]) => page.click(resolve(t), { timeout: 10000 }),
    hover: async ([t]) => page.hover(resolve(t), { timeout: 10000 }),
    fill: async ([t, ...text]) => page.fill(resolve(t), text.join(' '), { timeout: 10000 }),
    'fill-secret': async ([t, env], secrets) => {
      if (!secrets[env]) throw new Error(`env var ${env} is empty`);
      await page.fill(resolve(t), secrets[env], { timeout: 10000 });
    },
    press: async ([key]) => page.keyboard.press(key),
    scroll: async ([dir]) => page.mouse.wheel(0, (dir === 'up' ? -1 : 1) * +opts.height * 0.8),
    back: async () => page.goBack(),
    look: async () => {},
  };

  const QUIET = new Set(['fill', 'fill-secret']);

  const server = http.createServer(async (req, res) => {
    let body = '';
    for await (const chunk of req) body += chunk;
    const { cmd, args, secrets } = JSON.parse(body || '{}');
    let status = 200;
    let text;
    try {
      if (cmd === 'stop') {
        text = 'stopped';
        res.end(text);
        await browser.close();
        server.close();
        rmSync(CONTROL, { force: true });
        return;
      }
      if (!actions[cmd]) throw new Error(`unknown command ${cmd}`);
      await actions[cmd](args, secrets || {});
      // Typing into a form isn't a new screen; shoot once the form is submitted.
      text = QUIET.has(cmd) ? `ok: ${cmd} ${args[0]}` : await snapshot();
    } catch (e) {
      status = 500;
      text = `ERROR ${cmd}: ${e.message.split('\n')[0]}`;
      try {
        text += '\n' + (await snapshot());
      } catch {}
    }
    res.writeHead(status);
    res.end(text);
  });
  server.listen(0, '127.0.0.1', () => {
    writeFileSync(CONTROL, JSON.stringify({ port: server.address().port, out: opts.out, pid: process.pid }));
  });
}

// ---------------------------------------------------------------- client

function control() {
  if (!existsSync(CONTROL)) return null;
  return JSON.parse(readFileSync(CONTROL, 'utf8'));
}

function send(payload) {
  const c = control();
  if (!c) {
    console.error('No browser running. Start one with: browse.mjs start');
    process.exit(1);
  }
  return new Promise((ok, fail) => {
    const req = http.request(
      { host: '127.0.0.1', port: c.port, method: 'POST', timeout: 120000 },
      res => {
        let out = '';
        res.on('data', d => (out += d));
        res.on('end', () => ok({ status: res.statusCode, out }));
      },
    );
    req.on('error', fail);
    req.end(JSON.stringify(payload));
  });
}

if (cmd === 'serve') {
  await serve(flags(args, { out: 'first-impressions', width: 1440, height: 900 }));
} else if (cmd === 'start') {
  const c = control();
  if (c) {
    try {
      process.kill(c.pid, 0);
      console.log(`already running (pid ${c.pid}), screenshots go to ${c.out}`);
      process.exit(0);
    } catch {
      rmSync(CONTROL, { force: true });
    }
  }
  const opts = flags(args, { out: 'first-impressions', width: 1440, height: 900 });
  mkdirSync(opts.out, { recursive: true });
  const log = openSync(path.join(opts.out, '.browser.log'), 'a');
  const self = fileURLToPath(import.meta.url);
  spawn(process.execPath, [self, 'serve', ...args], { detached: true, stdio: ['ignore', log, log] }).unref();
  for (let i = 0; i < 100 && !control(); i++) await new Promise(r => setTimeout(r, 200));
  if (!control()) {
    console.error(`browser didn't start; see ${path.join(opts.out, '.browser.log')}`);
    process.exit(1);
  }
  console.log(`browser started, screenshots go to ${opts.out}`);
} else if (cmd === 'stop') {
  if (control()) console.log((await send({ cmd: 'stop' }).catch(() => ({ out: 'stopped' }))).out);
  rmSync(CONTROL, { force: true });
} else if (cmd) {
  const payload = { cmd, args };
  if (cmd === 'fill-secret') payload.secrets = { [args[1]]: process.env[args[1]] };
  const { status, out } = await send(payload);
  console.log(out);
  process.exit(status === 200 ? 0 : 1);
} else {
  console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n\nimport')[0]);
}
