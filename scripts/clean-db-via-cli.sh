#!/bin/bash
# Delete all collections using Firebase CLI
# This uses your existing Firebase login

echo "🗑️  Deleting all Firestore collections..."

firebase firestore:delete --all-collections --project this-is-76332 --yes

echo "✅ Database cleaned!"

