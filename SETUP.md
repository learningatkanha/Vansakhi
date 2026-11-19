# Setting up Kanha Field Journal

About 45 minutes, once. You need accounts with four free services. Keep a notes file open: each step gives you
one or two keys to paste into `.env.local` (on your laptop) and later into Vercel.

```bash
cp .env.example .env.local
```

## 1. Supabase (database and login)

1. Sign up at [supabase.com](https://supabase.com) and create a project. Pick the **Mumbai (ap-south-1)** region.
2. **SQL Editor → New query**: paste all of `supabase/migrations/0001_init.sql` and press **Run**.
3. **Project Settings → API Keys**: copy
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - Publishable key → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - Secret key → `SUPABASE_SECRET_KEY` (never share this one)
4. **Authentication → Sign In / Providers**: turn **off** "Allow new users to sign up". The app is invite-only.
5. **Authentication → URL Configuration**:
   - Site URL: `http://localhost:3000` for now (change it to your Vercel address in step 5)
   - Redirect URLs: add `http://localhost:3000/**`
6. **Authentication → Emails → Templates**. Change the link in two templates:
   - **Invite user**: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite`
   - **Magic link**: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email`
7. **Make yourself the admin.** Authentication → Users → **Invite user** → your email. Then in the SQL Editor:

   ```sql
   update public.profiles set role = 'admin' where email = 'your@email.com';
   ```

   Open the invite email, click the link, and you're in. Invite everyone else from the app's **Admin** page.

> Supabase's built-in email sender allows only a few emails an hour. Fine for 5 people; if invites stop
> arriving, wait an hour or connect a free email service under Authentication → Emails → SMTP.

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

## Later phases

- **Phase 5 (species ID):** create a key at [console.anthropic.com](https://console.anthropic.com) →
  `ANTHROPIC_API_KEY`.
- **Phase 3 (voice notes):** a speech-to-text key will be added then.
