# Media Group App v6 (Next.js + Supabase PWA)
1. Supabase SQL editor: `schema.sql` (first time only), then `fix.sql`, then `update.sql`, then `episodes.sql`, then `storage.sql`, then `v6.sql` (all safe to re-run except schema.sql).
2. `cp .env.local.example .env.local`, fill URL + key, then `npm install && npm run dev`.
3. Deploy to Vercel (same env vars), then "Add to Home Screen" on each phone.
