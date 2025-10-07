# Metrics & Analytics Specification

## Google Places API Events

Track these events to monitor API usage and cost:

### Autocomplete Events

```typescript
// Event: places_autocomplete_request
{
  event_name: 'places_autocomplete_request',
  input_length: number,           // Length of search query
  session_id: string,             // Session token ID (hashed)
  predictions_count: number,      // Number of results returned
  response_time_ms: number,       // API response time
  component: string,              // 'AddressAutocomplete' | 'GooglePlacesAutocomplete'
}

// Event: places_session_start
{
  event_name: 'places_session_start',
  session_id: string,
  component: string,
  timestamp: number,
}

// Event: places_session_end
{
  event_name: 'places_session_end',
  session_id: string,
  component: string,
  duration_ms: number,            // Session duration
  autocomplete_requests: number,  // Requests made during session
  details_requests: number,       // Details fetched
  timestamp: number,
}
```

### Place Details Events

```typescript
// Event: places_details_request
{
  event_name: 'places_details_request',
  place_id: string,               // Google Place ID
  cached: boolean,                // Was result from cache?
  session_id: string,             // Associated session
  response_time_ms: number,
  fields_requested: string[],     // Fields requested (for audit)
}

// Event: places_details_cache_hit
{
  event_name: 'places_details_cache_hit',
  place_id: string,
  session_id: string,
}
```

### Photo Events

```typescript
// Event: places_photo_request
{
  event_name: 'places_photo_request',
  place_id: string,
  max_size: number,               // 320, 640, 1024
  context: string,                // 'card' | 'hero' | 'fullscreen'
  visible: boolean,               // Was photo in viewport?
}
```

## UI Performance Events

Track these to monitor page load and interaction performance:

### Page Load Events

```typescript
// Event: page_load_complete
{
  event_name: 'page_load_complete',
  page: string,                   // 'home' | 'explore' | 'hub' | 'list'
  load_time_ms: number,           // Time to interactive
  api_calls_count: number,        // Firebase queries
  places_calls_count: number,     // Google Places calls
  images_loaded: number,
}

// Event: component_render_time
{
  event_name: 'component_render_time',
  component: string,              // Component name
  render_time_ms: number,
  props_size_bytes: number,       // Approximate data size
}
```

### Interaction Events

```typescript
// Event: autocomplete_interaction
{
  event_name: 'autocomplete_interaction',
  action: 'focus' | 'input' | 'select' | 'blur',
  input_length?: number,
  selected_index?: number,
  time_to_selection_ms?: number,  // Focus to selection
}

// Event: card_interaction
{
  event_name: 'card_interaction',
  card_type: 'place' | 'list' | 'post' | 'user',
  action: 'view' | 'click' | 'like' | 'save' | 'share',
  context: 'home' | 'explore' | 'search' | 'list',
}

// Event: tab_change
{
  event_name: 'tab_change',
  page: string,
  from_tab: string,
  to_tab: string,
  duration_on_tab_ms: number,
}
```

## Implementation Guide

### Adding Telemetry to places.ts

```typescript
// In src/services/google/places.ts

function trackEvent(eventName: string, data: Record<string, any>) {
  if (import.meta.env.DEV) {
    console.log(`[Telemetry] ${eventName}`, data);
  }
  
  // In production, send to analytics service
  // e.g., Firebase Analytics, Google Analytics, etc.
  if (import.meta.env.PROD && window.gtag) {
    window.gtag('event', eventName, data);
  }
}

export async function getPredictions(input: string, opts?: any) {
  const startTime = performance.now();
  const sessionId = sessionToken?.toString() || 'no-session';
  
  const predictions = await /* ... existing logic ... */;
  
  trackEvent('places_autocomplete_request', {
    input_length: input.length,
    session_id: sessionId,
    predictions_count: predictions.length,
    response_time_ms: performance.now() - startTime,
    component: 'AutocompleteService',
  });
  
  return predictions;
}
```

### Adding UI Performance Tracking

```typescript
// In src/pages/Home.tsx (example)

useEffect(() => {
  const startTime = performance.now();
  
  // After data loaded
  const loadComplete = () => {
    trackEvent('page_load_complete', {
      page: 'home',
      load_time_ms: performance.now() - startTime,
      api_calls_count: /* count from state */,
      places_calls_count: getTelemetry().autocomplete_requests,
    });
  };
  
  if (!loading) loadComplete();
}, [loading]);
```

## Cost Monitoring Alerts

Set up alerts in Google Cloud Console:

1. **Daily Cost Threshold**
   - Alert when cost > $10/day
   - Email + Slack notification

2. **Request Rate Spike**
   - Alert when autocomplete requests > 10,000/hour
   - Indicates potential abuse or bug

3. **Cache Miss Rate**
   - Alert when details cache hit rate < 50%
   - Indicates caching not working

## Reporting Dashboard

Create a simple dashboard that shows:

- **Today's Cost:** Real-time cost from Cloud Console API
- **Request Breakdown:** Pie chart (autocomplete, details, photos)
- **Top Sessions:** Users making most requests
- **Cache Performance:** Hit rate, size, evictions
- **Page Performance:** Load times by page

### Example Dashboard Query

```typescript
// Aggregate events from analytics
const last24Hours = {
  autocomplete_requests: count('places_autocomplete_request'),
  details_requests: count('places_details_request'),
  photo_requests: count('places_photo_request'),
  cache_hit_rate: count('places_details_cache_hit') / count('places_details_request'),
  avg_session_duration: avg('places_session_end.duration_ms'),
};

// Calculate estimated cost
const estimatedCost = 
  (last24Hours.autocomplete_requests * 0.00283) +
  (last24Hours.details_requests * 0.017) +
  (last24Hours.photo_requests * 0.007);
```

---

**Last Updated:** [AUTO-GENERATED]

