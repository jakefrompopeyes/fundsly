/**
 * Utility functions for storing and retrieving startup data
 * Uses Supabase directly with localStorage fallback
 */

import { supabase, isSupabaseConfigured } from './supabase';

export interface StartupData {
  // Basic Info
  name: string;
  symbol: string;
  description: string;
  imageUrl: string;
  category: string;
  
  // Problem & Solution
  problemStatement: string;
  solutionOverview: string;
  valueProposition: string;
  
  // Market Opportunity
  totalAddressableMarket: string;
  targetMarket: string;
  competitionAnalysis: string;
  
  // Team & Traction
  teamSize: string;
  founders: string;
  founderLinkedIn: string;
  currentTraction: string;
  stage: string;
  
  // Funding
  fundingGoal: string;
  minimumInvestment: string;
  useOfFunds: string;
  previousFunding: string;
  
  // Resources & Links
  website: string;
  twitter: string;
  discord: string;
  pitchDeckUrl: string;
  githubUrl: string;
  whitepaperUrl: string;
  demoUrl: string;
  videoPitchUrl: string;
  
  // Roadmap
  shortTermGoals: string;
  longTermVision: string;
  
  // Metadata
  createdAt: number;
  mint: string;
}

const STORAGE_PREFIX = "fundly_startup_";

/**
 * Transform database snake_case to frontend camelCase
 */
function transformDbToFrontend(dbData: any): StartupData {
  return {
    name: dbData.name,
    symbol: dbData.symbol,
    description: dbData.description || '',
    imageUrl: dbData.image_url || '',
    category: dbData.category || '',
    problemStatement: dbData.problem_statement || '',
    solutionOverview: dbData.solution_overview || '',
    valueProposition: dbData.value_proposition || '',
    totalAddressableMarket: dbData.total_addressable_market || '',
    targetMarket: dbData.target_market || '',
    competitionAnalysis: dbData.competition_analysis || '',
    teamSize: dbData.team_size || '',
    founders: dbData.founders || '',
    founderLinkedIn: dbData.founder_linkedin || '',
    currentTraction: dbData.current_traction || '',
    stage: dbData.stage || '',
    fundingGoal: dbData.funding_goal || '',
    minimumInvestment: dbData.minimum_investment || '',
    useOfFunds: dbData.use_of_funds || '',
    previousFunding: dbData.previous_funding || '',
    website: dbData.website || '',
    twitter: dbData.twitter || '',
    discord: dbData.discord || '',
    pitchDeckUrl: dbData.pitch_deck_url || '',
    githubUrl: dbData.github_url || '',
    whitepaperUrl: dbData.whitepaper_url || '',
    demoUrl: dbData.demo_url || '',
    videoPitchUrl: dbData.video_pitch_url || '',
    shortTermGoals: dbData.short_term_goals || '',
    longTermVision: dbData.long_term_vision || '',
    mint: dbData.mint,
    createdAt: dbData.created_at ? new Date(dbData.created_at).getTime() : Date.now(),
  };
}

/**
 * Save startup data to Supabase with localStorage fallback
 * @param mint - Token mint address
 * @param data - Startup data to save
 * @param creatorWallet - Wallet address of the creator
 */
export async function saveStartupData(
  mint: string,
  data: Omit<StartupData, "mint" | "createdAt">,
  creatorWallet?: string
): Promise<void> {
  const fullData: StartupData = {
    ...data,
    mint,
    createdAt: Date.now(),
  };

  // Always save to localStorage as backup (even if Supabase succeeds)
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(`${STORAGE_PREFIX}${mint}`, JSON.stringify(fullData));
      console.log("💾 Startup data saved to localStorage");
    } catch (error) {
      console.error("❌ Failed to save startup data to localStorage:", error);
      // Don't throw - continue to try Supabase
    }
  }

  // Try Supabase directly if configured
  if (isSupabaseConfigured() && creatorWallet) {
    try {
      console.log(`📤 Saving startup data to Supabase for mint: ${mint.slice(0, 8)}...`);
      console.log("📤 Required fields:", {
        name: !!data.name,
        symbol: !!data.symbol,
        mint: !!mint,
        creatorWallet: !!creatorWallet,
      });

      // Transform to snake_case for database
      const dbData: any = {
        mint,
        creator_wallet: creatorWallet,
        name: data.name,
        symbol: data.symbol,
        description: data.description || null,
        image_url: data.imageUrl || null,
        category: data.category || null,
        problem_statement: data.problemStatement || null,
        solution_overview: data.solutionOverview || null,
        value_proposition: data.valueProposition || null,
        total_addressable_market: data.totalAddressableMarket || null,
        target_market: data.targetMarket || null,
        competition_analysis: data.competitionAnalysis || null,
        team_size: data.teamSize || null,
        founders: data.founders || null,
        founder_linkedin: data.founderLinkedIn || null,
        current_traction: data.currentTraction || null,
        stage: data.stage || null,
        funding_goal: data.fundingGoal || null,
        minimum_investment: data.minimumInvestment || null,
        use_of_funds: data.useOfFunds || null,
        previous_funding: data.previousFunding || null,
        website: data.website || null,
        twitter: data.twitter || null,
        discord: data.discord || null,
        pitch_deck_url: data.pitchDeckUrl || null,
        github_url: data.githubUrl || null,
        whitepaper_url: data.whitepaperUrl || null,
        demo_url: data.demoUrl || null,
        video_pitch_url: data.videoPitchUrl || null,
        short_term_goals: data.shortTermGoals || null,
        long_term_vision: data.longTermVision || null,
      };

      // Upsert to Supabase
      const { data: savedData, error } = await supabase!
        .from('startup_data')
        .upsert(dbData, {
          onConflict: 'mint'
        })
        .select()
        .single();

      if (error) {
        console.error("❌ Supabase error:", error);
        console.error("❌ Error code:", error.code);
        console.error("❌ Error message:", error.message);
        console.error("❌ Error details:", error.details);
        throw error;
      }

      console.log("✅ Startup data saved to Supabase successfully");
      console.log("✅ Saved record ID:", savedData?.id);
      console.log("✅ Mint:", savedData?.mint);
      console.log("✅ Name:", savedData?.name);
      console.log("✅ Symbol:", savedData?.symbol);
      console.log("✅ Category:", savedData?.category);
      
      // Verify the save by reading it back
      const { data: verifyData, error: verifyError } = await supabase!
        .from('startup_data')
        .select('id, mint, name')
        .eq('mint', mint)
        .single();
      
      if (verifyData) {
        console.log("✅ VERIFIED: Data exists in Supabase", verifyData);
      } else if (verifyError) {
        console.warn("⚠️ Could not verify save:", verifyError);
      }
      
      return;
    } catch (error: any) {
      console.error("❌ Failed to save to Supabase:", error?.message || error);
      console.error("❌ Full error:", error);
      // Data already saved to localStorage, so we're good
      const errorMessage = error?.message || error?.toString() || "Unknown error";
      throw new Error(`Failed to save to Supabase: ${errorMessage}. Data saved to localStorage as backup.`);
    }
  } else {
    if (!isSupabaseConfigured()) {
      console.log("ℹ️ Supabase not configured, using localStorage only");
    }
    if (!creatorWallet) {
      console.warn("⚠️ No creator wallet provided, skipping Supabase save");
    }
  }
}

