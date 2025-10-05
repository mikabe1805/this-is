### Build and deployment pipeline

- Vite build
  - Config: vite.config.ts 1-7 (react plugin)
  - Scripts: package.json 6-10 (dev, build, lint, preview)
  - Entry: src/main.tsx 1-13, src/App.tsx

- TailwindCSS
  - Config: tailwind.config.cjs 1-229
  - PostCSS: postcss.config.js 1-6
  - Styles entry: src/index.css 1-6

- Firebase Hosting + Functions
  - firebase.json hosting: 1-38 (public=dist, rewrites 9-26, headers 27-37)
  - Functions codebase: firebase.json 69-88 (predeploy 80-85)
  - Functions build: functions/package.json 3-11 (build, serve, deploy)

- Emulators (optional)
  - Firestore/Auth/Storage/Functions emulators toggle via env: src/firebase/config.ts 29-41

- Indexes and rules
  - Firestore rules: firestore.rules 1-141
  - Firestore indexes: firestore.indexes.json 1-181
  - Storage rules: storage.rules 1-53

- Scripts for DB setup/seed
  - Root scripts: package.json 14-19 (db:setup, db:seed, db:deploy)
  - scripts/package.json 6-18 (seed, normalize, enrich, deploy rules/indexes)

GAP: CI configuration not found. If added, include under `.github/workflows/` referencing npm run build and Firebase deploy.
