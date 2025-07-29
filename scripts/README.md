# 🔥 Firebase Database Setup for "this-is" App

This directory contains scripts to set up and manage your Firebase database for the intelligent search and discovery system.

## 🚀 Quick Start

### 1. Install Dependencies
```bash
cd scripts
npm install
```

### 2. Configure Environment
Create a `.env` file in your project root with your Firebase configuration:

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

### 3. Set Up Firebase
```bash
npm run setup
```

### 4. Seed Database with Mock Data
```bash
npm run seed
```

## 📋 Available Scripts

### Core Setup
- **`npm run setup`** - Complete Firebase setup (rules, indexes, verification)
- **`npm run seed`** - Populate database with realistic mock data
- **`npm run clear`** - Clear all data from database (⚠️ destructive)

### Deployment
- **`npm run deploy-rules`** - Deploy Firestore security rules
- **`npm run deploy-indexes`** - Deploy Firestore indexes

### Management
- **`npm run backup`** - Create database backup
- **`npm run restore`** - Restore from backup

## 🗃️ Database Structure

The seeding script creates the following data structure:

### Collections
- **👥 users** (25 users) - User profiles with preferences and social connections
- **🏢 places** (150 places) - Restaurants, cafes, bars, and other venues
- **📝 lists** (75 lists) - Curated lists of places created by users
- **📸 posts** (300 posts) - User posts about places they've visited
- **⚙️ userPreferences** - AI-generated user preferences for personalization
- **📊 analytics** - User interaction tracking for algorithm improvement

### User Relationships
- **Friends** - Mutual friendships between users
- **Following** - One-way following relationships
- **Saved Places** - Places users have saved with notes
- **Activity History** - User interaction logs

## 🧠 Intelligent Search Features

The mock data is designed to showcase:

### 🔍 **Natural Language Search**
- "Sara's favorite coffee shops" → Finds friend Sara's saved coffee places
- "cozy work-friendly spots" → Uses tags and sentiment analysis
- "date night restaurants" → Leverages list categories and user preferences

### 🤝 **Social Intelligence**
- Friend connections influence search results
- Social proof through shared lists and recommendations
- User preference learning from behavior patterns

### 📍 **Location Awareness**
- Geographic clustering around San Francisco neighborhoods
- Proximity-based recommendations
- Area preference learning

### 🎯 **Personalization**
- User behavior analysis (saved places, liked posts)
- Category preferences derived from interactions
- Social pattern recognition (explorer vs. follower)

## 🛡️ Security Rules

The Firebase security rules ensure:
- Users can only access their own private data
- Public content is visible to authenticated users
- Friends-only content requires friendship verification
- Analytics data is write-only for users

## 📊 Performance Optimization

### Firestore Indexes
Automatically created indexes for:
- **Search queries** - category + popularity, tags + popularity
- **Social queries** - user relationships, activity feeds
- **Analytics** - user interactions by timestamp
- **Recommendations** - place popularity, list engagement

### Caching Strategy
- **Search results** - 5-minute cache for repeated queries
- **User preferences** - In-memory cache with automatic refresh
- **Social connections** - Cached during session

## 🔧 Advanced Configuration

### Custom Data Generation
Modify `seed-database.js` to customize:
```javascript
// Adjust data volume
const { users, userIds } = generateUsers(50)     // More users
const { places, placeIds } = generatePlaces(300) // More places

// Customize categories
const categories = ['coffee', 'restaurant', 'bar', ...yourCategories]

// Adjust geographic area
const locations = [
  { name: 'Your City', lat: 40.7128, lng: -74.0060 },
  // Add your locations
]
```

### Environment-Specific Setup
```bash
# Development with Firebase emulator
VITE_USE_FIREBASE_EMULATORS=true npm run seed

# Production deployment
firebase use your-prod-project
npm run deploy-rules
npm run deploy-indexes
npm run seed
```

## 🧪 Testing the System

After setup, test the intelligent search:

### 1. Basic Search
- Go to `/search` in your app
- Try queries like "coffee", "cozy cafe", "date night"
- Notice AI ranking and scoring

### 2. Natural Language
- "Mike's favorite restaurants" (looks for user Mike's saves)
- "work-friendly coffee with wifi" (uses tags and categories)
- "trendy bars in Mission" (location + category + sentiment)

### 3. Discovery
- Go to `/discovery` tab
- See personalized recommendations based on mock user preferences
- Notice social signals and algorithm attribution

### 4. Social Features
- Search results prioritize friends' recommendations
- Lists show social proof (likes, saves)
- User profiles display influence scores

## 🐛 Troubleshooting

### Database Connection Issues
```bash
# Check Firebase project status
firebase projects:list

# Verify authentication
firebase login

# Test Firestore access
firebase firestore:indexes
```

### Seeding Problems
```bash
# Clear and retry
npm run clear
npm run seed

# Check permissions
# Ensure your Firebase user has Firestore write access
```

### Rule Deployment Errors
```bash
# Validate rules syntax
firebase firestore:rules

# Deploy with verbose output
firebase deploy --only firestore:rules --debug
```

## 📈 Data Analytics

The system tracks user interactions for continuous improvement:

### Tracked Events
- **Search queries** - For improving NLP algorithms
- **Place saves** - For preference learning
- **List views** - For recommendation engines
- **Post likes** - For social signal analysis

### Privacy
- All analytics respect user privacy settings
- Data is anonymized for algorithm training
- Users can opt out through app settings

## 🚀 Production Deployment

### Security Checklist
- [ ] Update security rules for production
- [ ] Enable Firebase App Check
- [ ] Set up monitoring and alerts
- [ ] Configure backup schedules
- [ ] Review data retention policies

### Performance Monitoring
- [ ] Enable Firestore monitoring
- [ ] Set up performance alerts
- [ ] Monitor query performance
- [ ] Track search latency metrics

---

## 🎉 Next Steps

Once your database is set up:

1. **Test the intelligent search** - Try various query types
2. **Customize the algorithms** - Adjust scoring weights in `searchAlgorithm.ts`
3. **Add real user authentication** - Connect to Firebase Auth
4. **Monitor performance** - Set up analytics and logging
5. **Scale the data** - Add more places and users as needed

Your intelligent search system is now ready to provide a sophisticated, AI-powered discovery experience! 🚀 