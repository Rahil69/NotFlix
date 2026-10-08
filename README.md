# FlixNotMV

A Next.js movie and series discovery app powered by TMDB. It includes search and genre browsing, a third-party embedded player, email/password accounts, and per-account continue-watching progress stored in Supabase.

## Requirements

- Node.js 20.9 or newer
- A TMDB Read Access Token
- A Supabase project

## Setup

1. Copy `.env.example` to `.env.local` and fill in the values:

   ```env
   TMDB_API_READ_ACCESS_TOKEN=your_tmdb_read_access_token
   NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key
   ```

   The TMDB token is used only by server code. The Supabase publishable key is intended for the app; do not put a Supabase secret/service-role key in client code or commit it.

2. In the Supabase SQL Editor, run [`supabase/migrations/20261009000000_create_watch_history.sql`](supabase/migrations/20261009000000_create_watch_history.sql). It creates the watch-history table and enables row-level security policies for each user's records.

3. In Supabase Authentication URL Configuration, allow your app's callback URL. For local development, add `http://localhost:3000/auth/callback` to the redirect URL allowlist and use `http://localhost:3000` as the local site URL. Add the equivalent URLs for your deployed site before deploying.

4. Install dependencies and start the development server:

   ```bash
   npm ci
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

## Commands

```bash
npm run lint
npm run build
npm run start
```

## Routes

- `/` - featured titles, search, and discovery collections
- `/movies`, `/tv-shows`, `/anime` - title catalogs
- `/login`, `/signup`, `/account` - authentication and saved watch progress
- `/watch/movie/:id` - embedded movie player
- `/watch/tv/:id?season=:season&episode=:episode` - embedded TV player
- `/api/tmdb/*` - server-side TMDB proxy
- `/api/history` - authenticated watch-progress API

The player loads from a third-party embed provider; FlixNotMV does not host video files. Availability and playback behavior depend on that provider.

## Before Deploying

Add the three environment variables from `.env.example` to your hosting provider, configure the production auth callback URL in Supabase, and verify the database migration has been applied. `.env.local` is excluded from Git by `.gitignore` and should stay out of version control.
