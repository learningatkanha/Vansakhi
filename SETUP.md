# Setting up Kanha Field Journal

About 45 minutes, once. You need accounts with four free services. Keep a notes file open: each step gives you
one or two keys to paste into `.env.local` (on your laptop) and later into Vercel.

```bash
cp .env.example .env.local
```

## 1. Supabase (database and login) — done

The database, privacy rules, "sign-ups off" and the login address for your laptop are already set up on the
**Vansakhi** project. What's left:

1. **Project Settings → API Keys**: copy
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL` (`https://bqutrkpzjixdetxrjdti.supabase.co`)
   - Publishable key → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - Secret key → `SUPABASE_SECRET_KEY` (never share this one)
2. **Add yourself:** Authentication → Users → **Add user → Create new user**, enter your email, tick
   **Auto Confirm User**, any password. Then make yourself admin in the SQL Editor:

   ```sql
   update public.profiles set role = 'admin' where email = 'your@email.com';
   ```

3. Sign in at the app's login page with that email and password. Add everyone else from the app's
   **Admin** page: it gives you a temporary password to pass on, and they change it under their account menu.
   Forgotten passwords: Admin → **Reset password**, or "Email me a sign-in link" on the login page.

> Supabase's built-in email sender allows only a few emails an hour. Fine for 5 people; if sign-in emails
> stop arriving, wait an hour or connect a free email service under Authentication → Emails → SMTP.

## 2. Cloudflare R2 (photo and video storage)

1. Sign up at [cloudflare.com](https://dash.cloudflare.com), open **R2 Object Storage**, and add a payment card
   (the first 10 GB a month are free).
2. **Create bucket** named `kanha-media`. → `R2_BUCKET`
3. Your **Account ID** is shown on the R2 overview page. → `R2_ACCOUNT_ID`
4. **Manage API tokens → Create API token**: permission **Object Read & Write**, limited to the `kanha-media`
   bucket. Copy the **Access Key ID** → `R2_ACCESS_KEY_ID` and **Secret Access Key** → `R2_SECRET_ACCESS_KEY`.
5. Open the bucket → **Settings → CORS policy** → paste (add your Vercel address in step 5):

   ```json
   [
     {
       "AllowedOrigins": ["http://localhost:3000"],
       "AllowedMethods": ["GET", "PUT"],
       "AllowedHeaders": ["Content-Type"],
       "MaxAgeSeconds": 3600
     }
   ]
   ```

## 3. Google Maps (place search)

1. Go to [console.cloud.google.com](https://console.cloud.google.com), create a project, and set up billing
   (a card is required; a small team stays inside Google's free monthly usage).
2. **APIs & Services → Library**: enable the **Geocoding API**.
3. **APIs & Services → Credentials → Create credentials → API key**. Edit it: under **API restrictions** choose
   "Restrict key" and tick only **Geocoding API**. → `GOOGLE_MAPS_API_KEY`
4. Optional but wise: **Billing → Budgets & alerts**, set a ₹500 budget with email alerts.

## 4. Run it on your laptop

You need [Node.js 22](https://nodejs.org). Then:

```bash
npm install
```

```bash
npm run dev
```

Open http://localhost:3000, sign in with your email, and check **Admin → Setup checklist**: every service
you've set up shows "Connected".

## 5. Put it online (Vercel)

1. Push this project to a private GitHub repository.
2. Sign up at [vercel.com](https://vercel.com) with GitHub → **Add New → Project** → pick the repository.
3. Under **Environment Variables**, add every line from your `.env.local`. Set `NEXT_PUBLIC_SITE_URL` to
   the address Vercel gives you, e.g. `https://kanha-field-journal.vercel.app`.
4. **Deploy**. Then add that address in three places:
   - Supabase → Authentication → URL Configuration: Site URL, and Redirect URLs (`https://…vercel.app/**`)
   - Cloudflare R2 → bucket CORS policy → `AllowedOrigins`

## Database updates

When a new file appears in `supabase/migrations/`, open Supabase → **SQL Editor**, paste the file's contents
and **Run**, before the new version of the app goes live. Run each file once, in number order.

- `0005_journal_search.sql` (phase 3, journal): search text, tag index, entry coordinates, and a tighter rule
  for which photos an entry may link to.

## Later phases

- **Phase 5 (species ID):** create a key at [console.anthropic.com](https://console.anthropic.com) →
  `ANTHROPIC_API_KEY`.
- **Phase 3 (voice notes):** a speech-to-text key will be added then.
