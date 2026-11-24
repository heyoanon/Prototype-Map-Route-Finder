# Prototype Map Route Finder

An emergency map prototype with an Iloilo road graph and three selectable shortest-path algorithms: Bellman-Ford, SPFA, and A*. The root of this repository is the only app source. The map and responder console use the same root assets locally and on Vercel.

## Run locally

```powershell
python -m pip install -r requirements.txt
python server.py
```

Open [http://localhost:8000/map](http://localhost:8000/map) or [http://localhost:8000/responder](http://localhost:8000/responder). The route selector defaults to OSRM; choosing an algorithm calls the Python `/api/route` endpoint. First use downloads the Iloilo road graph from Overpass.

The current hosted pages are [Map](https://prototype-map-route-finder.vercel.app/map) and [Responder](https://prototype-map-route-finder.vercel.app/responder).

## Deploy

Vercel serves the static map and responder pages and deploys [api/route.py](api/route.py) as a Python Function at `/api/route`. The function downloads and caches the road graph in its warm instance. See [PYTHON_BACKEND.md](PYTHON_BACKEND.md) for the API contract and algorithm details.

## Accounts and responder alerts

1. Create a Supabase project, then run [supabase-setup.sql](supabase-setup.sql) in its SQL Editor.
2. Put the project URL and public anon key in `supabase-config.js` for the app deployment. For local development use a local copy of the config. The anon key is public and is protected by the database policies.
3. Sign in to the map account before confirming an emergency to synchronize it across devices. The responder console requires a signed-in account that an administrator has approved for responder access.
4. To approve a responder, run this in the Supabase SQL Editor, replacing the email:

   ```sql
   insert into public.emergency_responders (user_id)
   select id from auth.users where email = 'responder@example.com'
   on conflict (user_id) do nothing;
   ```

Alert rows are visible only to their caller and approved responders under row-level security. Realtime carries caller updates and responder clear actions between devices. `BroadcastChannel` and local storage remain as same-browser fallbacks.

## Project guides

- [Python backend, API, algorithms, and benchmark](PYTHON_BACKEND.md)
- [Supabase setup and access policy](SUPABASE_SETUP.md)
