# Changelog

## 2025-02-15 – Storage fix, light theme, cleanup

### Storage
- **List bucket directly**: When uploads table and thread entries are empty, API now lists files directly from Supabase Storage bucket `lab-files`. Files uploaded via Attach file will appear in Storage even if DB sync failed.
- Removed debug link from Storage empty state.

### Theme (white bg, black text)
- **globals.css**: `--background` → `#ffffff`, `--foreground` → `#0a0a0a`, `--border` → `#e5e5e5`, `--muted` → `#52525b`
- **page.tsx**: Main layout `bg-white text-black`; zinc grays → gray-600/700/800; dark surfaces → gray-50/100; modal overlays `bg-black/30`
- **login/page.tsx**, **signup/page.tsx**: Same light theme (white bg, black text, gray inputs)

### Code
- **db.ts**: Added `listStorageBucketFiles()` to list objects from `lab-files` bucket
- **api/uploads/route.ts**: When uploads list is empty, merges in bucket files as fallback
- **page.tsx**: Simplified Storage empty state message
