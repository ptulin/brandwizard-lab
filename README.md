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

## Conversation: free LLM (optional)

BW can reply to questions in the thread. When a note is a **question** (type `question` or ends with `?`), the server calls a free LLM and appends a reply from **BW**.

1. Get a free API key at [Groq Console](https://console.groq.com) (free tier, no credit card).
2. Add to `.env.local`: `GROQ_API_KEY=your-key`
3. In Vercel: Project → **Settings** → **Environment Variables** → add `GROQ_API_KEY` for Production/Preview.

If `GROQ_API_KEY` is not set, the app works as before (no BW replies).

## Configure Supabase (for shared thread, mail, file upload)

For real collaboration (shared thread and mail across users), use Supabase:

1. Create a project at [supabase.com](https://supabase.com) (free tier).
2. In **SQL Editor**, run the schema in `supabase/schema.sql`.
3. In **Storage**, create a **public** bucket named `lab-files` (for file uploads).
4. Copy **Project URL** and **anon public** key from **Settings → API**.
5. In project root, create `.env.local` and set:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Without these env vars, the app falls back to in-memory storage (single server instance only).

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
