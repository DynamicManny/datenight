# Date Night

Small games for two people who live far apart. Static pages on GitHub Pages, with a free Supabase project keeping both phones in sync.

## Setup

1. In Supabase, open SQL Editor, paste `sql/setup.sql`, and run it.
2. In this repo, open Settings, Pages, and set the source to the `main` branch, root folder.
3. Open `https://<your-github-username>.github.io/datenight/` on both phones and tap who you are.

`config.js` holds the project URL and the publishable key. That key is meant to be public. Never commit a secret or `service_role` key.

## How syncing works

The game keeps an ordered list of events (claim, approve, new cards) in the `events` table. Both phones rebuild the whole game from that list, so they always agree. Phones get updates live over Supabase Realtime and also check every few seconds as a backup.
