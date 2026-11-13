# Date Night

Small games for two people who live far apart. Static pages on GitHub Pages, with a free Supabase project keeping both phones in sync.

## Games

- `bingo/`: Date Night Bingo. Two different cards, each square needs the other person to approve it.

## One-time setup

1. In Supabase, open SQL Editor, paste `sql/setup.sql`, and run it.
2. In this repo, open Settings, Pages, and set the source to the `main` branch, root folder.
3. Open `https://<your-github-username>.github.io/datenight/bingo/` on both phones.

`config.js` holds the project URL and the publishable key. That key is meant to be public. Never commit a secret or `service_role` key.

## How syncing works

Each game keeps an ordered list of events (claim, approve, and so on) in the `events` table. Both phones rebuild the whole game from that list, so they always agree. Phones get updates live over Supabase Realtime and also check every few seconds as a backup.
