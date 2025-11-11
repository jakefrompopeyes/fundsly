import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

/**
 * GET /api/startup-data
 * Fetch all startup data from Supabase
 * Optional query params:
 *   - category: filter by category
 *   - limit: limit number of results
 */
export async function GET(request: NextRequest) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { error: 'Supabase not configured' },
        { status: 503 }
      );
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const limit = searchParams.get('limit');

    let query = supabase!
      .from('startup_data')
      .select('*')
      .order('created_at', { ascending: false });

    // Filter by category if provided
    if (category && category !== 'all') {
      query = query.eq('category', category);
    }

    // Apply limit if provided
    if (limit) {
      const limitNum = parseInt(limit, 10);
      if (!isNaN(limitNum) && limitNum > 0) {
        query = query.limit(limitNum);
      }
    }

    const { data, error } = await query;

    if (error) throw error;

    // Transform all records from snake_case to camelCase
    const transformedData = data.map(transformDbToFrontend);

    return NextResponse.json({ data: transformedData });
  } catch (error: any) {
    console.error('Error fetching all startup data:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch startup data' },
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

