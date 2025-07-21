# Firebase Setup Guide

This guide will help you set up Firebase authentication and hosting for your "This Is" app.

## Prerequisites

1. Node.js and npm installed
2. A Google account
3. Firebase CLI installed globally: `npm install -g firebase-tools`

## Step 1: Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Create a project" or "Add project"
3. Enter a project name (e.g., "this-is-app")
4. Choose whether to enable Google Analytics (recommended)
5. Click "Create project"

## Step 2: Enable Authentication

1. In your Firebase project console, go to "Authentication" in the left sidebar
2. Click "Get started"
3. Go to the "Sign-in method" tab
4. Enable "Email/Password" authentication
5. Click "Save"

## Step 3: Get Firebase Configuration

1. In your Firebase project console, click the gear icon (⚙️) next to "Project Overview"
2. Select "Project settings"
3. Scroll down to "Your apps" section
4. Click the web icon (</>)
5. Register your app with a nickname (e.g., "this-is-web")
6. Copy the Firebase configuration object

## Step 4: Set Up Environment Variables

1. Copy `env.example` to `.env.local`
2. Replace the placeholder values with your actual Firebase configuration:

```env
VITE_FIREBASE_API_KEY=your-actual-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=your-app-id
```

## Step 5: Initialize Firebase Hosting

1. Run the Firebase initialization:
   ```bash
   npm run firebase:init
   ```

2. When prompted:
   - Select "Hosting"
   - Choose "Use an existing project" and select your Firebase project
   - Set public directory to `dist`
   - Configure as single-page app: `Yes`
   - Don't overwrite `index.html`: `No`

## Step 6: Test Locally

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Test authentication by creating an account and signing in

## Step 7: Deploy to Firebase Hosting

1. Build the project:
   ```bash
   npm run build
   ```

2. Deploy to Firebase:
   ```bash
   npm run firebase:deploy
   ```

3. Your app will be available at `https://your-project-id.web.app`

## Development with Firebase Emulators (Optional)

For local development with Firebase services:

1. Install Firebase emulators:
   ```bash
   firebase init emulators
   ```

2. Start emulators:
   ```bash
   firebase emulators:start
   ```

3. The app will automatically connect to emulators in development mode

## Troubleshooting

### Common Issues

1. **Authentication not working**: Make sure you've enabled Email/Password authentication in Firebase Console
2. **Build errors**: Check that all environment variables are set correctly
3. **Deployment fails**: Ensure you're logged into Firebase CLI (`firebase login`)

### Environment Variables

Make sure your `.env.local` file is in the root directory and contains all required Firebase configuration values.

### Firebase CLI Commands

- `firebase login` - Log in to Firebase
- `firebase projects:list` - List your Firebase projects
- `firebase use <project-id>` - Switch to a different project
- `firebase serve` - Serve locally with Firebase hosting
- `firebase deploy` - Deploy to Firebase hosting

## Security Rules

For production, you'll want to set up Firestore security rules. Basic rules for development:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

## Next Steps

1. Set up Firestore database for storing user data, posts, and lists
2. Configure Firebase Storage for image uploads
3. Set up proper security rules
4. Add social authentication (Google, Facebook, etc.)
5. Implement email verification
6. Set up password reset functionality

## Support

If you encounter issues:
1. Check the [Firebase Documentation](https://firebase.google.com/docs)
2. Review the [Firebase Console](https://console.firebase.google.com/) for project settings
3. Check the browser console for error messages 