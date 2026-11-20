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
Next: phase 2, recording observations with photos and video.
