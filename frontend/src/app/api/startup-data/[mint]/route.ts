import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

/**
 * GET /api/startup-data/[mint]
 * Fetch startup data by mint address
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ mint: string }> }
) {
  try {
    const { mint } = await params;

    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { error: 'Supabase not configured' },
        { status: 503 }
      );
    }

    const { data, error } = await supabase!
      .from('startup_data')
      .select('*')
      .eq('mint', mint)
      .single();

    if (error) {
      // PGRST116 is "not found" error code
      if (error.code === 'PGRST116') {
        return NextResponse.json({ data: null }, { status: 200 });
      }
      throw error;
    }

    // Transform database column names to camelCase for frontend
    const transformedData = transformDbToFrontend(data);

    return NextResponse.json({ data: transformedData });
  } catch (error: any) {
    console.error('Error fetching startup data:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch startup data' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/startup-data/[mint]
 * Create or update startup data
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ mint: string }> }
) {
  try {
    const { mint } = await params;

    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { error: 'Supabase not configured' },
        { status: 503 }
      );
    }

    const body = await request.json();
    const { creatorWallet, ...startupData } = body;

    console.log(`📥 Received startup data for mint: ${mint.slice(0, 8)}...`);
    console.log(`📥 Creator wallet: ${creatorWallet?.slice(0, 8)}...`);
    console.log(`📥 Data fields: ${Object.keys(startupData).length} fields`);

    // Validate required fields
    if (!mint || !creatorWallet || !startupData.name || !startupData.symbol) {
      const missing = [];
      if (!mint) missing.push('mint');
      if (!creatorWallet) missing.push('creatorWallet');
      if (!startupData.name) missing.push('name');
      if (!startupData.symbol) missing.push('symbol');
      
      console.error(`❌ Missing required fields: ${missing.join(', ')}`);
      return NextResponse.json(
        { error: `Missing required fields: ${missing.join(', ')}` },
        { status: 400 }
      );
    }

    // Transform camelCase to snake_case for database
    const dbData = transformFrontendToDb({
      ...startupData,
      mint,
      creatorWallet,
    });
    
    // Convert empty strings to null for optional fields (PostgreSQL prefers null over empty strings)
    // But keep required fields as-is (name, symbol, mint, creator_wallet)
    const requiredFields = ['name', 'symbol', 'mint', 'creator_wallet'];
    Object.keys(dbData).forEach(key => {
      if (dbData[key] === '' && !requiredFields.includes(key)) {
        dbData[key] = null;
      }
    });

    console.log(`💾 Attempting to upsert to Supabase...`);
    console.log(`💾 Database data keys: ${Object.keys(dbData).join(', ')}`);

    // Check if record exists (don't throw on not found)
    const { data: existingData, error: checkError } = await supabase!
      .from('startup_data')
      .select('id, created_at')
      .eq('mint', mint)
      .maybeSingle(); // Use maybeSingle() instead of single() to avoid throwing on not found

    const isNewRecord = !existingData || checkError?.code === 'PGRST116';

    // Prepare data for upsert
    const upsertData: any = {
      ...dbData,
      updated_at: new Date().toISOString(),
    };

    // Only set created_at if this is a new record
    if (isNewRecord) {
      upsertData.created_at = new Date().toISOString();
    }

    console.log(`💾 Upsert data prepared. Is new record: ${isNewRecord}`);

    // Upsert (insert or update)
    const { data, error } = await supabase!
      .from('startup_data')
      .upsert(
        upsertData,
        {
          onConflict: 'mint',
        }
      )
      .select()
      .single();

    if (error) {
      console.error('❌ Supabase upsert error:', error);
      console.error('❌ Error code:', error.code);
      console.error('❌ Error message:', error.message);
      console.error('❌ Error details:', error.details);
      console.error('❌ Error hint:', error.hint);
      console.error('❌ Full error object:', JSON.stringify(error, null, 2));
      console.error('❌ Upsert data that failed:', JSON.stringify(upsertData, null, 2));
      throw error;
    }

    console.log(`✅ Successfully saved to Supabase. Record ID: ${data?.id || 'N/A'}`);
    console.log(`✅ Saved data preview:`, {
      mint: data?.mint,
      name: data?.name,
      symbol: data?.symbol,
      category: data?.category,
    });

    // Transform back to camelCase
    const transformedData = transformDbToFrontend(data);

    return NextResponse.json({ data: transformedData });
  } catch (error: any) {
    console.error('Error saving startup data:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to save startup data' },
      { status: 500 }
    );
  }
}

/**
 * Transform database snake_case to frontend camelCase
 */
