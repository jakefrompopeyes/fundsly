# ✅ Supabase Setup Verification Checklist

## Pre-flight Check

- [x] Supabase package installed (`@supabase/supabase-js`)
- [ ] Database table created (`startup_data`)
- [ ] Environment variables configured (`.env.local`)
- [ ] Dev server restarted after adding env vars

## Quick Test Steps

### 1. Verify Environment Variables
Check that `frontend/.env.local` contains:
```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 2. Start Dev Server
```bash
cd frontend
npm run dev
```

### 3. Test Creating a Startup
1. Go to `/dashboard/create-startup`
2. Fill out the form (at minimum: name, symbol, description, etc.)
3. Submit the form
4. **Check browser console** - you should see:
   - ✅ "✅ Startup data saved to Supabase" (if configured)
   - OR 💾 "💾 Startup data saved to localStorage (fallback)" (if not configured)

### 4. Verify Data Saved
**If using Supabase:**
- Go to Supabase dashboard → **Table Editor** → `startup_data`
- You should see your newly created startup data

**If using localStorage (fallback):**
- Data is stored in browser localStorage
- Check browser DevTools → Application → Local Storage

### 5. Test Investor Overview Page
1. After creating a startup, note the mint address from the success message
2. Go to `/dashboard/trade/[mint]/about` (replace `[mint]` with your mint address)
3. The investor overview should display all your form data

## Expected Console Messages

**With Supabase configured:**
```
✅ Startup data saved to Supabase
✅ Startup data loaded from Supabase
```

**Without Supabase (fallback):**
```
💾 Startup data saved to localStorage (fallback)
💾 Startup data loaded from localStorage (fallback)
```

## Troubleshooting

### Still seeing localStorage messages?
- Check `.env.local` has correct variable names (must start with `NEXT_PUBLIC_`)
- Restart dev server after adding env vars
- Check browser console for any errors

### API errors?
- Verify Supabase URL and anon key are correct
- Check Supabase dashboard → Logs for errors
- Ensure table `startup_data` exists in Supabase

### Data not appearing?
- Check browser console for errors
- Verify RLS policies allow reads (default should work)
- Try creating a new startup to test

## Success Indicators

✅ Console shows "✅ Startup data saved to Supabase"
✅ Data appears in Supabase Table Editor
✅ Investor overview page loads data correctly
✅ No errors in browser console

---

**You're all set!** The integration is complete and ready to use. 🎉

