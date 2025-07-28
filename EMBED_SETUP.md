# Real Embed Functionality Setup

## Overview
The embed functionality now uses **real algorithmic implementations** instead of mock data. It extracts actual content from:

- **Instagram** posts/reels (via oEmbed API)
- **TikTok** videos (via oEmbed API)  
- **YouTube** videos (via oEmbed API)
- **Twitter/X** posts (via oEmbed API)
- **Any website** (via Open Graph/meta tag extraction)

## Architecture

### Backend (Firebase Functions)
- `extractEmbed` - HTTP function for direct API calls
- `extractEmbedCallable` - Callable function for authenticated users
- Real-time content extraction with fallback handling
- CORS support for web apps

### Frontend (React)
- Calls Firebase Functions for server-side processing
- Automatic platform detection from URLs
- Comprehensive error handling with fallbacks
- Legacy compatibility for existing UI components

## Setup Instructions

### 1. Install Dependencies
```bash
cd functions
npm install
```

### 2. Configure Firebase Project
Update the function URL in `src/utils/embedUtils.ts`:
```typescript
// Replace 'your-project-id' with your actual Firebase project ID
const functionUrl = import.meta.env.DEV && import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true'
  ? 'http://localhost:5001/your-project-id/us-central1/extractEmbed'
  : `https://us-central1-${import.meta.env.VITE_FIREBASE_PROJECT_ID}.cloudfunctions.net/extractEmbed`
```

### 3. Deploy Functions
```bash
# Build and deploy to Firebase
cd functions
npm run build
npm run deploy

# Or deploy just functions
firebase deploy --only functions
```

### 4. Environment Variables (Optional)
For Instagram API access with more quota, add to Firebase Functions config:
```bash
firebase functions:config:set instagram.access_token="YOUR_INSTAGRAM_ACCESS_TOKEN"
```

### 5. Local Development
To test locally with emulators:
```bash
# Start Firebase emulators
firebase emulators:start

# In your .env.local file:
VITE_USE_FIREBASE_EMULATORS=true
```

## API Capabilities

### Instagram
- ✅ Public posts and reels
- ✅ Author information  
- ✅ Thumbnail extraction
- ✅ Content descriptions
- ⚠️ Limited by Instagram's public API

### TikTok  
- ✅ Public videos
- ✅ Creator information
- ✅ Video thumbnails
- ✅ Title extraction

### YouTube
- ✅ All public videos
- ✅ Channel information
- ✅ High-quality thumbnails
- ✅ Full video metadata

### General Websites
- ✅ Open Graph meta tags
- ✅ Twitter Card data
- ✅ Page titles and descriptions
- ✅ Featured images
- ✅ Author information

## Error Handling

The system has multiple fallback layers:

1. **Primary**: Firebase callable function
2. **Secondary**: Direct HTTP function call
3. **Tertiary**: Basic URL parsing with domain info
4. **UI**: Graceful error display with retry options

## Usage Examples

### Instagram
```
https://www.instagram.com/p/ABC123/
https://www.instagram.com/reel/XYZ789/
```

### TikTok
```
https://www.tiktok.com/@username/video/1234567890
https://vm.tiktok.com/ABC123/
```

### YouTube
```
https://www.youtube.com/watch?v=dQw4w9WgXcQ
https://youtu.be/dQw4w9WgXcQ
```

### Any Website
```
https://example.com/article
https://news.site.com/story
```

## Cost Considerations

- Firebase Functions: Pay per invocation (~$0.40/million calls)
- Bandwidth: Minimal (only fetching metadata, not media files)
- External APIs: Instagram/TikTok oEmbed is free with rate limits
- Storage: No additional storage used

## Limitations

1. **Instagram**: Public content only, rate limited
2. **TikTok**: Public content only, some geographic restrictions
3. **Private content**: Cannot access private posts/videos
4. **Rate limits**: Dependent on platform APIs
5. **CORS**: Some websites block scraping

## Next Steps

1. **Instagram Business API**: For higher limits and private content
2. **Caching**: Implement Redis/Firestore caching for repeated URLs
3. **Batch processing**: Handle multiple URLs in single function call
4. **Analytics**: Track most embedded platforms and success rates
5. **Content moderation**: Filter inappropriate content

## Troubleshooting

### Function not found
- Ensure functions are deployed: `firebase deploy --only functions`
- Check Firebase console for deployment status

### CORS errors
- Verify CORS configuration in function
- Check browser network tab for actual error

### Rate limiting
- Instagram/TikTok APIs have rate limits
- Implement exponential backoff for retries

### Emulator issues
- Ensure emulators are running: `firebase emulators:start`
- Check `VITE_USE_FIREBASE_EMULATORS=true` in `.env.local` 