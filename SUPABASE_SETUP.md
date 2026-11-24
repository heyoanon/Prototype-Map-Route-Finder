# Supabase setup

1. Create a Supabase project and run `supabase-setup.sql` in its SQL Editor. The script is safe to re-run.
2. Enable email/password sign-in in Authentication and configure the deployed URL and local development URL as allowed redirect URLs.
3. Put the project URL and public anon key in `supabase-config.js` for deployment. Keep local project values in a local-only config copy. Never put a service-role key in browser code.
4. Create or sign in to the caller account on the map. Callers must be signed in for a confirmed emergency to sync to other devices.
5. Approve responder accounts by inserting their Auth user IDs into `public.emergency_responders` from the SQL Editor. The map UI's responder profile setting does not grant database responder access.

The `alerts` table stores one current alert per caller. RLS lets callers read and update their own alert and lets approved responders read alerts. Responders clear alerts through the `clear_alert` database function, which checks responder membership before changing status and removes the caller coordinates from the stored payload. The `alerts` table is added to Supabase Realtime by the setup script.

Unapproved users cannot read alert rows even when they know a caller's ID. Use a trusted administrator to add and remove rows in `emergency_responders`. Do not grant anonymous access to `alerts` or `emergency_responders`.