function transformDbToFrontend(dbData: any): any {
  return {
    name: dbData.name,
    symbol: dbData.symbol,
    description: dbData.description,
    imageUrl: dbData.image_url,
    category: dbData.category,
    problemStatement: dbData.problem_statement,
    solutionOverview: dbData.solution_overview,
    valueProposition: dbData.value_proposition,
    totalAddressableMarket: dbData.total_addressable_market,
    targetMarket: dbData.target_market,
    competitionAnalysis: dbData.competition_analysis,
    teamSize: dbData.team_size,
    founders: dbData.founders,
    founderLinkedIn: dbData.founder_linkedin,
    currentTraction: dbData.current_traction,
    stage: dbData.stage,
    fundingGoal: dbData.funding_goal,
    minimumInvestment: dbData.minimum_investment,
    useOfFunds: dbData.use_of_funds,
    previousFunding: dbData.previous_funding,
    website: dbData.website,
    twitter: dbData.twitter,
    discord: dbData.discord,
    pitchDeckUrl: dbData.pitch_deck_url,
    githubUrl: dbData.github_url,
    whitepaperUrl: dbData.whitepaper_url,
    demoUrl: dbData.demo_url,
    videoPitchUrl: dbData.video_pitch_url,
    shortTermGoals: dbData.short_term_goals,
    longTermVision: dbData.long_term_vision,
    companyName: dbData.company_name,
    registrationCountry: dbData.registration_country,
    registrationNumber: dbData.registration_number,
    mint: dbData.mint,
    createdAt: dbData.created_at ? new Date(dbData.created_at).getTime() : Date.now(),
  };
}

/**
 * Transform frontend camelCase to database snake_case
 */
function transformFrontendToDb(frontendData: any): any {
  return {
    mint: frontendData.mint,
    creator_wallet: frontendData.creatorWallet,
    name: frontendData.name,
    symbol: frontendData.symbol,
    description: frontendData.description,
    image_url: frontendData.imageUrl,
    category: frontendData.category,
    problem_statement: frontendData.problemStatement,
    solution_overview: frontendData.solutionOverview,
    value_proposition: frontendData.valueProposition,
    total_addressable_market: frontendData.totalAddressableMarket,
    target_market: frontendData.targetMarket,
    competition_analysis: frontendData.competitionAnalysis,
    team_size: frontendData.teamSize,
    founders: frontendData.founders,
    founder_linkedin: frontendData.founderLinkedIn,
    current_traction: frontendData.currentTraction,
    stage: frontendData.stage,
    funding_goal: frontendData.fundingGoal,
    minimum_investment: frontendData.minimumInvestment,
    use_of_funds: frontendData.useOfFunds,
    previous_funding: frontendData.previousFunding,
    website: frontendData.website,
    twitter: frontendData.twitter,
    discord: frontendData.discord,
    pitch_deck_url: frontendData.pitchDeckUrl,
    github_url: frontendData.githubUrl,
    whitepaper_url: frontendData.whitepaperUrl,
    demo_url: frontendData.demoUrl,
    video_pitch_url: frontendData.videoPitchUrl,
    short_term_goals: frontendData.shortTermGoals,
    long_term_vision: frontendData.longTermVision,
    company_name: frontendData.companyName,
    registration_country: frontendData.registrationCountry,
    registration_number: frontendData.registrationNumber,
  };
}

