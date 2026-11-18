# Supabase account setup

1. Create a Supabase project and run `supabase-setup.sql` in its SQL Editor.
2. Enable Email sign-in under **Authentication → Providers**. Configure the Site URL and allowed redirect URLs for the map's deployed HTTPS URL (and your local development URL).
3. Copy the project URL and its public anon/publishable key into `supabase-config.js`.
   Do not put a service-role key in the browser config.
4. Serve the map over HTTP(S), then open the **Account & history** panel to create an account or sign in. Email confirmation may be required, depending on the project's Authentication settings.

The profile stores a display name; Supabase Auth stores the email. While signed in, the map saves searches, map styles/themes, overlay changes, and selected OSM place details. The account panel shows the latest 100 activities and lets the user clear all saved history. Row-level security restricts profile and history access to the signed-in user.

## Run in browsers and install on desktop

The app runs in current Chrome, Firefox, and Brave. To enable offline app-shell caching and browser installation, serve this folder from `localhost` or HTTPS; opening `map.html` directly as a `file://` URL does not enable service workers. For a local test server, run `python -m http.server 8000` from this folder and open `http://localhost:8000/map.html`. Visit once while online so the browser can install the service worker and cache the app files. Chrome and Brave can install the site as a desktop app from the browser menu. Firefox supports the app and its offline shell, but desktop PWA installation is not built into standard Firefox desktop.

Offline mode preserves the app interface and local libraries. It does not include offline map tiles or offline search, routing, or live place data; those features require internet access.

## Traffic-aware routing

The map uses OSRM for ordinary route estimates when no Esri key is configured. Those estimates do not account for current traffic or road incidents. To enable Esri's traffic-aware route calculation, set an API key in `routing-config.js`:

```js
window.OSM_MAP_ROUTING_CONFIG = {
  esriApiKey: 'YOUR_RESTRICTED_ARCGIS_API_KEY'
};
```

Create a key with the routing/network-analysis privilege required by Esri's Route service, restrict it to this app's allowed referrers, and monitor its usage. For local testing with the command above, allow exactly `http://localhost:8000` as a referrer (no `/*` path wildcard). Keep the key only in your local `routing-config.js`; leave the repository's key blank and do not commit a populated key. Browser API keys are visible to users, so do not use a secret or unrestricted key. The app requests a route using the current start time and Esri's travel-time impedance; Esri uses live traffic where available and its published coverage table lists traffic-incident support for the Philippines. Traffic and incident feeds can be incomplete or delayed, and the route is not a guarantee that every temporary closure is known or avoided. Verify critical road conditions with local authorities.
