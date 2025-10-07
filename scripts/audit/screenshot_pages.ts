#!/usr/bin/env ts-node

/**
 * Capture screenshots of main pages using Playwright
 * 
 * Captures: Home, Explore, Hub (sample), List (sample)
 * Output: docs/status/screenshots/*.png
 * Viewport: Mobile (375x667)
 */

import * as fs from 'fs';
import * as path from 'path';

const OUTPUT_DIR = path.join(process.cwd(), 'docs', 'status', 'screenshots');

// Check if Playwright is installed
let playwright: any;
try {
  playwright = require('playwright');
} catch (error) {
  console.error('❌ Playwright not installed!');
  console.log('\n📦 Install with:');
  console.log('   npm install -D playwright');
  console.log('   npx playwright install');
  console.log('\nFor now, creating placeholder TODO file...\n');
  
  // Create TODO file
  const todoPath = path.join(process.cwd(), 'docs', 'status', 'SCREENSHOT_TODO.md');
  fs.writeFileSync(todoPath, `# Screenshot Capture TODO

## Prerequisites

Install Playwright:
\`\`\`bash
npm install -D playwright
npx playwright install
\`\`\`

## Run Screenshot Capture

\`\`\`bash
npm run status:screens
\`\`\`

## Manual Screenshot Instructions

If automated capture fails, manually capture these pages:

1. **Home** (/)
   - Viewport: 375x667 (mobile)
   - Save as: docs/status/screenshots/home-mobile.png

2. **Explore** (/explore)
   - Viewport: 375x667 (mobile)
   - Save as: docs/status/screenshots/explore-mobile.png

3. **Place Hub** (/place/:id) - Use any sample place
   - Viewport: 375x667 (mobile)
   - Save as: docs/status/screenshots/hub-mobile.png

4. **List View** (/list/:id) - Use any sample list
   - Viewport: 375x667 (mobile)
   - Save as: docs/status/screenshots/list-mobile.png

## Tips

- Use Chrome DevTools Device Mode for consistent viewport
- Clear cache and cookies before capturing
- Ensure auth state is set (logged in)
- Wait for all images to load
`);
  
  console.log(`✅ Created TODO file: ${todoPath}`);
  process.exit(1);
}

const PAGES = [
  { name: 'home', path: '/', filename: 'home-mobile.png' },
  { name: 'explore', path: '/explore', filename: 'explore-mobile.png' },
  // Note: Hub and List need actual IDs, which would come from database
  // For now, we'll create placeholders
];

async function captureScreenshots() {
  console.log('📸 Starting screenshot capture...');
  
  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  
  const browser = await playwright.chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 375, height: 667 }, // iPhone SE size
    deviceScaleFactor: 2,
  });
  
  const page = await context.newPage();
  
  // Get base URL from env or use default
  const baseUrl = process.env.VITE_APP_URL || 'http://localhost:5173';
  
  console.log(`🌐 Base URL: ${baseUrl}`);
  
  for (const pageConfig of PAGES) {
    try {
      console.log(`\n📷 Capturing ${pageConfig.name}...`);
      
      const url = `${baseUrl}${pageConfig.path}`;
      await page.goto(url, { waitUntil: 'networkidle' });
      
      // Wait for content to load
      await page.waitForTimeout(2000);
      
      const outputPath = path.join(OUTPUT_DIR, pageConfig.filename);
      await page.screenshot({ path: outputPath, fullPage: true });
      
      console.log(`   ✅ Saved: ${outputPath}`);
    } catch (error) {
      console.error(`   ❌ Failed to capture ${pageConfig.name}:`, error);
    }
  }
  
  await browser.close();
  
  console.log('\n✅ Screenshot capture complete!');
  console.log(`📁 Output directory: ${OUTPUT_DIR}`);
}

// Check if server is running
async function checkServer() {
  const baseUrl = process.env.VITE_APP_URL || 'http://localhost:5173';
  
  try {
    const response = await fetch(baseUrl);
    if (!response.ok) {
      throw new Error(`Server returned ${response.status}`);
    }
    return true;
  } catch (error) {
    console.error(`\n❌ Development server not running at ${baseUrl}`);
    console.log('\n🚀 Start server with:');
    console.log('   npm run dev');
    console.log('\nThen run this script again.\n');
    return false;
  }
}

// Main execution
(async () => {
  const serverRunning = await checkServer();
  if (!serverRunning) {
    process.exit(1);
  }
  
  await captureScreenshots();
  process.exit(0);
})();

