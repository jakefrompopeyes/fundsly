"use client";

import { useState, useEffect } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { rpc_initializeGlobalConfig, deriveGlobalConfigPda } from "@/lib/anchorClient";
import { 
  MARKET_CAP_PRESETS, 
  getRecommendedConfig,
  formatNumber,
  type MarketCapPreset 
} from "@/lib/marketCapCalculator";

export default function InitConfigPage() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Market cap selection
  const [selectedPreset, setSelectedPreset] = useState<MarketCapPreset>(MARKET_CAP_PRESETS[0]);
  const [customMarketCap, setCustomMarketCap] = useState<string>("");
  const [useCustom, setUseCustom] = useState(false);
  const [solPriceUSD, setSolPriceUSD] = useState(200); // Default SOL price
  const [fetchingPrice, setFetchingPrice] = useState(false);
  const [priceLastUpdated, setPriceLastUpdated] = useState<Date | null>(null);
  
  // Fetch current SOL price from CoinGecko
  const fetchSolPrice = async () => {
    setFetchingPrice(true);
    try {
      const response = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd'
      );
      const data = await response.json();
      if (data.solana && data.solana.usd) {
        setSolPriceUSD(data.solana.usd);
        setPriceLastUpdated(new Date());
      }
    } catch (err) {
      console.error('Failed to fetch SOL price:', err);
      // Keep the current/default price if fetch fails
    } finally {
      setFetchingPrice(false);
    }
  };

  // Fetch price on component mount
  useEffect(() => {
    fetchSolPrice();
  }, []);
  
  // Calculate configuration based on selected market cap
  const config = getRecommendedConfig(
    useCustom && customMarketCap ? parseFloat(customMarketCap) : selectedPreset.marketCapUSD,
    solPriceUSD
  );

  const handleInitialize = async () => {
    if (!wallet.publicKey) {
      setError("Please connect your wallet first");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      console.log("Initializing global config...");
      console.log("Virtual SOL:", config.virtualSol);
      console.log("Virtual Tokens:", config.virtualTokens);
      
      // Raydium AMM V4 Program ID (works on mainnet and devnet)
      const RAYDIUM_AMM_PROGRAM = new PublicKey("675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8");
      
      // Default treasury address (can be changed later via treasury management page)
      const defaultTreasury = new PublicKey("DF6KTfmnnJTCEMS8JkHhq64qwfTnrJL4UTgiFJdEwrJj");
      
      const signature = await rpc_initializeGlobalConfig(
        connection,
        wallet,
        defaultTreasury,                 // Treasury - receives all platform fees automatically
        30,                               // Virtual SOL reserves (pump.fun-like)
        350_000_000,                      // Virtual token reserves (350M)
        1_000_000_000,                   // 1 billion default initial supply (raw units with 6 decimals)
        100,                             // 1% fee (100 basis points)
        84,                              // 84 SOL migration threshold (slightly under theoretical cap)
        RAYDIUM_AMM_PROGRAM              // Raydium AMM program ID
      );

      const globalConfigPda = await deriveGlobalConfigPda();
      
      const marketCapDesc = useCustom && customMarketCap 
        ? `$${parseFloat(customMarketCap).toLocaleString()}`
        : `${selectedPreset.name} ($${selectedPreset.marketCapUSD.toLocaleString()})`;
      
      setResult(`✅ Global config initialized successfully!

Configuration: ${marketCapDesc}
Initial Market Cap: $${config.marketCapUSD.toLocaleString()} (${config.marketCapSol.toFixed(2)} SOL)
Treasury: ${defaultTreasury.toBase58()}
Virtual SOL: 30 SOL
Virtual Tokens: ${formatNumber(350_000_000)}
Migration Threshold: 84 SOL
Platform Fee: 1% (auto-collected to treasury)

Transaction: ${signature}
Global Config PDA: ${globalConfigPda.toBase58()}

View on Explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet`);
      
    } catch (err) {
      console.error("Error:", err);
      const error = err as Error;
      
      if (error.message?.includes("already in use") || error.message?.includes("0x0")) {
        setError("ℹ️ Global config already exists! You&apos;re all set.");
      } else {
        setError(`Error: ${error.message || String(err)}`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20">
          <h1 className="text-3xl font-bold text-white mb-2">
            🔧 Initialize Global Config
          </h1>
          <p className="text-slate-300 mb-8">
            Set the initial market cap for new token launches. Choose a preset or enter a custom value.
          </p>

          {/* SOL Price Input */}
          <div className="mb-6 bg-slate-800/50 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-slate-300">
                Current SOL Price (USD)
              </label>
              <button
                onClick={fetchSolPrice}
                disabled={fetchingPrice}
                className="px-3 py-1 text-xs bg-purple-600 hover:bg-purple-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center gap-1"
              >
                {fetchingPrice ? (
                  <>
                    <span className="animate-spin">⟳</span>
                    Fetching...
                  </>
                ) : (
                  <>
                    <span>🔄</span>
                    Refresh Price
                  </>
                )}
              </button>
            </div>
            <input
              type="number"
              value={solPriceUSD}
              onChange={(e) => setSolPriceUSD(parseFloat(e.target.value) || 200)}
              className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
              placeholder="200"
            />
            <div className="flex items-center justify-between mt-1">
              <p className="text-xs text-slate-400">
                💡 Price auto-fetched from CoinGecko
              </p>
              {priceLastUpdated && (
                <p className="text-xs text-green-400">
                  ✓ Updated {priceLastUpdated.toLocaleTimeString()}
                </p>
              )}
            </div>
          </div>

          {/* Market Cap Presets */}
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-white mb-4">
              Select Initial Market Cap
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
              {MARKET_CAP_PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  onClick={() => {
                    setSelectedPreset(preset);
                    setUseCustom(false);
                  }}
                  className={`p-4 rounded-xl border-2 transition-all text-left ${
                    !useCustom && selectedPreset.name === preset.name
                      ? "border-purple-500 bg-purple-500/20"
                      : "border-slate-600 bg-slate-800/50 hover:border-slate-500"
                  }`}
                >
                  <div className="font-semibold text-white mb-1">{preset.name}</div>
                  <div className="text-2xl font-bold text-purple-400 mb-2">
                    ${(preset.marketCapUSD / 1000).toFixed(1)}k
                  </div>
                  <div className="text-xs text-slate-400 mb-1">{preset.description}</div>
                  <div className="text-xs text-slate-500">{preset.useCase}</div>
                </button>
              ))}
            </div>

            {/* Custom Market Cap */}
            <div className="bg-slate-800/50 rounded-xl p-4">
              <label className="flex items-center mb-2">
                <input
                  type="checkbox"
                  checked={useCustom}
                  onChange={(e) => setUseCustom(e.target.checked)}
                  className="mr-2 w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                />
                <span className="text-sm font-medium text-slate-300">
                  Use Custom Market Cap
                </span>
              </label>
              
              {useCustom && (
                <input
                  type="number"
                  value={customMarketCap}
                  onChange={(e) => setCustomMarketCap(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                  placeholder="Enter custom market cap (USD)"
                />
              )}
            </div>
          </div>

          {/* Calculated Configuration */}
          <div className="bg-slate-800/50 rounded-xl p-6 mb-6">
            <h2 className="text-lg font-semibold text-white mb-4">
              Calculated Configuration
            </h2>
            
            <div className="space-y-2 text-sm mb-4">
              <div className="flex justify-between items-center py-2 border-b border-slate-700">
                <span className="text-slate-400">Initial Market Cap:</span>
                <span className="text-white font-mono font-bold">
                  ${config.marketCapUSD.toLocaleString()} ({config.marketCapSol.toFixed(2)} SOL)
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-slate-700">
                <span className="text-slate-400">Initial Price per Token:</span>
                <span className="text-white font-mono">
                  {config.initialPriceSol.toExponential(3)} SOL
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-slate-700">
                <span className="text-slate-400">Virtual SOL Reserves:</span>
                <span className="text-white font-mono">{config.virtualSol} SOL</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-slate-700">
                <span className="text-slate-400">Virtual Token Reserves:</span>
                <span className="text-white font-mono">{formatNumber(config.virtualTokens)}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-slate-700">
                <span className="text-slate-400">Initial Token Supply:</span>
                <span className="text-white font-mono">1,000,000,000 tokens</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-slate-700">
                <span className="text-slate-400">Platform Fee:</span>
                <span className="text-white font-mono">100 bps (1%)</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-slate-400">Migration Threshold:</span>
                <span className="text-white font-mono">85 SOL</span>
              </div>
            </div>

            {/* Cost Analysis */}
            <div className="mt-4 pt-4 border-t border-slate-600">
              <p className="text-xs text-slate-400 mb-2">💡 Cost to buy tokens:</p>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">10% of supply:</span>
                  <span className="text-blue-400 font-mono">
                    ~{config.costs.buy10Percent.toFixed(2)} SOL
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">25% of supply:</span>
                  <span className="text-green-400 font-mono">
                    ~{config.costs.buy25Percent.toFixed(2)} SOL
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">50% of supply:</span>
                  <span className="text-yellow-400 font-mono">
                    ~{config.costs.buy50Percent.toFixed(2)} SOL
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">90% of supply:</span>
                  <span className="text-red-400 font-mono">
                    ~{config.costs.buy90Percent.toFixed(2)} SOL
                  </span>
                </div>
              </div>
            </div>

            {config.warning && (
              <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                <p className="text-red-300 text-sm">⚠️ {config.warning}</p>
              </div>
            )}
          </div>

          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 mb-6">
            <p className="text-yellow-200 text-sm">
              ⚠️ <strong>Important:</strong> This should only be run ONCE by the platform admin.
              Make sure you&apos;re connected with the wallet that deployed the program.
            </p>
          </div>

          {!wallet.connected ? (
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 mb-6">
              <p className="text-blue-200 text-sm">
                👉 Please connect your wallet to continue
              </p>
            </div>
          ) : (
            <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 mb-6">
              <p className="text-green-200 text-sm">
                ✓ Connected: {wallet.publicKey!.toBase58().slice(0, 8)}...
                {wallet.publicKey!.toBase58().slice(-8)}
              </p>
            </div>
          )}

          <button
            onClick={handleInitialize}
            disabled={loading || !wallet.connected || (useCustom && !customMarketCap)}
            className="w-full py-4 px-6 rounded-xl font-semibold text-white
                     bg-gradient-to-r from-purple-600 to-pink-600
                     hover:from-purple-500 hover:to-pink-500
                     disabled:opacity-50 disabled:cursor-not-allowed
                     transition-all duration-200"
          >
            {loading ? "Initializing..." : "Initialize Global Config"}
          </button>

          {result && (
            <div className="mt-6 bg-green-500/10 border border-green-500/30 rounded-xl p-4">
              <pre className="text-green-200 text-sm whitespace-pre-wrap font-mono">
                {result}
              </pre>
            </div>
          )}

          {error && (
            <div className="mt-6 bg-red-500/10 border border-red-500/30 rounded-xl p-4">
              <p className="text-red-200 text-sm">{error}</p>
            </div>
          )}
        </div>

        <div className="mt-6 text-center">
          <a
            href="/dashboard"
            className="text-purple-300 hover:text-purple-200 transition-colors"
          >
            ← Back to Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
