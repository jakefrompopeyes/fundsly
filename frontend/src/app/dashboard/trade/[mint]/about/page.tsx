"use client";

import React, { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import {
  fetchBondingCurveReadonly,
  fetchProjectByMint,
  fetchTokenMetadata,
} from "@/lib/anchorClient";
import {
  getSpotPriceSOLPerToken,
  type PoolState,
  type CurveParams,
} from "@/lib/pumpCurve";
import { loadStartupData, type StartupData } from "@/lib/startupData";

type MetadataView = {
  name: string;
  symbol: string;
  uri: string;
};

type ProjectDetails = {
  name: string;
  symbol: string;
  category: string;
  totalSupplyRaw: number;
  totalSupplyTokens: number;
  createdAt: number;
  owner: string;
  mint: string;
  projectPda: string;
};

type BondingCurveView = {
  virtualSol: number;
  virtualTokens: number;
  realSol: number;
  realTokens: number;
  complete: boolean;
  migrated: boolean;
  creator: string;
};

const numberFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
});

const compactFormatter = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 2,
});

export default function TokenAboutPage({
  params,
}: {
  params: Promise<{ mint: string }>;
}) {
  const { connection } = useConnection();
  const wallet = useWallet();
  const { mint } = use(params);

  const [metadata, setMetadata] = useState<MetadataView | null>(null);
  const [project, setProject] = useState<ProjectDetails | null>(null);
  const [bondingCurve, setBondingCurve] = useState<BondingCurveView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [solPriceUSD, setSolPriceUSD] = useState<number | null>(null);
  const [startupData, setStartupData] = useState<StartupData | null>(null);

  useEffect(() => {
    let active = true;

    const fetchSolPrice = async () => {
      try {
        const response = await fetch(
          "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd"
        );
        const result = await response.json();
        if (result?.solana?.usd && active) {
          setSolPriceUSD(result.solana.usd);
        }
      } catch (err) {
        console.warn("Unable to fetch SOL price:", err);
        if (active) setSolPriceUSD(null);
      }
    };

    fetchSolPrice();
    const interval = setInterval(fetchSolPrice, 5 * 60 * 1000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadDetails = async () => {
      try {
        setLoading(true);
        setError(null);

        const mintKey = new PublicKey(mint);
        const [metadataResult, projectResult, bondingCurveResult] = await Promise.all([
          fetchTokenMetadata(connection, mintKey),
          fetchProjectByMint(connection, mintKey),
          fetchBondingCurveReadonly(connection, mintKey),
        ]);

        if (!isMounted) return;

        setMetadata(metadataResult);

        if (projectResult?.account) {
          const account = projectResult.account as any;
          const totalSupplyRaw = account.totalSupply.toNumber();
          const totalSupplyTokens = totalSupplyRaw / 1_000_000;
          const createdAt = account.createdAt.toNumber();

          setProject({
            name: account.name,
            symbol: account.symbol,
            category: account.category,
            owner: account.owner.toBase58(),
            mint: account.mint.toBase58(),
            projectPda: projectResult.publicKey.toBase58(),
            totalSupplyRaw,
            totalSupplyTokens,
            createdAt,
          });
        } else {
          setProject(null);
        }

        if (bondingCurveResult) {
          setBondingCurve({
            virtualSol: bondingCurveResult.virtualSolReserves.toNumber() / 1_000_000_000,
            virtualTokens: bondingCurveResult.virtualTokenReserves.toNumber() / 1_000_000,
            realSol: bondingCurveResult.realSolReserves.toNumber() / 1_000_000_000,
            realTokens: bondingCurveResult.realTokenReserves.toNumber() / 1_000_000,
            complete: bondingCurveResult.complete,
            migrated: bondingCurveResult.migrated,
            creator: bondingCurveResult.creator.toBase58(),
          });
        } else {
          setBondingCurve(null);
        }

        // Load startup data from API (Supabase) with localStorage fallback
        const storedData = await loadStartupData(mint);
        if (storedData) {
          setStartupData(storedData);
        }
      } catch (err: any) {
        console.error("Error loading token details:", err);
        if (isMounted) {
          setError(err?.message || "Failed to load token details");
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadDetails();

    return () => {
      isMounted = false;
    };
  }, [connection, mint]);

  const bondingCurveStats = useMemo(() => {
    if (!bondingCurve) return null;

    const state: PoolState = {
      solReserves: bondingCurve.realSol,
      tokenReserves: bondingCurve.realTokens,
    };

    const params: CurveParams = {
      virtualSol: bondingCurve.virtualSol,
      virtualTokens: bondingCurve.virtualTokens,
      feeBps: 100,
    };

    const price = getSpotPriceSOLPerToken(state, params);
    const totalSupplyTokens = project?.totalSupplyTokens ?? 1_000_000_000;
    const marketCapSol = price * totalSupplyTokens;
    const marketCapUsd = solPriceUSD ? marketCapSol * solPriceUSD : null;

    return {
      price,
      marketCapSol,
      marketCapUsd,
      solRaised: bondingCurve.realSol,
      tokensRemaining: bondingCurve.realTokens,
      params,
    };
  }, [bondingCurve, project?.totalSupplyTokens, solPriceUSD]);

  const displayName =
    metadata?.name || project?.name || `Token ${mint.slice(0, 4)}…${mint.slice(-4)}`;
  const displaySymbol = metadata?.symbol || project?.symbol;
  const createdAt = project ? new Date(project.createdAt * 1000) : null;

  return (
    <div className="space-y-6">
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Link
              href={`/dashboard/trade/${mint}`}
              className="text-purple-300 hover:text-purple-200 transition-colors text-sm"
            >
              ← Back to Trading
            </Link>
            <h1 className="text-3xl font-bold text-white mt-2">{displayName}</h1>
            {displaySymbol && (
              <p className="text-purple-300 font-semibold mt-1">${displaySymbol}</p>
            )}
            <p className="text-xs text-slate-400 mt-3 font-mono break-all">
              Mint: {mint}
            </p>
          </div>

          {metadata?.uri && metadata.uri.startsWith("http") && (
            <div className="relative h-24 w-24 overflow-hidden rounded-2xl border border-white/20">
              <Image
                src={metadata.uri}
                alt={metadata.name || "Token artwork"}
                fill
                sizes="96px"
                className="object-cover"
                unoptimized
                priority
              />
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-10 border border-white/20">
          <p className="text-slate-300 text-sm">Loading token overview...</p>
        </div>
      ) : error ? (
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-6">
          <h2 className="text-red-200 font-semibold mb-2">Unable to Load Details</h2>
          <p className="text-sm text-red-100">{error}</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-1 bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 space-y-4">
              <h2 className="text-lg font-semibold text-white">Project Snapshot</h2>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Category</span>
                  <span className="rounded-full bg-purple-500/20 px-3 py-1 text-xs font-medium text-purple-200">
                    {project?.category || "Unspecified"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Total Supply</span>
                  <span className="text-white font-mono text-xs">
                    {project
                      ? numberFormatter.format(project.totalSupplyTokens)
                      : "1,000,000,000"}{" "}
                    tokens
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Created</span>
                  <span className="text-white text-xs">
                    {createdAt ? createdAt.toLocaleDateString() : "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Creator</span>
                  <span className="text-xs text-purple-200 font-mono break-all text-right">
                    {project?.owner
                      ? `${project.owner.slice(0, 4)}…${project.owner.slice(-4)}`
                      : "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Project PDA</span>
                  <span className="text-xs text-slate-300 font-mono break-all text-right">
                    {project?.projectPda
                      ? `${project.projectPda.slice(0, 4)}…${project.projectPda.slice(-4)}`
                      : "—"}
                  </span>
                </div>
              </div>
              <div className="pt-4 border-t border-white/10">
                <Link
                  href={`https://solscan.io/token/${mint}?cluster=devnet`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg border border-white/20 px-4 py-2 text-sm text-white hover:bg-white/10 transition-all"
                >
                  View on Solscan ↗
                </Link>
              </div>
            </div>

            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
                <h2 className="text-lg font-semibold text-white mb-4">Token Performance</h2>
                {bondingCurveStats ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 text-sm">
                    <StatCard
                      label="Spot Price"
                      value={`${bondingCurveStats.price.toFixed(9)} SOL`}
                    />
                    <StatCard
                      label="Market Cap (SOL)"
                      value={numberFormatter.format(bondingCurveStats.marketCapSol)}
                    />
                    <StatCard
                      label="Market Cap (USD)"
                      value={
                        bondingCurveStats.marketCapUsd
                          ? `$${numberFormatter.format(bondingCurveStats.marketCapUsd)}`
                          : "Awaiting SOL price"
                      }
                    />
                    <StatCard
                      label="SOL Raised"
                      value={`${numberFormatter.format(bondingCurveStats.solRaised)} SOL`}
                    />
                    <StatCard
                      label="Tokens Remaining in Curve"
                      value={`${compactFormatter.format(
                        bondingCurveStats.tokensRemaining
                      )} tokens`}
                    />
                    <StatCard
                      label="Migration Status"
                      value={
                        bondingCurve?.migrated
                          ? "✅ Migrated to DEX"
                          : bondingCurve?.complete
                          ? "☑️ Curve complete"
                          : "⏳ Bonding curve active"
                      }
                    />
                    {/* TODO: Add LP burn status check here - fetch from separate LP burn info account */}
                  </div>

                  {/* DEX Trading Links (only show after migration) */}
                  {bondingCurve?.migrated && (
                    <div className="bg-gradient-to-br from-purple-500/20 to-blue-500/20 backdrop-blur-lg rounded-2xl p-6 border border-purple-500/30 mt-6">
                      <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        🚀 Trade on DEX Platforms
                      </h3>
                      <p className="text-sm text-slate-300 mb-4">
                        This token has migrated to Raydium! You can now trade it on various DEX platforms:
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <a
                          href={`https://raydium.io/swap/?inputCurrency=sol&outputCurrency=${mint}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl"
                        >
                          <span>🌊</span>
                          <span>Trade on Raydium</span>
                          <span className="text-xs opacity-70">↗</span>
                        </a>
                        <a
                          href={`https://jup.ag/swap/SOL-${mint}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-2 bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 text-white font-medium py-3 px-4 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl"
                        >
                          <span>🪐</span>
                          <span>Trade on Jupiter</span>
                          <span className="text-xs opacity-70">↗</span>
                        </a>
                        <a
                          href={`https://birdeye.so/token/${mint}?chain=solana`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-2 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white font-medium py-3 px-4 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl"
                        >
                          <span>🐦</span>
                          <span>View on Birdeye</span>
                          <span className="text-xs opacity-70">↗</span>
                        </a>
                        <a
                          href={`https://dexscreener.com/solana/${mint}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium py-3 px-4 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl"
                        >
                          <span>📊</span>
                          <span>View on DexScreener</span>
                          <span className="text-xs opacity-70">↗</span>
                        </a>
                      </div>
                    </div>
                  )}
                </div>
                ) : (
                  <p className="text-sm text-slate-300">
                    Bonding curve data is not available yet. The token may still be initializing.
                  </p>
                )}
              </div>

              <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <h2 className="text-lg font-semibold text-white">Investor Overview</h2>
                  {startupData && (
                    <span className="text-xs text-green-400 bg-green-900/30 px-2 py-1 rounded-full">
                      Data Available
                    </span>
                  )}
                  {!startupData && (
                    <button
                      onClick={async () => {
                        // Try to sync from localStorage to Supabase
                        if (typeof window === 'undefined') return;
                        const localStorageKey = `fundly_startup_${mint}`;
                        const localData = localStorage.getItem(localStorageKey);
                        if (localData) {
                          try {
                            const data = JSON.parse(localData);
                            const { mint: dataMint, createdAt, ...startupData } = data;
                            // Get wallet from context if available
                            if (!wallet.publicKey) {
                              alert('⚠️ Wallet not connected. Please connect your wallet to sync data.');
                              return;
                            }
                            console.log('🔄 Attempting to sync localStorage data to Supabase...');
                            console.log(`📤 Mint: ${mint}`);
                            console.log(`📤 Wallet: ${wallet.publicKey.toBase58()}`);
                            const { saveStartupData } = await import('@/lib/startupData');
                            await saveStartupData(mint, startupData, wallet.publicKey.toBase58());
                            // Reload the page data
                            const reloaded = await loadStartupData(mint);
                            if (reloaded) {
                              setStartupData(reloaded);
                              alert('✅ Data synced to Supabase successfully!');
                            } else {
                              alert('⚠️ Data synced but could not reload. Please refresh the page.');
                            }
                          } catch (error: any) {
                            console.error('Error syncing data:', error);
                            alert(`❌ Failed to sync: ${error.message}`);
                          }
                        } else {
                          alert('⚠️ No data found in localStorage for this mint.');
                        }
                      }}
                      className="text-xs text-purple-400 bg-purple-900/30 px-2 py-1 rounded-full hover:bg-purple-800/30 transition-colors"
                    >
                      🔄 Sync to Supabase
                    </button>
                  )}
                </div>
                {startupData ? (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <StartupDataPanel
                        title="Problem & Solution"
                        content={
                          <>
                            {startupData.problemStatement && (
                              <div className="mb-3">
                                <h4 className="text-xs font-semibold text-purple-300 mb-1 uppercase tracking-wide">Problem</h4>
                                <p className="text-slate-300 leading-relaxed">{startupData.problemStatement}</p>
                              </div>
                            )}
                            {startupData.solutionOverview && (
                              <div className="mb-3">
                                <h4 className="text-xs font-semibold text-purple-300 mb-1 uppercase tracking-wide">Solution</h4>
                                <p className="text-slate-300 leading-relaxed">{startupData.solutionOverview}</p>
                              </div>
                            )}
                            {startupData.valueProposition && (
                              <div>
                                <h4 className="text-xs font-semibold text-purple-300 mb-1 uppercase tracking-wide">Value Proposition</h4>
                                <p className="text-slate-300 leading-relaxed">{startupData.valueProposition}</p>
                              </div>
                            )}
                          </>
                        }
                      />
                      <StartupDataPanel
                        title="Market Opportunity"
                        content={
                          <>
                            {startupData.totalAddressableMarket && (
                              <div className="mb-3">
                                <h4 className="text-xs font-semibold text-purple-300 mb-1 uppercase tracking-wide">TAM</h4>
                                <p className="text-slate-300">{startupData.totalAddressableMarket}</p>
                              </div>
                            )}
                            {startupData.targetMarket && (
                              <div className="mb-3">
                                <h4 className="text-xs font-semibold text-purple-300 mb-1 uppercase tracking-wide">Target Market</h4>
                                <p className="text-slate-300 leading-relaxed">{startupData.targetMarket}</p>
                              </div>
                            )}
                            {startupData.competitionAnalysis && (
                              <div>
                                <h4 className="text-xs font-semibold text-purple-300 mb-1 uppercase tracking-wide">Competition</h4>
                                <p className="text-slate-300 leading-relaxed">{startupData.competitionAnalysis}</p>
                              </div>
                            )}
                          </>
                        }
                      />
                      <StartupDataPanel
                        title="Team & Traction"
                        content={
                          <>
                            {startupData.founders && (
                              <div className="mb-3">
                                <h4 className="text-xs font-semibold text-purple-300 mb-1 uppercase tracking-wide">Founders</h4>
                                <p className="text-slate-300">{startupData.founders}</p>
                                {startupData.founderLinkedIn && (
                                  <div className="mt-1">
                                    <a
                                      href={startupData.founderLinkedIn}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-xs text-purple-400 hover:text-purple-300 underline"
                                    >
                                      View LinkedIn Profiles →
                                    </a>
                                  </div>
                                )}
                              </div>
                            )}
                            {startupData.stage && (
                              <div className="mb-3">
                                <h4 className="text-xs font-semibold text-purple-300 mb-1 uppercase tracking-wide">Stage</h4>
                                <span className="inline-block rounded-full bg-purple-500/20 px-3 py-1 text-xs font-medium text-purple-200">
                                  {startupData.stage}
                                </span>
                                {startupData.teamSize && (
                                  <span className="ml-2 text-slate-300 text-xs">
                                    • {startupData.teamSize} team members
                                  </span>
                                )}
                              </div>
                            )}
                            {startupData.currentTraction && (
                              <div>
                                <h4 className="text-xs font-semibold text-purple-300 mb-1 uppercase tracking-wide">Current Traction</h4>
                                <p className="text-slate-300 leading-relaxed">{startupData.currentTraction}</p>
                              </div>
                            )}
                          </>
                        }
                      />
                      <StartupDataPanel
                        title="Funding & Use of Proceeds"
                        content={
                          <>
                            {startupData.fundingGoal && (
                              <div className="mb-3">
                                <h4 className="text-xs font-semibold text-purple-300 mb-1 uppercase tracking-wide">Funding Goal</h4>
                                <p className="text-white font-semibold text-lg">{startupData.fundingGoal} SOL</p>
                                {startupData.minimumInvestment && (
                                  <p className="text-slate-400 text-xs mt-1">
                                    Minimum investment: {startupData.minimumInvestment} SOL
                                  </p>
                                )}
                              </div>
                            )}
                            {startupData.useOfFunds && (
                              <div className="mb-3">
                                <h4 className="text-xs font-semibold text-purple-300 mb-1 uppercase tracking-wide">Use of Funds</h4>
                                <p className="text-slate-300 leading-relaxed">{startupData.useOfFunds}</p>
                              </div>
                            )}
                            {startupData.previousFunding && (
                              <div>
                                <h4 className="text-xs font-semibold text-purple-300 mb-1 uppercase tracking-wide">Previous Funding</h4>
                                <p className="text-slate-300">{startupData.previousFunding}</p>
                              </div>
                            )}
                          </>
                        }
                      />
                    </div>
                    {(startupData.website || startupData.twitter || startupData.discord || startupData.pitchDeckUrl || startupData.whitepaperUrl || startupData.githubUrl || startupData.demoUrl || startupData.videoPitchUrl) && (
                      <div className="mt-4 pt-4 border-t border-white/10">
                        <h3 className="text-sm font-semibold text-white mb-3">Resources & Links</h3>
                        <div className="flex flex-wrap gap-2">
                          {startupData.website && (
                            <a
                              href={startupData.website}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 rounded-lg border border-white/20 px-3 py-1.5 text-xs text-white hover:bg-white/10 transition-all"
                            >
                              🌐 Website
                            </a>
                          )}
                          {startupData.twitter && (
                            <a
                              href={startupData.twitter}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 rounded-lg border border-white/20 px-3 py-1.5 text-xs text-white hover:bg-white/10 transition-all"
                            >
                              🐦 Twitter
                            </a>
                          )}
                          {startupData.discord && (
                            <a
                              href={startupData.discord}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 rounded-lg border border-white/20 px-3 py-1.5 text-xs text-white hover:bg-white/10 transition-all"
                            >
                              💬 Discord
                            </a>
                          )}
                          {startupData.githubUrl && (
                            <a
                              href={startupData.githubUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 rounded-lg border border-white/20 px-3 py-1.5 text-xs text-white hover:bg-white/10 transition-all"
                            >
                              💻 GitHub
                            </a>
                          )}
                          {startupData.pitchDeckUrl && (
                            <a
                              href={startupData.pitchDeckUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 rounded-lg border border-white/20 px-3 py-1.5 text-xs text-white hover:bg-white/10 transition-all"
                            >
                              📊 Pitch Deck
                            </a>
                          )}
                          {startupData.whitepaperUrl && (
                            <a
                              href={startupData.whitepaperUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 rounded-lg border border-white/20 px-3 py-1.5 text-xs text-white hover:bg-white/10 transition-all"
                            >
                              📄 Whitepaper
                            </a>
                          )}
                          {startupData.demoUrl && (
                            <a
                              href={startupData.demoUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 rounded-lg border border-white/20 px-3 py-1.5 text-xs text-white hover:bg-white/10 transition-all"
                            >
                              🎮 Demo
                            </a>
                          )}
                          {startupData.videoPitchUrl && (
                            <a
                              href={startupData.videoPitchUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 rounded-lg border border-white/20 px-3 py-1.5 text-xs text-white hover:bg-white/10 transition-all"
                            >
                              🎥 Video Pitch
                            </a>
                          )}
                        </div>
                      </div>
                    )}
                    {(startupData.shortTermGoals || startupData.longTermVision) && (
                      <div className="mt-4 pt-4 border-t border-white/10">
                        <h3 className="text-sm font-semibold text-white mb-3">Roadmap</h3>
                        {startupData.shortTermGoals && (
                          <div className="mb-3">
                            <h4 className="text-xs font-semibold text-purple-300 mb-1 uppercase tracking-wide">Short-term Goals (3-6 months)</h4>
                            <p className="text-slate-300 leading-relaxed">{startupData.shortTermGoals}</p>
                          </div>
                        )}
                        {startupData.longTermVision && (
                          <div>
                            <h4 className="text-xs font-semibold text-purple-300 mb-1 uppercase tracking-wide">Long-term Vision (2-3 years)</h4>
                            <p className="text-slate-300 leading-relaxed">{startupData.longTermVision}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <p className="text-sm text-slate-300 leading-relaxed">
                      This section displays comprehensive information about the startup—problem,
                      solution, team, traction, roadmap, and fundraising plans. The data is populated
                      from the startup creation form.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <PlaceholderPanel title="Problem & Solution" />
                      <PlaceholderPanel title="Market Opportunity" />
                      <PlaceholderPanel title="Team & Traction" />
                      <PlaceholderPanel title="Funding & Use of Proceeds" />
                    </div>
                    <p className="text-xs text-slate-400">
                      No startup data found for this token. Data is stored locally and will be available
                      after the creator fills out the startup creation form.
                    </p>
                  </>
                )}
              </div>

              <div className="bg-purple-500/10 border border-purple-500/30 rounded-2xl p-6 text-sm text-purple-100">
                <h3 className="text-purple-200 font-semibold mb-2">💡 Note</h3>
                <p className="text-xs">
                  Startup data is currently stored in browser localStorage. In production, replace
                  the localStorage calls with API endpoints to your backend (Supabase, Firestore, etc.)
                  for persistent, shareable data across all users.
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-slate-900/40 p-4">
      <p className="text-xs text-slate-400 uppercase tracking-wide">{label}</p>
      <p className="mt-2 text-base font-semibold text-white">{value}</p>
    </div>
  );
}

function PlaceholderPanel({ title }: { title: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-slate-900/40 p-4">
      <h3 className="text-sm font-semibold text-white mb-2">{title}</h3>
      <p className="text-xs text-slate-400 leading-relaxed">
        Connect your data source to display this section. Consider highlighting bullet-point
        insights, metrics, or a short narrative investors can quickly scan.
      </p>
    </div>
  );
}

function StartupDataPanel({ 
  title, 
  content 
}: { 
  title: string; 
  content: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-slate-900/40 p-4">
      <h3 className="text-sm font-semibold text-white mb-3">{title}</h3>
      <div className="text-sm">
        {content}
      </div>
    </div>
  );
}

