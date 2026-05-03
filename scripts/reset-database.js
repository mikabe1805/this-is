/**
 * NUCLEAR OPTION: Complete database reset via Firebase CLI.
 *
 * Uses `firebase firestore:delete --all-collections`, which authenticates
 * with the same login used by `firebase deploy` — no service account or
 * application-default-credentials setup required. Auth users are NOT
 * touched (Firestore data only).
 *
 * Usage:
 *   npm run db:reset                 # confirmation prompt
 *   npm run db:reset -- --yes        # skip prompt
 *
 * Prerequisite: `firebase login` (one time, already done if you can deploy).
 */

const { spawn } = require('child_process');
const readline = require('readline');

const args = new Set(process.argv.slice(2));
const SKIP_PROMPT = args.has('--yes') || args.has('-y');
const PROJECT_ID = process.env.VITE_FIREBASE_PROJECT_ID || 'this-is-76332';

function confirm() {
  if (SKIP_PROMPT) return Promise.resolve(true);
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(
      `\nThis will delete ALL Firestore data from project "${PROJECT_ID}".\nAuth users will be preserved.\nType the project ID to confirm: `,
      answer => {
        rl.close();
        resolve(answer.trim() === PROJECT_ID);
      }
    );
  });
}

function runFirebaseCLI() {
  return new Promise((resolve, reject) => {
    const child = spawn('firebase', [
      'firestore:delete',
      '--all-collections',
      '--project', PROJECT_ID,
      '--force',
      '--recursive',
    ], { stdio: 'inherit', shell: true });

    child.on('error', err => {
      if (err.code === 'ENOENT') {
        console.error('\n✗ Firebase CLI not found on PATH.');
        console.error('  Install: npm install -g firebase-tools');
        console.error('  Then:    firebase login');
      }
      reject(err);
    });
    child.on('exit', code => {
      if (code === 0) resolve();
      else reject(new Error(`firebase CLI exited with code ${code}`));
    });
  });
}

async function main() {
  console.log('\n  Database reset');
  console.log(`  Project: ${PROJECT_ID}`);

  const ok = await confirm();
  if (!ok) {
    console.log('Aborted.');
    process.exit(1);
  }

  console.log('\n→ Deleting all Firestore collections via firebase CLI…');
  try {
    await runFirebaseCLI();
    console.log('\n✓ Done. Firestore is empty.\n');
    process.exit(0);
  } catch (e) {
    console.error('\n✗ Reset failed:', e.message);
    process.exit(1);
  }
}

main();
