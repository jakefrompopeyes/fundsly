import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

/**
 * POST /api/startup-data/test-save
 * Test endpoint to manually test saving startup data
 * Useful for debugging Supabase connection issues
 */
export async function POST(request: NextRequest) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { error: 'Supabase not configured' },
        { status: 503 }
      );
    }

    const body = await request.json();
    const { mint, creatorWallet, ...startupData } = body;

    if (!mint || !creatorWallet || !startupData.name || !startupData.symbol) {
      return NextResponse.json(
        { error: 'Missing required fields: mint, creatorWallet, name, symbol' },
        { status: 400 }
      );
    }

    // Transform camelCase to snake_case
    const dbData: any = {
      mint,
      creator_wallet: creatorWallet,
      name: startupData.name,
      symbol: startupData.symbol,
      description: startupData.description || null,
      image_url: startupData.imageUrl || null,
      category: startupData.category || null,
      problem_statement: startupData.problemStatement || null,
      solution_overview: startupData.solutionOverview || null,
      value_proposition: startupData.valueProposition || null,
      total_addressable_market: startupData.totalAddressableMarket || null,
      target_market: startupData.targetMarket || null,
      competition_analysis: startupData.competitionAnalysis || null,
      team_size: startupData.teamSize || null,
      founders: startupData.founders || null,
      founder_linkedin: startupData.founderLinkedIn || null,
      current_traction: startupData.currentTraction || null,
      stage: startupData.stage || null,
      funding_goal: startupData.fundingGoal || null,
      minimum_investment: startupData.minimumInvestment || null,
      use_of_funds: startupData.useOfFunds || null,
      previous_funding: startupData.previousFunding || null,
      website: startupData.website || null,
      twitter: startupData.twitter || null,
      discord: startupData.discord || null,
      pitch_deck_url: startupData.pitchDeckUrl || null,
      github_url: startupData.githubUrl || null,
      whitepaper_url: startupData.whitepaperUrl || null,
      demo_url: startupData.demoUrl || null,
      video_pitch_url: startupData.videoPitchUrl || null,
      short_term_goals: startupData.shortTermGoals || null,
      long_term_vision: startupData.longTermVision || null,
      company_name: startupData.companyName || null,
      registration_country: startupData.registrationCountry || null,
      registration_number: startupData.registrationNumber || null,
    };

    console.log('🧪 Test save - Attempting to insert:', {
      mint,
      name: dbData.name,
      symbol: dbData.symbol,
    });

    const { data, error } = await supabase!
      .from('startup_data')
      .insert(dbData)
      .select()
      .single();

    if (error) {
      console.error('❌ Test save error:', error);
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
        },
        { status: 500 }
      );
    }

    console.log('✅ Test save successful:', data?.id);

    return NextResponse.json({
      success: true,
      data: {
        id: data?.id,
        mint: data?.mint,
        name: data?.name,
      },
    });
  } catch (error: any) {
    console.error('❌ Test save exception:', error);
    return NextResponse.json(
      { error: error.message || 'Unknown error' },
      { status: 500 }
    );
  }
}

