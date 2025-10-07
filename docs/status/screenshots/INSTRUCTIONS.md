# Screenshot Instructions

## Manual Capture (Recommended)

Since Playwright isn't installed, please capture screenshots manually:

### Setup
1. Open your app in Chrome DevTools Device Mode
2. Set viewport to **375x667** (iPhone SE)
3. Ensure you're logged in
4. Clear cache and reload

### Pages to Capture


1. **Home** (`/`)
   - Navigate to: /
   - Wait for all content to load
   - Screenshot → Save as: `docs/status/screenshots/home-mobile.png`
   - Shows: Popular Nearby, Trending Tags, Lists


2. **Explore** (`/explore`)
   - Navigate to: /explore
   - Wait for all content to load
   - Screenshot → Save as: `docs/status/screenshots/explore-mobile.png`
   - Shows: Nearby | Following | Discover tabs


3. **Place Hub** (`/place/:id`)
   - Navigate to: /place/:id
   - Wait for all content to load
   - Screenshot → Save as: `docs/status/screenshots/hub-mobile.png`
   - Shows: Cover image, tabs, action bar


4. **List View** (`/list/:id`)
   - Navigate to: /list/:id
   - Wait for all content to load
   - Screenshot → Save as: `docs/status/screenshots/list-mobile.png`
   - Shows: List header, places, map tab


### Tips
- Use full-page screenshots (not just viewport)
- Ensure images are fully loaded before capturing
- Use consistent viewport size for all screenshots
- Save as PNG (not JPG)

## Automated Capture (Optional)

If you want automated screenshots:

```bash
# Install Playwright
npm install -D playwright
npx playwright install chromium

# Start dev server
npm run dev

# In another terminal
npm run status:screens
```

---

**After capturing screenshots**, run:
```bash
npm run status:update
```

This will update the status README with your screenshot links.
