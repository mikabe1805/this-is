# PLACES API (NEW) - Setup Instructions

## Step 1: Create .env file
Copy these variables to your .env file:

VITE_PLACES_NEW_KEY=YOUR_NEW_API_KEY_HERE
VITE_PLACES_ENABLED=true
VITE_PLACES_PHOTOS_ENABLED=false  # Start at dollar 0/day
VITE_DAILY_GOOGLE_PHOTO_LIMIT=10
VITE_GOOGLE_MAPS_API_KEY=YOUR_LEGACY_KEY_HERE

## Step 2: API Key Restrictions
In Google Cloud Console, set:
- HTTP referrers: https://this-is-76332.web.app, http://localhost:*
- API restrictions: Maps JavaScript, Places API (New), Geocoding

## Step 3: Set Quotas
In Console -> Places API (New) -> Quotas:
- places.get: 25/day
- places.searchText: 50/day
- places.searchNearby: 50/day
- places.photos.get: 10/day (or 0 for dollar 0/day mode)
