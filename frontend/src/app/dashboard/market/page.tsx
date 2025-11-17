"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Connection, PublicKey } from "@solana/web3.js";
import { AnchorProvider, Program, BN } from "@coral-xyz/anchor";
import idlJson from "@/idl/fundly.json";
import { Fundly } from "@/idl/fundly";
import { loadAllStartupData, type StartupData } from "@/lib/startupData";
import { withCache } from "@/lib/rpcCache";

interface ProjectAccount {
  owner: PublicKey;
  mint: PublicKey;
  name: string;
  symbol: string;
  createdAt: BN;
  totalSupply: BN;
  category: string;
}

interface BondingCurveAccount {
  mint: PublicKey;
  creator: PublicKey;
  virtualSolReserves: BN;
  virtualTokenReserves: BN;
  realSolReserves: BN;
  realTokenReserves: BN;
  complete: boolean;
  migrated: boolean;
  raydiumPool: PublicKey;
  bump: number;
}

interface Project {
  publicKey: PublicKey;
  account: ProjectAccount;
  bondingCurve?: BondingCurveAccount;
  currentPrice?: number;
  solRaised?: number;
  marketCapUSD?: number;
  startupData?: StartupData; // Rich startup data from Supabase
}

export default function MarketPage() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [solPriceUSD, setSolPriceUSD] = useState<number>(180); // Default fallback

  // Fetch SOL price in USD
  useEffect(() => {
    async function fetchSolPrice() {
      try {
        const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
        const data = await response.json();
        if (data?.solana?.usd) {
          setSolPriceUSD(data.solana.usd);
          console.log(`SOL Price: $${data.solana.usd}`);
        }
      } catch (error) {
        console.warn("Failed to fetch SOL price, using default:", error);
        // Keep the default fallback value
      }
    }
    fetchSolPrice();
    // Refresh price every 5 minutes
    const interval = setInterval(fetchSolPrice, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    async function loadAllProjects() {
      try {
        setLoading(true);
        setError(null);
        
        const programId = new PublicKey(idlJson.address);
        
        // Create a minimal provider (even without wallet connected)
        const provider = new AnchorProvider(
          connection,
          wallet as any,
          { commitment: "confirmed" }
        );
        
        const program = new Program(idlJson as Fundly, provider);

        // Fetch blockchain data and startup data in parallel
        const [projectAccounts, startupDataList] = await Promise.all([
          (program.account as any).projectState.all(),
          loadAllStartupData(), // Load all startup data from Supabase
        ]);
        
        console.log(`Found ${projectAccounts.length} project accounts`);
        console.log(`Found ${startupDataList.length} startup data entries`);

        // Create a map of mint -> startup data for quick lookup
        const startupDataMap = new Map<string, StartupData>();
        startupDataList.forEach((data: StartupData) => {
          startupDataMap.set(data.mint, data);
        });

        // Fetch bonding curve data for each project with rate limiting
        const allProjects: Project[] = [];
        
        // Helper function to add delay between batches
        const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
        
        // Process projects in smaller batches to avoid rate limiting
        const BATCH_SIZE = 2;
        const BATCH_DELAY_MS = 1000; // Wait 1 second between batches (ultra-conservative for free RPC)
        
        for (let i = 0; i < projectAccounts.length; i += BATCH_SIZE) {
          const batch = projectAccounts.slice(i, i + BATCH_SIZE);
          
          const batchResults = await Promise.allSettled(
            batch.map(async (projectAccount: any) => {
              const account = projectAccount.account as any;
              
              // Skip if mint is not set (project not fully initialized)
              if (account.mint.equals(PublicKey.default)) {
                console.log(`Skipping project ${projectAccount.publicKey.toBase58()} - mint not set`);
                return null;
              }

              const mintAddress = account.mint.toBase58();
              
              // Get startup data for this mint if available
              const startupData = startupDataMap.get(mintAddress);

              // Skip validation (too many RPC calls) - just check if mint exists
              // We'll show projects even if incomplete for better UX
              
              // Try to fetch bonding curve data
              let bondingCurveData: BondingCurveAccount | undefined;
              let currentPrice: number | undefined;
              let solRaised: number | undefined;
              let marketCapUSD: number | undefined;

              try {
                const [bondingCurvePda] = PublicKey.findProgramAddressSync(
                  [Buffer.from("bonding_curve"), account.mint.toBuffer()],
                  programId
                );

                // Use cache with 30 second TTL to reduce repeated calls
                const cacheKey = `bonding_curve:${mintAddress}`;
                const bondingCurve = await withCache(
                  cacheKey,
                  30000, // 30 seconds
                  async () => await (program.account as any).bondingCurve.fetch(bondingCurvePda)
                );
                
                if (bondingCurve) {
                  bondingCurveData = bondingCurve as any;
                  
                  // Calculate current price: price = (virtualSol + realSol) / (virtualToken + realToken)
                  const totalSol = (bondingCurve.virtualSolReserves as BN).toNumber() + (bondingCurve.realSolReserves as BN).toNumber();
                  const totalToken = (bondingCurve.virtualTokenReserves as BN).toNumber() + (bondingCurve.realTokenReserves as BN).toNumber();
                  
                  // Convert from lamports/raw units to SOL/tokens (accounting for 6 decimals)
                  currentPrice = (totalSol / 1e9) / (totalToken / 1e6);
                  solRaised = (bondingCurve.realSolReserves as BN).toNumber() / 1e9;
                  
                  // Calculate market cap: Total Supply × Current Price in SOL × SOL/USD
                  const totalSupplyTokens = account.totalSupply.toNumber() / 1e6; // Convert from raw units to tokens
                  marketCapUSD = totalSupplyTokens * currentPrice * solPriceUSD;
                }
              } catch (bcError) {
                console.log(`No bonding curve found for ${account.symbol}`);
                // Continue without bonding curve data
              }

              return {
                publicKey: projectAccount.publicKey,
                account: account,
                bondingCurve: bondingCurveData,
                currentPrice,
                solRaised,
                marketCapUSD,
                startupData, // Include rich startup data
              };
            })
          );

          // Add successful results to allProjects
          batchResults.forEach((result) => {
            if (result.status === 'fulfilled' && result.value) {
              allProjects.push(result.value);
            } else if (result.status === 'rejected') {
              console.warn('Failed to process project:', result.reason);
            }
          });
          
          // Add delay between batches (except for the last batch)
          if (i + BATCH_SIZE < projectAccounts.length) {
            await delay(BATCH_DELAY_MS);
          }
        }

        console.log(`Successfully loaded ${allProjects.length} projects with data`);
        setProjects(allProjects);
      } catch (e: any) {
        console.error("Error fetching projects:", e);
        setError(e?.message || "Failed to load projects");
      } finally {
        setLoading(false);
      }
    }

    loadAllProjects();
  }, [connection, wallet, solPriceUSD]);

  const categories = ["all", "DeFi", "NFT", "Gaming", "Infrastructure", "Social", "AI/ML", "DAO", "Metaverse", "Other"];
  
  const filteredProjects = filter === "all" 
    ? projects 
    : projects.filter(p => p.account.category === filter);

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center rounded-2xl border border-white/20 bg-white/10 backdrop-blur-lg p-10">
        <p className="text-slate-300">Loading market...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[400px] items-center justify-center rounded-2xl border border-red-500/30 bg-red-500/10 p-10">
        <p className="text-red-200">Error: {error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Token Market</h1>
            <p className="text-sm text-slate-300 mt-1">
              Discover and trade startup tokens with bonding curves
            </p>
          </div>
          <span className="text-sm text-purple-300 font-semibold">
            {filteredProjects.length} token{filteredProjects.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Category Filter */}
        <div className="flex gap-2 overflow-x-auto pb-2 mt-6">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-all whitespace-nowrap ${
                filter === cat
                  ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white"
                  : "bg-white/10 text-slate-300 hover:bg-white/20 hover:text-white"
              }`}
            >
              {cat === "all" ? "All" : cat}
            </button>
          ))}
        </div>
      </div>

      {filteredProjects.length === 0 ? (
        <div className="flex min-h-[400px] flex-col items-center justify-center gap-4 rounded-2xl border border-white/20 bg-white/10 backdrop-blur-lg p-10">
          <p className="text-slate-300">No tokens found in this category</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4 max-w-4xl mx-auto">
          {filteredProjects.map((project) => {
            const createdDate = new Date(project.account.createdAt.toNumber() * 1000);
            const startupData = project.startupData;
            const displayName = startupData?.name || project.account.name;
            const displayDescription = startupData?.description || "";
            const displayImage = startupData?.imageUrl;
            const displayCategory = startupData?.category || project.account.category;
            
            return (
              <div
                key={project.publicKey.toBase58()}
                className="rounded-2xl border border-white/20 bg-white/10 backdrop-blur-lg p-6 transition-all hover:border-purple-500/50 hover:bg-white/15"
              >
                {/* Column Layout */}
                <div className="flex flex-col md:flex-row gap-6">
                  
                  {/* Left Column - Info */}
                  <div className="flex-1 space-y-4">
                    {/* Image and Header */}
                    {displayImage && (
                      <div className="relative h-32 w-full overflow-hidden rounded-xl border border-white/10">
                        <Image
                          src={displayImage}
                          alt={displayName}
                          fill
                          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                          className="object-cover"
                        />
                      </div>
                    )}
                    
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-white">{displayName}</h3>
                        <p className="mt-1 text-sm text-purple-300">${project.account.symbol}</p>
                      </div>
                      <span className="rounded-full bg-purple-500/20 px-3 py-1 text-xs font-medium text-purple-300">
                        {displayCategory}
                      </span>
                    </div>

                    {/* Description Preview */}
                    {displayDescription && (
                      <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-lg p-3">
                        <p className="text-sm text-slate-200 leading-relaxed line-clamp-3 font-medium">
                          {displayDescription}
                        </p>
                      </div>
                    )}

                    {/* Additional Info from Startup Data */}
                    {startupData && (
                      <div className="flex flex-wrap gap-2">
                        {startupData.stage && (
                          <span className="rounded-full bg-blue-500/20 px-2 py-1 text-xs text-blue-300">
                            {startupData.stage}
                          </span>
                        )}
                        {startupData.fundingGoal && (
                          <span className="rounded-full bg-green-500/20 px-2 py-1 text-xs text-green-300">
                            Goal: {startupData.fundingGoal} SOL
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Middle Column - Market Cap & Stats */}
                  <div className="flex-1 space-y-4">
                    {/* Market Cap - Prominent Display */}
                    <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 rounded-xl p-4 border border-white/10">
                      {project.marketCapUSD !== undefined ? (
                        <div className="text-center">
                          <div className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-2">Market Cap</div>
                          <div className="text-3xl font-bold bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">
                            ${project.marketCapUSD >= 1000000 
                              ? `${(project.marketCapUSD / 1000000).toFixed(2)}M`
                              : project.marketCapUSD >= 1000
                              ? `${(project.marketCapUSD / 1000).toFixed(2)}K`
                              : project.marketCapUSD.toFixed(2)
                            }
                          </div>
                        </div>
                      ) : (
                        <div className="text-center">
                          <div className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-2">Market Cap</div>
                          <div className="text-lg text-slate-500">Not available</div>
                        </div>
                      )}
                    </div>

                    <div className="space-y-3 text-sm bg-slate-800/50 rounded-lg p-3">
                      {/* Migration Progress Bar */}
                      <div className="space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400">Migration Progress:</span>
                          {project.bondingCurve ? (
                            <span className={`font-medium text-xs flex items-center gap-1 ${
                              project.bondingCurve.migrated ? "text-green-400" : "text-yellow-400"
                            }`}>
                              {project.bondingCurve.migrated ? (
                                <>
                                  <span>✅</span>
                                  <span>Migrated</span>
                                </>
                              ) : (
                                <>
                                  <span>{project.marketCapUSD ? Math.min(Math.round((project.marketCapUSD / 48000) * 100), 100) : 0}%</span>
                                </>
                              )}
                            </span>
                          ) : (
                            <span className="text-slate-500 text-xs">N/A</span>
                          )}
                        </div>
                        {/* Progress Bar */}
                        {project.bondingCurve && (
                          <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
                            <div 
                              className={`h-full rounded-full transition-all duration-500 ${
                                project.bondingCurve.migrated 
                                  ? "bg-gradient-to-r from-green-500 to-emerald-500" 
                                  : "bg-gradient-to-r from-purple-500 to-pink-500"
                              }`}
                              style={{ 
                                width: project.bondingCurve.migrated 
                                  ? "100%" 
                                  : `${project.marketCapUSD ? Math.min((project.marketCapUSD / 48000) * 100, 100) : 0}%` 
                              }}
                            />
                          </div>
                        )}
                      </div>

                      {/* Age of Coin */}
                      <div className="flex justify-between">
                        <span className="text-slate-400">Age:</span>
                        <span className="text-white text-xs">
                          {(() => {
                            const now = Date.now();
                            const created = createdDate.getTime();
                            const diffMs = now - created;
                            const diffMins = Math.floor(diffMs / 60000);
                            const diffHours = Math.floor(diffMs / 3600000);
                            const diffDays = Math.floor(diffMs / 86400000);
                            
                            if (diffDays > 0) return `${diffDays}d ago`;
                            if (diffHours > 0) return `${diffHours}h ago`;
                            if (diffMins > 0) return `${diffMins}m ago`;
                            return "Just now";
                          })()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right Column - Actions */}
                  <div className="flex flex-col gap-2 md:w-64">
                    {/* Show DEX trading links if migrated */}
                    {project.bondingCurve?.migrated ? (
                      <>
                        <a
                          href={`https://jup.ag/swap/SOL-${project.account.mint.toBase58()}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block w-full rounded-lg bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 px-4 py-2 text-center text-sm font-bold text-white transition-all shadow-lg hover:shadow-xl"
                        >
                          🚀 Trade on Jupiter ↗
                        </a>
                        <a
                          href={`https://raydium.io/swap/?inputCurrency=sol&outputCurrency=${project.account.mint.toBase58()}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block w-full rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 px-4 py-2 text-center text-sm font-medium text-white transition-all"
                        >
                          🌊 View on Raydium ↗
                        </a>
                      </>
                    ) : (
                      <a
                        href={`/dashboard/trade/${project.account.mint.toBase58()}`}
                        className="block w-full rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 px-4 py-2 text-center text-sm font-bold text-white transition-all shadow-lg hover:shadow-xl"
                      >
                        💰 Trade Now
                      </a>
                    )}
                    <a
                      href={`/dashboard/trade/${project.account.mint.toBase58()}/about`}
                      className="block w-full rounded-lg bg-slate-800/70 border border-white/10 px-4 py-2 text-center text-sm font-medium text-white hover:bg-slate-700 transition-all"
                    >
                      📄 Project Overview
                    </a>
                    <a
                      href={`/dashboard/vesting/${project.account.mint.toBase58()}`}
                      className="block w-full rounded-lg bg-slate-800/70 border border-emerald-500/20 px-4 py-2 text-center text-sm font-medium text-emerald-300 hover:bg-slate-700 hover:border-emerald-500/40 transition-all"
                    >
                      🔒 View Vesting
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}



