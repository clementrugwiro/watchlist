# Media Group App v10 (Next.js + Supabase PWA)
1. Supabase SQL editor: `schema.sql` (first time only), then `fix.sql`, then `update.sql`, then `episodes.sql`, then `storage.sql`, then `v6.sql`, `v9.sql`, then `v10.sql` (group chat + personal watchlist). All safe to re-run except schema.sql.
   In Supabase, Realtime must be on for the project (it is by default); v10.sql adds the chat tables to it.
2. `cp .env.local.example .env.local`, fill URL + key, then `npm install && npm run dev`.
3. Deploy to Vercel (same env vars), then "Add to Home Screen" on each phone.