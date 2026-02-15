# BrandWizard Lab

Lightweight shared lab notebook: join by name, add notes to a single thread, queue @messages to others, get a heuristic last-session summary, and generate copy-paste-ready prototype prompts.

## Stack

- **Next.js** (App Router) + TypeScript
- **Tailwind CSS** (burgundy + black + white theme)
- **Storage**: in-memory by default; Supabase optional (see below)

## Setup

```bash
cd brandwizard-lab
npm install
cp .env.local.example .env.local   # optional; only if using Supabase
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Run locally

- **Dev:** `npm run dev`
- **Build:** `npm run build`
- **Start (prod):** `npm run start`

## Deploy to Vercel

1. Push the repo to GitHub (under account **ptulin**).
2. In [Vercel](https://vercel.com): **Add New Project** → Import the `brandwizard-lab` repo (or the repo you created).
3. Root directory: leave default or set to `brandwizard-lab` if the app lives in that subfolder.
4. Build command: `npm run build` (default). Output directory: `.next` (default).
5. Add env vars in Vercel if you use Supabase (see below).
6. Deploy. Every push to the default branch will auto-deploy.

## Configure Supabase (optional)

MVP works with **in-memory storage** only. To persist data:

1. Create a project at [supabase.com](https://supabase.com) (free tier).
2. In **SQL Editor**, run the schema (see `supabase/schema.sql` when added).
3. Copy **Project URL** and **anon public** key from **Settings → API**.
4. In project root, create `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

5. When Supabase is wired in, the app will use these; until then, the app uses in-memory store.

## Features (MVP)

- **Onboarding:** Type your name to begin; stored in `localStorage` and participants list.
- **Lab notes:** Single shared thread; each entry has author, body, type (note | decision | question | action).
- **@message:** Type `@Name: your message END` to queue a message; recipient uses **Check mail** to retrieve and mark delivered.
- **Summary:** Heuristic extraction from last 10–30 notes: key points, next actions, open questions.
- **Prototype mode:** Paste an idea → structured prompt (problem, target user, scope, constraints, data model, screens, acceptance criteria, implementation plan) with **Copy to clipboard**.

## Commands (type in main input)

- `@onboarding` — show onboarding text
- `@checkmail` — open inbox (same as Check mail button)
- `@prototype` — switch to prototype mode
- `@summary` — show last-session summary

## UI

- Burgundy accent (`#6b0f1a`), black background, white text, bento-style action cards.
- Input fixed at bottom on desktop; collapsible on mobile.
- Responsive layout.

## License

Private / use as you like.
