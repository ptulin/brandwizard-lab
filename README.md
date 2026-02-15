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
5. Add env vars in Vercel: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (see Configure Supabase).
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
2. In **SQL Editor**, run the full script in `supabase/RUN_THIS_IN_SQL_EDITOR.sql` (creates tables and uploads).
4. Copy **Project URL**, **anon** key, and **service_role** key from **Settings → API**.
5. In project root, create `.env.local` and set:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

The service role key (Settings → API → service_role) enables Storage: the app auto-creates the `lab-files` bucket on first upload. Without it, file uploads won't work.

Without these env vars, the app falls back to in-memory storage (single server instance only).

**Auth (when Supabase is configured):** Sign up and sign in use Supabase Auth (email/password). When both `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set, the app requires sign-in: unauthenticated users are redirected to `/login`. Sign up is at `/signup`. After sign-in, your email is used as the default display name in the lab (you can change it via Edit). Sign out is in the header. When Supabase env vars are not set, the app works without auth (name-only identity).

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
