# Supabase Setup Instructions

## Step 1: Create Supabase Project

1. Go to https://supabase.com and sign up/login
2. Click "New Project"
3. Fill in:
   - **Name**: fundly (or your preferred name)
   - **Database Password**: Choose a strong password (save it!)
   - **Region**: Choose closest to your users
4. Wait for project to be created (~2 minutes)

## Step 2: Get Your API Keys

1. Go to **Settings** → **API**
2. Copy these values:
   - **Project URL** (looks like: `https://xxxxx.supabase.co`)
   - **anon/public key** (starts with `eyJ...`)

## Step 3: Create Database Table

**⚠️ IMPORTANT: Use the `.sql` file, NOT the `.md` file!**

1. Go to **SQL Editor** in Supabase dashboard
2. Click **New Query**
3. Open the file `supabase-schema.sql` (NOT `SUPABASE_SETUP.md` - that's just instructions!)
4. Copy **ALL** the SQL code from `supabase-schema.sql`
5. Paste it into the SQL Editor
6. Click **Run** (or press Cmd/Ctrl + Enter)
7. You should see "Success. No rows returned"

**The SQL file contains commands like:**
- `CREATE TABLE...`
- `CREATE INDEX...`
- `CREATE POLICY...`

**The markdown file (`.md`) contains instructions and should NOT be run as SQL.**

## Step 4: Configure Environment Variables

Add these to your `frontend/.env.local` file:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

**Important**: 
- Never commit `.env.local` to git (it's already in `.gitignore`)
- The `NEXT_PUBLIC_` prefix makes these available in the browser
- Use the **anon** key, not the service_role key (for security)

## Step 5: Install Supabase Client

```bash
cd frontend
npm install @supabase/supabase-js
```

## Step 6: Test the Setup

1. Start your dev server: `npm run dev`
2. Create a startup token through the form
3. Check the browser console - you should see "✅ Startup data saved to Supabase"
4. Check Supabase dashboard → **Table Editor** → `startup_data` - you should see your data

## Troubleshooting

### "Supabase not configured" warning
- Check that `.env.local` exists and has the correct variables
- Restart your dev server after adding env variables
- Make sure variable names start with `NEXT_PUBLIC_`

### API returns 503 error
- Verify Supabase URL and anon key are correct
- Check that the table was created successfully
- Look at Supabase logs in the dashboard

### Data not appearing
- Check browser console for errors
- Verify RLS policies allow reads (the default policy should work)
- Check Supabase **Table Editor** to see if data was saved

### Fallback to localStorage
- This is normal if Supabase isn't configured
- Check console logs to see which storage method is being used
- Once Supabase is set up, it will automatically use the API

## Security Notes

- The current setup allows anyone to read/write (good for MVP)
- In production, add wallet signature verification
- Consider rate limiting to prevent abuse
- The anon key is safe to expose in the browser (RLS policies protect your data)

## Next Steps

- Add wallet signature verification for updates
- Implement rate limiting
- Add analytics/audit logging
- Set up backups
- Consider adding indexes for common queries

