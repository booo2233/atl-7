// Measures render time, draw calls and triangles at a few film times.
// Usage: node tools/bench.mjs [width] [height]
import { chromium } from 'playwright';
import { startServer } from './serve.mjs';
const server = await startServer(0);
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu-watchdog'] });
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('ERR', e.message));
await page.goto(`http://127.0.0.1:${server.address().port}/index.html?mode=render&w=${process.argv[2]||480}&h=${process.argv[3]||270}&${process.argv[4]||''}`);
await page.waitForFunction('window.FILM_READY === true || window.FILM_ERROR', null, { timeout: 0 });
for (const T of [0.2, 0.5, 0.96]) {
  await page.evaluate((t) => FILM_API.renderT(t), T);
  const t0 = Date.now(); await page.evaluate((t) => FILM_API.renderT(t), T); const ms = Date.now() - t0;
  console.log(T, ms, 'ms', JSON.stringify(await page.evaluate(() => FILM_API.stats())));
}
await browser.close(); server.close();
