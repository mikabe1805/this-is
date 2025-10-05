### Dependencies

- App package.json (root): 1-49
  - Dependencies: @heroicons/react, dotenv, exif-js, firebase, firebase-admin, openai, react, react-dom, react-router-dom (lines 21-31)
  - Dev: @vitejs/plugin-react, tailwindcss, eslint, typescript, vite (lines 32-49)
- Functions package.json: functions/package.json 1-27
  - firebase-admin, firebase-functions, cheerio, cors (lines 16-21)
  - node engine 22 (lines 12-14)
- Scripts package.json: scripts/package.json 1-31
  - firebase-admin, dotenv, chalk, inquirer (lines 19-24)

Usage references
- Firebase client init: src/firebase/config.ts 8-17, 23-27, 31-41
- React Router: src/main.tsx 3, 9-11; src/App.tsx 296-311
- OpenAI (AI search): src/services/aiSearchService.ts 1-19, 26-43, 44-59
- Tailwind: tailwind.config.cjs 1-229; postcss.config.js 1-6; src/index.css 8-24, 26-58
- Firebase Functions endpoints used by client: firebase.json rewrites 9-21; src/services/firebaseDataService.ts 2250-2274 (suggestPlaces URL), 2276-2292 (geocodeLocation)

GAP: No third-party state management library; contexts used instead (src/contexts/*).
