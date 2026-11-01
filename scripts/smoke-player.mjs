// After a deploy: open a real lesson and check the YouTube player actually loads.
// Usage: node scripts/smoke-player.mjs https://preview-url   (needs the playwright package)
import { chromium } from 'playwright';

const base = process.argv[2].replace(/\/$/, '');
const { courses } = await (await fetch(`${base}/catalog.json`)).json();
const course = courses.find((c) => c.lessons.some((l) => l.yt));
if (!course) { console.log('No lesson with a video; skipping.'); process.exit(0); }
const url = `${base}/courses/${course.id}/${course.lessons.find((l) => l.yt).slug}/`;

const browser = await chromium.launch();
const page = await browser.newPage();
const problems = [];
page.on('console', (m) => m.type() === 'error' && problems.push(`console: ${m.text()}`));
page.on('pageerror', (e) => problems.push(`page error: ${e.message}`));
await page.exposeFunction('reportCsp', (v) => problems.push(`CSP blocked ${v}`));
await page.addInitScript(() => document.addEventListener('securitypolicyviolation', (e) => window.reportCsp(`${e.violatedDirective}: ${e.blockedURI}`)));

// Visit once so the service worker installs and controls the page, like a returning visitor.
await page.goto(`${base}/`, { waitUntil: 'networkidle' });
await page.evaluate(() => navigator.serviceWorker?.ready);
console.log(`Opening ${url}`);
await page.goto(url, { waitUntil: 'networkidle' });
console.log(`Service worker in control: ${await page.evaluate(() => !!navigator.serviceWorker?.controller)}`);
if (await page.locator('button.play').count()) await page.click('button.play');
let ok = false;
try {
  const iframe = await page.waitForSelector('.player iframe', { timeout: 20000 });
  console.log(`Player iframe: ${await iframe.getAttribute('src')}`);
  const frame = await iframe.contentFrame();
  await frame.waitForSelector('video, .ytp-error', { timeout: 20000 });
  const error = await frame.locator('.ytp-error').count() ? await frame.locator('.ytp-error').innerText() : '';
  if (error) problems.push(`YouTube error: ${error.replace(/\s+/g, ' ')}`);
  else ok = true;
} catch (err) {
  const frame = await (await page.$('.player iframe'))?.contentFrame();
  const shown = frame ? (await frame.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 300) : '';
  // YouTube asks data-centre IPs (like CI runners) to sign in. Reaching that page with no errors
  // on our side means our page did its job; real visitors don't get this check.
  if (/confirm you.re not a bot/i.test(shown) && !problems.length) {
    console.log('YouTube bot check shown to the CI runner; our page loaded the player without errors.');
    ok = true;
  } else {
    problems.push(`player did not load: ${err.message.split('\n')[0]}`, `player shows: ${shown || '(nothing)'}`);
  }
}
console.log(problems.length ? problems.join('\n') : 'No problems found.');
await browser.close();
process.exit(ok ? 0 : 1);
