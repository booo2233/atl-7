// Smoke test of the interactive player: loads index.html in player mode,
// waits for the build, lets it play briefly and reports errors + a screenshot.
import { chromium } from 'playwright';
import { startServer } from './serve.mjs';
const server = await startServer(0);
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu-watchdog'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(`http://127.0.0.1:${server.address().port}/index.html?quality=fast`);
await page.waitForFunction('window.film !== undefined || window.FILM_ERROR', null, { timeout: 0 });
await page.waitForTimeout(4000);
await page.evaluate(() => { document.getElementById('scrub').value = '600'; document.getElementById('scrub').dispatchEvent(new Event('input')); });
await page.waitForTimeout(3000);
await page.evaluate(() => document.getElementById('play').click());
await page.waitForTimeout(8000);
await page.screenshot({ path: process.argv[2] || 'output/stills/player.png', timeout: 180000 });
console.log(JSON.stringify({ errors: errors.filter((e) => !e.includes('fonts.g')), ui: await page.evaluate(() => !document.getElementById('ui').hidden), time: await page.evaluate(() => document.getElementById('time').textContent) }));
await browser.close(); server.close();
