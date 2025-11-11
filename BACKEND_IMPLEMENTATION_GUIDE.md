# Backend Implementation Guide

## Current State
Startup data is stored in browser localStorage, which means:
- ❌ Data is only visible to the user who created it
- ❌ Data is lost if browser cache is cleared
- ❌ Not shareable across users/devices
- ✅ Works for development/testing

## Recommended Approach: Next.js API Routes + Database

Since you're using Next.js, the simplest path is to use **Next.js API Routes** with a database. Here are your options:

### Option 1: Supabase (Recommended for Quick Setup)
**Pros**: PostgreSQL database, real-time subscriptions, built-in auth, free tier
**Best for**: Fast MVP → Production

### Option 2: Firebase/Firestore
**Pros**: NoSQL, easy setup, real-time updates
**Best for**: Rapid prototyping

### Option 3: PostgreSQL + Prisma
**Pros**: Full control, type-safe, production-ready
**Best for**: Long-term scalability

### Option 4: Separate Backend Service
**Pros**: Complete separation, can use any language/framework
**Best for**: Complex business logic, microservices

---

## Implementation: Next.js API Routes + Supabase

### Step 1: Set Up Supabase

1. Create account at https://supabase.com
2. Create a new project
3. Get your project URL and anon key from Settings → API

### Step 2: Create Database Table

Run this SQL in Supabase SQL Editor:

```sql
CREATE TABLE startup_data (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  mint TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  symbol TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  category TEXT,
  
  -- Problem & Solution
  problem_statement TEXT,
  solution_overview TEXT,
  value_proposition TEXT,
  
  -- Market Opportunity
  total_addressable_market TEXT,
  target_market TEXT,
  competition_analysis TEXT,
  
  -- Team & Traction
  team_size TEXT,
  founders TEXT,
  founder_linkedin TEXT,
  current_traction TEXT,
  stage TEXT,
  
  -- Funding
  funding_goal TEXT,
  minimum_investment TEXT,
  use_of_funds TEXT,
  previous_funding TEXT,
  
  -- Resources & Links
  website TEXT,
  twitter TEXT,
  discord TEXT,
  pitch_deck_url TEXT,
  github_url TEXT,
  whitepaper_url TEXT,
  demo_url TEXT,
  video_pitch_url TEXT,
  
  -- Roadmap
  short_term_goals TEXT,
  long_term_vision TEXT,
  
  -- Legal
  company_name TEXT,
  registration_country TEXT,
  registration_number TEXT,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  creator_wallet TEXT NOT NULL
);

-- Index for fast lookups by mint
CREATE INDEX idx_startup_data_mint ON startup_data(mint);

-- Enable Row Level Security (optional, for multi-user)
ALTER TABLE startup_data ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read, only creator can write
CREATE POLICY "Anyone can read startup data"
  ON startup_data FOR SELECT
  USING (true);

CREATE POLICY "Only creator can insert/update"
  ON startup_data FOR INSERT
  WITH CHECK (true); -- In production, verify wallet signature
```

### Step 3: Install Dependencies

```bash
cd frontend
npm install @supabase/supabase-js
```

### Step 4: Create Supabase Client

Create `frontend/src/lib/supabase.ts`:

```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

### Step 5: Create API Routes

Create `frontend/src/app/api/startup-data/[mint]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import type { StartupData } from '@/lib/startupData';

// GET: Fetch startup data by mint
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ mint: string }> }
) {
  try {
    const { mint } = await params;
    
    const { data, error } = await supabase
      .from('startup_data')
      .select('*')
      .eq('mint', mint)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // Not found
        return NextResponse.json({ data: null }, { status: 200 });
      }
      throw error;
    }

    return NextResponse.json({ data });
  } catch (error: any) {
    console.error('Error fetching startup data:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch startup data' },
      { status: 500 }
    );
  }
}

// POST: Create or update startup data
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ mint: string }> }
) {
  try {
    const { mint } = await params;
    const body = await request.json();
    const { creatorWallet, ...startupData } = body;

    // Upsert (insert or update)
    const { data, error } = await supabase
      .from('startup_data')
      .upsert({
        mint,
        creator_wallet: creatorWallet,
        ...startupData,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ data });
  } catch (error: any) {
    console.error('Error saving startup data:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to save startup data' },
      { status: 500 }
    );
  }
}
```

### Step 6: Update startupData.ts to Use API

Replace localStorage calls with API calls:

```typescript
import type { StartupData } from './startupData';

const API_BASE = '/api/startup-data';

export async function saveStartupData(
  mint: string,
  data: Omit<StartupData, 'mint' | 'createdAt'>,
  creatorWallet: string
): Promise<void> {
  try {
    const response = await fetch(`${API_BASE}/${mint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...data,
        creatorWallet,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to save startup data');
    }
  } catch (error) {
    console.error('Failed to save startup data:', error);
    throw error;
  }
}

export async function loadStartupData(mint: string): Promise<StartupData | null> {
  try {
    const response = await fetch(`${API_BASE}/${mint}`);
    
    if (!response.ok) {
      throw new Error('Failed to load startup data');
    }

    const result = await response.json();
    return result.data;
  } catch (error) {
    console.error('Failed to load startup data:', error);
    return null;
  }
}
```

### Step 7: Update create-startup/page.tsx

Change the save call to include wallet address:

```typescript
// Save startup data to API
await saveStartupData(mint.toBase58(), startupData, wallet.publicKey!.toBase58());
```

### Step 8: Add Environment Variables

Add to `frontend/.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

---

## Alternative: Keep localStorage as Fallback

You can keep localStorage as a fallback for development:

```typescript
export async function saveStartupData(...) {
  // Try API first
  try {
    await saveToAPI(...);
  } catch (error) {
    // Fallback to localStorage in development
    if (process.env.NODE_ENV === 'development') {
      console.warn('API failed, using localStorage fallback');
      saveToLocalStorage(...);
    } else {
      throw error;
    }
  }
}
```

---

## Migration Path

1. **Phase 1**: Keep localStorage, add API routes (both work)
2. **Phase 2**: Migrate to API-only, remove localStorage
3. **Phase 3**: Add authentication, wallet signature verification
4. **Phase 4**: Add caching, rate limiting, analytics

---

## Security Considerations

1. **Wallet Signature Verification**: Verify the creator's wallet signature before allowing updates
2. **Rate Limiting**: Prevent spam/abuse
3. **Input Validation**: Sanitize all user inputs
4. **CORS**: Configure properly for production
5. **Row Level Security**: Use Supabase RLS policies for multi-user scenarios

---

## Quick Start Checklist

- [ ] Set up Supabase account
- [ ] Create database table
- [ ] Install `@supabase/supabase-js`
- [ ] Create API routes
- [ ] Update `startupData.ts` to use API
- [ ] Update form submission to use API
- [ ] Test end-to-end
- [ ] Deploy and test on production

Would you like me to implement any of these steps?

