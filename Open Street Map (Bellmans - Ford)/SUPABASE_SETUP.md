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
