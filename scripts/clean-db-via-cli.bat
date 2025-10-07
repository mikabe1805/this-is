@echo off
REM Delete all collections using Firebase CLI (Windows)
REM This uses your existing Firebase login

echo 🗑️  Deleting all Firestore collections...

firebase firestore:delete --all-collections --project this-is-76332 --yes

echo ✅ Database cleaned!

