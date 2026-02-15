/**
 * Optional seed script for local dev.
 * Run with: npx tsx scripts/seed-local.ts
 * (Requires the dev server to be running so we can POST to it, or run against in-memory store by importing store - here we assume API.)
 *
 * Alternative: run this inside the app by calling the store in a one-off API route or script that imports store.
 */

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

async function seed() {
  await fetch(`${BASE}/api/participants`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ displayName: "Pawel" }),
  });
  await fetch(`${BASE}/api/participants`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ displayName: "Donald" }),
  });
  await fetch(`${BASE}/api/entries`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      authorDisplayName: "Pawel",
      authorNameNorm: "pawel",
      body: "Decision: Use Next.js App Router for the lab.",
      type: "decision",
    }),
  });
  await fetch(`${BASE}/api/entries`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      authorDisplayName: "Pawel",
      authorNameNorm: "pawel",
      body: "Next: Add Supabase when we need persistence.",
      type: "action",
    }),
  });
  console.log("Seed done. Ensure dev server is running at", BASE);
}

seed().catch(console.error);
