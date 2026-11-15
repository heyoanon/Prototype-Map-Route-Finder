# Supabase account setup

1. Create a Supabase project and run `supabase-setup.sql` in its SQL Editor.
2. Enable Email sign-in under **Authentication → Providers**. Configure the Site URL and allowed redirect URLs for the map's deployed HTTPS URL (and your local development URL).
3. Copy the project URL and its public anon/publishable key into `supabase-config.js`.
   Do not put a service-role key in the browser config.
4. Serve the map over HTTP(S), then open the **Account & history** panel to create an account or sign in. Email confirmation may be required, depending on the project's Authentication settings.

The profile stores a display name; Supabase Auth stores the email. While signed in, the map saves searches, map styles/themes, overlay changes, and selected OSM place details. The account panel shows the latest 100 activities and lets the user clear all saved history. Row-level security restricts profile and history access to the signed-in user.
