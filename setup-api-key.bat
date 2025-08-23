@echo off
echo Setting up Google Maps API Key for Firebase Functions...
firebase functions:secrets:set GOOGLE_MAPS_API_KEY
echo.
echo API Key has been set! Now deploy the functions:
echo firebase deploy --only functions:suggestPlaces
echo.
pause
