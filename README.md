# Kanha Field Journal

A private web app for a small team to record wildlife and plant sightings, and for each member to keep a
private field journal. Built with Next.js 16, Supabase, Cloudflare R2, Google Maps and GBIF.

- **Setup:** see [SETUP.md](SETUP.md).
- **Database schema and privacy rules:** `supabase/migrations/` (run the files in order).
- **Requirements and plan:** the "Kanha Field Journal — Requirements & Tech Plan" doc.

```bash
npm run dev      # start on http://localhost:3000
npm test         # unit tests
npm run lint
npm run build
```

## Status

Phase 1 (foundation) is done: invite-only login (email and password, with emailed links as a fallback), roles, Admin page, the full database with row-level
security, species search (GBIF), place search (Google Maps), and the R2 upload endpoint.

Phase 2 (observations) is done: recording sightings with photos and video, EXIF pre-fill, observation pages.

Phase 3 (journal, notes, media) is in progress. Done: the journal — rich-text entries (Tiptap) with photos and videos
inside them, date, place, weather and tags, links to that day's sightings, search by word, tag and month,
private by default with per-entry sharing. **Needs `supabase/migrations/0005_journal_search.sql` run first.**
Still to come in phase 3: voice notes, notes, media library.
