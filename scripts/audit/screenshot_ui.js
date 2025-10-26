/**
 * Screenshot UI pages for status reporting
 * Uses Playwright if installed, otherwise creates placeholders.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SCREENSHOT_DIR = path.join(__dirname, '../../docs/ui-status/screenshots');
const PAGES = [
  { name: 'home', url: '/', viewport: { width: 375, height: 812 }, readySelector: '[data-page="home"][data-page-ready="true"]' },
  { name: 'explore', url: '/explore', viewport: { width: 375, height: 812 } },
  { name: 'hub', url: '/hub/test-id', viewport: { width: 375, height: 812 } },
  { name: 'list', url: '/list/test-id', viewport: { width: 375, height: 812 } },
  { name: 'profile', url: '/profile', viewport: { width: 375, height: 812 } }
];

async function captureScreenshots() {
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }

  let playwright;
  try {
    playwright = await import('playwright');
  } catch (error) {
    console.log('[screenshot] Playwright not installed. Creating placeholder screenshots...');
    createPlaceholders();
    return;
  }

  console.log('[screenshot] Starting capture run...');

  const browser = await playwright.chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 375, height: 812 },
    deviceScaleFactor: 2
  });

  for (const page of PAGES) {
    try {
      const browserPage = await context.newPage();

      await browserPage.addInitScript(() => {
        try {
          window.localStorage.setItem('__screenshot_mode', 'true');
        } catch {}
      });

      const url = `http://localhost:5173${page.url}`;
      console.log(`[screenshot] Capturing ${page.name} from ${url}`);

      const screenshotUrl = `${url}${url.includes('?') ? '&' : '?'}screenshot=true`;
      await browserPage.goto(screenshotUrl, {
        waitUntil: 'networkidle',
        timeout: 60000
      });

      await browserPage.waitForFunction(() => document.readyState === 'complete', { timeout: 15000 }).catch(() => {});
      await browserPage.waitForLoadState('networkidle').catch(() => {});

      if (page.readySelector) {
        await browserPage.waitForSelector(page.readySelector, { timeout: 20000 }).catch(() => {});
      }

      await browserPage.waitForFunction(() => {
        const main = document.querySelector('main');
        return !!main && main.textContent && main.textContent.trim().length > 0;
      }, { timeout: 20000 }).catch(() => {});

      await browserPage.waitForTimeout(800);

      await browserPage.evaluate(async () => {
        const scrollable = document.querySelector('[data-scroll-root]') || document.scrollingElement || document.body;
        if (!scrollable) return;
        const maxScroll = scrollable.scrollHeight - scrollable.clientHeight;
        if (maxScroll <= 0) return;
        const step = Math.max(Math.floor(maxScroll / 4), 240);
        for (let pos = 0; pos <= maxScroll; pos += step) {
          scrollable.scrollTo({ top: pos, behavior: 'instant' });
          await new Promise(resolve => setTimeout(resolve, 420));
        }
        scrollable.scrollTo({ top: Math.max(maxScroll * 0.12, 0), behavior: 'instant' });
      });

      await browserPage.waitForTimeout(800);

      await browserPage.evaluate(async () => {
        const pending = Array.from(document.images).filter(img => !img.complete);
        await Promise.all(
          pending.map(
            img =>
              new Promise(resolve => {
                if (img.complete) return resolve(undefined);
                const done = () => resolve(undefined);
                img.addEventListener('load', done, { once: true });
                img.addEventListener('error', done, { once: true });
                setTimeout(done, 3500);
              })
          )
        );
      });

      await browserPage.evaluate(() => {
        const scrollable = document.querySelector('[data-scroll-root]') || document.scrollingElement || document.body;
        if (scrollable) scrollable.scrollTo({ top: 0, behavior: 'instant' });
      });

      const outputPath = path.join(SCREENSHOT_DIR, `${page.name}.png`);
      await browserPage.screenshot({
        path: outputPath,
        fullPage: true
      });

      console.log(`[screenshot] Saved ${page.name}.png`);
      await browserPage.close();
    } catch (error) {
      console.error(`[screenshot] Failed to capture ${page.name}:`, error.message);
      createPlaceholder(page.name);
    }
  }

  await browser.close();
  console.log('[screenshot] Capture complete.');
}

function createPlaceholders() {
  for (const page of PAGES) {
    createPlaceholder(page.name);
  }

  const instructions = `# Screenshot Instructions

## Manual Capture

Since Playwright is not installed, please capture screenshots manually:

1. **Start the dev server**: \`npm run dev\`
2. **Open browser** to \`http://localhost:5173\`
3. **Set mobile viewport**: 375x812 (iPhone X)
4. **Capture each page**:
   - Home: \`/\`
   - Explore: \`/explore\`
   - Hub: \`/hub/<any-id>\`
   - List: \`/list/<any-id>\`
   - Profile: \`/profile\`
5. **Save as PNG** to this directory with names: \`home.png\`, \`explore.png\`, \`hub.png\`, \`list.png\`, \`profile.png\`

## Automated Capture (Recommended)

Install Playwright and run:

\`\`\`bash
npm install -D playwright
npx playwright install chromium
npm run dev  # Start server in one terminal
npm run status:ui  # Run in another terminal
\`\`\`

---

*Placeholder files (PLACEHOLDER_*.txt) will be replaced automatically when real screenshots are captured.*
`;

  fs.writeFileSync(path.join(SCREENSHOT_DIR, 'INSTRUCTIONS.md'), instructions, 'utf8');
  console.log('[screenshot] Placeholder screenshots created. See INSTRUCTIONS.md for manual capture.');
}

function createPlaceholder(pageName) {
  const placeholderPath = path.join(SCREENSHOT_DIR, `PLACEHOLDER_${pageName}.txt`);
  const content = `This is a placeholder for ${pageName}.png

To capture real screenshots:
1. Install Playwright: npm install -D playwright
2. Install browser: npx playwright install chromium
3. Start dev server: npm run dev
4. Run: npm run status:ui

Or capture manually:
1. Open http://localhost:5173 in Chrome
2. Set viewport to 375x812 (iPhone X)
3. Navigate to the ${pageName} page
4. Take screenshot and save as ${pageName}.png in docs/ui-status/screenshots/
`;
  fs.writeFileSync(placeholderPath, content, 'utf8');
  console.log(`[screenshot] Created placeholder for ${pageName}`);
}

captureScreenshots().catch(error => {
  console.error('Screenshot capture failed:', error);
  process.exit(1);
});

export { captureScreenshots };
