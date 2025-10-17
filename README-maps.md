Maps Feature Skeleton

- Endpoint: POST /mapsNearby
  - Body: { bounds: { north, south, east, west }, types?: string[], clientKey?: string }
  - Response: { places: Array<{ id, name, address, primaryType, photos: {name}[] }> }
  - Field mask: places.id,places.displayName,places.formattedAddress,places.primaryType,places.photos.name
  - Server cache: Firestore collection `mapsCells/{encodedKey}` with TTL 24h
    - Key: `map:${north}:${south}:${east}:${west}|${typesSorted}` rounded to 2 decimals

- Client Caching
  - LocalStorage key: `map:${cellId}` where cellId matches server key without types
  - TTL: 24h
  - Throttling: 1 request per 750ms; max 2 in flight; paused while dragging

- Autocomplete Sessions
  - Use placesAdapter with generated tokens; debounce 300ms; <= 3 calls per session

- Clustering
  - To be added: grid-based client clustering atop returned places (no extra API calls)

