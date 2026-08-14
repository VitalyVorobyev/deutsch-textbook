/**
 * The layout rules Redaktion is built on, measured in a real browser.
 *
 * WHY THIS EXISTS AND WHY IT IS NOT A `bun test`. Every rule below is about geometry *after* CSS —
 * row height, how many links land in one cell, whether a class in the DOM resolved to an actual
 * padding. None of it is visible to `bun run validate`, `astro check`, ESLint or the type system,
 * and the failure that prompted the redesign is the proof: `packages/ui` sat outside Tailwind's
 * scan path, so `Panel`'s `p-5` computed to **`padding: 0px`** while the class was right there in
 * the DOM looking correct. Build green, tests green, app unusable. It stays out of `bun test`
 * because it needs a dev server and a Chromium — the unit suite must not depend on either.
 *
 *   bunx playwright install chromium     # once
 *   bun run redaktion:audit              # boots its own dev server on a free port
 *   bun run redaktion:audit --shots /tmp/shots --widths 1440,1024,768
 *
 * WHAT IT CHECKS, and what each rule is for:
 *
 *   1. every route resolves            the router falls back to Sprachkarte, so a broken route
 *                                      renders a working-looking page — the heading is the tell
 *   2. permalinks survive reload       filter state lives in the query string exactly so a scoped
 *                                      list can be linked to; `Sprachkarte`'s cells link into one
 *   3. nothing leaves the origin       this app reads a local corpus and must work with no network;
 *                                      one CDN font would end that quietly
 *   4. package classes resolve         the defect above, pinned in the one place it shows
 *   5. row raggedness ≤ 2×             `Struktur` printed 20 topic links in a cell and ran 5.6× its
 *                                      median row height
 *   6. ≤ 1 primary link per row        three of six columns were blue; `Primaer` stamps
 *                                      `data-primary` so the row's own target is countable
 *
 * Non-zero exit on any failure.
 */
import { chromium, type Browser, type Page } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const ROUTES = [
  'sprachkarte',
  'themen',
  'thema/artikel-genus',
  'bestand',
  'struktur',
  'fokus',
  'quellen',
  'luecken',
] as const;

/** Views whose body is a `Zeilentabelle`, so the row rules apply. */
const TABLE_VIEWS = new Set(['struktur', 'fokus', 'quellen', 'bestand']);

/** A scoped list `Sprachkarte` links into — the permalink that has to survive a reload. */
const PERMALINK = 'struktur?strang=verbformen&niveau=A1';

const RAGGEDNESS_MAX = 2;

const args = process.argv.slice(2);
const flag = (name: string, fallback?: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1]! : fallback;
};
const shots = flag('shots');
const widths = (flag('widths', '1440,1024') ?? '').split(',').map((w) => Number(w.trim()));

const failures: string[] = [];
const check = (ok: boolean, label: string, detail = '') => {
  console.log(`  [${ok ? 'ok  ' : 'FAIL'}] ${label}${detail ? `  — ${detail}` : ''}`);
  if (!ok) failures.push(`${label}${detail ? ` — ${detail}` : ''}`);
};

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
};

/**
 * Boot a dev server of our own and PROVE it is the right one.
 *
 * The first version scraped the first `http://localhost:<port>` out of the child's output and
 * trusted it. It attached to an unrelated dev server already running on this machine, and because
 * `resolves` only asked "is there an `h1`", eight routes reported ok against a page whose heading
 * read "No such screen". A check that passes on the wrong application is worse than no check, so
 * the port is now fixed and explicit, and the served HTML has to identify itself before anything is
 * measured.
 */
async function startServer(port: number): Promise<{ base: string; stop: () => void }> {
  const child = spawn('bunx', ['--bun', 'vite', '--port', String(port), '--strictPort'], {
    cwd: new URL('../apps/redaktion', import.meta.url).pathname,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, BROWSER: 'none' },
  });
  child.stderr.on('data', (c: Buffer) => process.stderr.write(c));
  const base = `http://localhost:${port}`;

  const deadline = Date.now() + 60_000;
  for (;;) {
    if (Date.now() > deadline) {
      child.kill();
      throw new Error(`the dev server did not answer on ${base} within 60 s`);
    }
    try {
      const html = await fetch(`${base}/`).then((r) => r.text());
      if (html.includes('<title>Redaktion · Deutsch-Atlas</title>')) break;
      child.kill();
      throw new Error(`something else is serving ${base} — free the port or pass --port`);
    } catch (error) {
      if (error instanceof Error && error.message.includes('something else')) throw error;
      await new Promise((r) => setTimeout(r, 300));
    }
  }
  return { base, stop: () => child.kill() };
}