/**
 * Load startup data from Supabase with localStorage fallback
 * @param mint - Token mint address
 */
export async function loadStartupData(mint: string): Promise<StartupData | null> {
  console.log(`🔍 Loading startup data for mint: ${mint.slice(0, 8)}...${mint.slice(-4)}`);
  
  // Try Supabase first if configured
  if (isSupabaseConfigured()) {
    try {
      console.log(`📡 Querying Supabase directly`);
      const { data: dbData, error } = await supabase!
        .from('startup_data')
        .select('*')
        .eq('mint', mint)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        // PGRST116 is "not found" which is fine
        throw error;
      }
      
      if (dbData) {
        console.log("✅ Startup data loaded from Supabase");
        // Transform from snake_case to camelCase
        return transformDbToFrontend(dbData);
      }

      // No data found in Supabase, try localStorage fallback
      console.log(`⚠️ No data found in Supabase for mint ${mint.slice(0, 8)}..., checking localStorage...`);
    } catch (error: any) {
      console.warn("⚠️ Failed to load from Supabase, trying localStorage:", error?.message || error);
      // Fall through to localStorage fallback
    }
  }

  // Fallback to localStorage (for development or if Supabase fails/returns null)
  if (typeof window === "undefined") return null;

  try {
    const stored = localStorage.getItem(`${STORAGE_PREFIX}${mint}`);
    if (!stored) {
      console.log(`💾 No startup data found in localStorage for mint: ${mint.slice(0, 8)}...`);
      return null;
    }

    const data = JSON.parse(stored) as StartupData;
    console.log("💾 Startup data loaded from localStorage");
    return data;
  } catch (error) {
    console.error("❌ Failed to load startup data from localStorage:", error);
    return null;
  }
}

/**
 * Load all startup data from Supabase with localStorage fallback
 * @param category - Optional category filter
 * @param limit - Optional limit on number of results
 */
export async function loadAllStartupData(
  category?: string,
  limit?: number
): Promise<StartupData[]> {
  // Try Supabase first if configured
  if (isSupabaseConfigured()) {
    try {
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
        query = query.limit(limit);
      }

      const { data: dbData, error } = await query;

      if (error) throw error;

      if (dbData && Array.isArray(dbData)) {
        console.log(`✅ Loaded ${dbData.length} startups from Supabase`);
        // Transform all records from snake_case to camelCase
        return dbData.map(transformDbToFrontend);
      }

      return [];
    } catch (error) {
      console.warn("⚠️ Failed to load from Supabase, trying localStorage:", error);
      // Fall through to localStorage fallback
    }
  }

  // Fallback to localStorage (for development or if Supabase fails)
  if (typeof window === "undefined") return [];

  const startups: StartupData[] = [];

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(STORAGE_PREFIX)) {
        const data = localStorage.getItem(key);
        if (data) {
          const startup = JSON.parse(data) as StartupData;
          // Apply category filter if provided
          if (!category || category === "all" || startup.category === category) {
            startups.push(startup);
          }
        }
      }
    }

    // Sort by createdAt descending
    startups.sort((a, b) => b.createdAt - a.createdAt);

    // Apply limit if provided
    if (limit && limit > 0) {
      return startups.slice(0, limit);
    }

    console.log(`💾 Loaded ${startups.length} startups from localStorage (fallback)`);
    return startups;
  } catch (error) {
    console.error("❌ Failed to load all startup data:", error);
    return [];
  }
}

/**
 * Get all stored startup data from localStorage (synchronous, for backwards compatibility)
 * @deprecated Use loadAllStartupData() instead for Supabase support
 */
export function getAllStartupData(): StartupData[] {
  if (typeof window === "undefined") return [];
  
  const startups: StartupData[] = [];
  
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(STORAGE_PREFIX)) {
        const data = localStorage.getItem(key);
        if (data) {
          startups.push(JSON.parse(data) as StartupData);
        }
      }
    }
  } catch (error) {
    console.error("Failed to load all startup data:", error);
  }
  
  return startups;
}