async function measureRows(page: Page) {
  return page.evaluate(() => {
    const rows = [...document.querySelectorAll('tbody tr')];
    return {
      n: rows.length,
      heights: rows.map((r) => Math.round(r.getBoundingClientRect().height)),
      primaryMax: Math.max(0, ...rows.map((r) => r.querySelectorAll('a[data-primary="true"]').length)),
      anchorMax: Math.max(0, ...rows.map((r) => r.querySelectorAll('a').length)),
    };
  });
}

async function run(browser: Browser, base: string, width: number, offsite: string[]) {
  console.log(`  ---- ${width} px`);
  const ctx = await browser.newContext({ viewport: { width, height: 1000 } });
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem('da:redaktion-theme', 'dark');
    } catch {
      /* private mode */
    }
  });
  ctx.on('request', (r) => {
    if (!r.url().startsWith(base)) offsite.push(r.url());
  });
  const page = await ctx.newPage();

  for (const route of ROUTES) {
    await page.goto(`${base}/#/${route}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(400);

    const heading = (await page.locator('h1').count()) ? await page.locator('h1').first().innerText() : '';
    const missing = await page.getByText('Kein Thema mit der Kennung').count();
    check(!!heading && !missing, `${route} resolves`, heading.slice(0, 40));

    if (shots) {
      mkdirSync(shots, { recursive: true });
      await page.screenshot({ path: `${shots}/shot-${width}-${route.replace(/\//g, '-')}.png` });
    }

    const view = route.split('/')[0]!;
    if (!TABLE_VIEWS.has(view)) continue;
    const m = await measureRows(page);
    if (m.n < 5) continue;
    const mid = median(m.heights);
    const worst = Math.max(...m.heights);
    const ratio = mid ? worst / mid : 0;
    check(
      ratio <= RAGGEDNESS_MAX,
      `${route} row raggedness ≤ ${RAGGEDNESS_MAX}×`,
      `${worst}px worst / ${mid}px median = ${ratio.toFixed(2)}× over ${m.n} rows`,
    );
    // Counting *all* anchors cannot express this — an earlier version did, and could not tell a
    // row's own target from its cross-references. Hence `data-primary`.
    check(
      m.primaryMax <= 1,
      `${route} ≤ 1 primary link per row`,
      `max ${m.primaryMax} primary, ${m.anchorMax} anchors total`,
    );
  }

  // 4. The classes that exist only in `packages/ui`. Sprachkarte mounts all three.
  await page.goto(`${base}/#/sprachkarte`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(400);
  const resolved = await page.evaluate(() => {
    const panel = document.querySelector('section.rounded-lg.border');
    const dl = document.querySelector('dl');
    const callout = [...document.querySelectorAll('section')].find((s) =>
      s.className.includes('shadow-[inset_4px'),
    );
    return {
      panelPad: panel ? parseFloat(getComputedStyle(panel).paddingTop) : -1,
      statCols: dl ? getComputedStyle(dl).gridTemplateColumns.split(' ').length : -1,
      calloutRule: callout ? getComputedStyle(callout).boxShadow !== 'none' : false,
    };
  });
  check(resolved.panelPad >= 16, 'Panel padding resolved', `${resolved.panelPad}px`);
  check(resolved.calloutRule, 'Callout rule resolved');
  check(resolved.statCols >= 2, 'StatGroup is multi-column', `${resolved.statCols} cols`);

  // 2. A filter that cannot be linked to is one the reader has to rebuild by hand.
  await page.goto(`${base}/#/${PERMALINK}`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(400);
  const before = await page.locator('tbody tr').count();
  await page.reload();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(400);
  const after = await page.locator('tbody tr').count();
  check(before === after && before > 0, 'permalink survives reload', `${before} rows before, ${after} after`);

  await ctx.close();
}

const server = await startServer(Number(flag('port', '4391')));
const browser = await chromium.launch();
const offsite: string[] = [];
try {
  for (const width of widths) await run(browser, server.base, width, offsite);
  check(!offsite.length, 'no request leaves the origin', [...new Set(offsite)].slice(0, 3).join(', '));
} finally {
  await browser.close();
  server.stop();
}

console.log();
if (failures.length) {
  console.log(`${failures.length} FAILED:`);
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
console.log('all checks passed');
