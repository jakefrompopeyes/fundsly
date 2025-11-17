"use client";

import { useEffect, useMemo, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { getCurrentSolPrice } from "@/lib/marketCapCalculator";

/**
 * Plain-language overview:
 * This is a minimal dashboard page with a top bar. On the right side, it shows the visitor's
 * current wallet balance when connected. The rest of the page is a blank canvas for future widgets.
 */
export default function DashboardPageClient() {
  const { connection } = useConnection();
  const { publicKey, connected } = useWallet();

  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [solPrice, setSolPrice] = useState<number | null>(null);
  const [showUsdPrimary, setShowUsdPrimary] = useState(false);
  const [isFlipping, setIsFlipping] = useState(false);

  const clusterLabel = useMemo(() => {
    const raw = process.env.NEXT_PUBLIC_SOLANA_NETWORK?.toLowerCase();
    if (raw === "mainnet" || raw === "mainnet-beta") return "Mainnet Beta";
    if (raw === "testnet") return "Testnet";
    if (raw === "devnet") return "Devnet";
    // Default to devnet for testing
    return "Devnet";
  }, []);

  // Fetch SOL price on mount and refresh periodically
  useEffect(() => {
    const fetchPrice = async () => {
      try {
        const price = await getCurrentSolPrice();
        setSolPrice(price);
      } catch (error) {
        console.error('Failed to fetch SOL price:', error);
      }
    };
    
    fetchPrice();
    // Refresh price every 60 seconds
    const interval = setInterval(fetchPrice, 60000);
    
    return () => clearInterval(interval);
  }, []);

  const handleBalanceClick = () => {
    if (balance !== null && solPrice !== null) {
      setIsFlipping(true);
      setTimeout(() => {
        setShowUsdPrimary(!showUsdPrimary);
        setIsFlipping(false);
      }, 150);
    }
  };

  useEffect(() => {
    if (!connected || !publicKey) {
      setBalance(null);
      return;
    }
    let live = true;
    const run = async () => {
      setLoading(true);
      try {
        const lamports = await connection.getBalance(publicKey);
        if (live) setBalance(lamports / LAMPORTS_PER_SOL);
      } catch {
        if (live) setBalance(null);
      } finally {
        if (live) setLoading(false);
      }
    };
    run();
    // Optionally refresh on an interval in the future
    return () => {
      live = false;
    };
  }, [connection, connected, publicKey]);

  return (
    <div className="space-y-6">
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20">
        <h1 className="text-3xl font-bold text-white mb-2">
          Welcome to Fundsly 🚀
        </h1>
        <p className="text-slate-300">
          Your decentralized platform for launching and trading startup tokens. Will you find the next unicorn?
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" style={{ perspective: '1000px' }}>
        {/* Quick Stats */}
        <div 
          className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 cursor-pointer hover:bg-white/[0.12] hover:border-white/30 hover:shadow-xl hover:shadow-purple-500/20 transition-all duration-200 active:scale-[0.98]"
          onClick={handleBalanceClick}
          style={{
            transform: isFlipping ? 'rotateX(180deg)' : 'rotateX(0deg)',
            transition: 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
            transformStyle: 'preserve-3d',
          }}
        >
          <div className="flex items-center gap-3 mb-4">
            <span className="text-3xl">💰</span>
            <h2 className="text-xl font-semibold text-white">Your Balance</h2>
          </div>
          <div className="flex flex-col gap-1">
            {!showUsdPrimary ? (
              <>
                <p className="text-3xl font-bold text-purple-300">
                  {connected ? (loading ? "Loading..." : balance !== null ? `${balance.toFixed(4)} SOL` : "N/A") : "Connect Wallet"}
                </p>
                {connected && balance !== null && solPrice !== null && (
                  <p className="text-sm text-slate-400 font-light">
                    ${(balance * solPrice).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                  </p>
                )}
              </>
            ) : (
              <>
                <p className="text-3xl font-bold text-purple-300">
                  {connected && balance !== null && solPrice !== null ? `$${(balance * solPrice).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "Connect Wallet"}
                </p>
                {connected && balance !== null && (
                  <p className="text-sm text-slate-400 font-light">
                    {balance.toFixed(4)} SOL
                  </p>
                )}
              </>
            )}
          </div>
        </div>

        {/* Create Token */}
        <a href="/dashboard/create-startup" className="glass-button glass-button-primary rounded-2xl p-6 border border-purple-500/50 hover:border-purple-400/70 transition-all group block">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-3xl">🎨</span>
            <h2 className="text-xl font-semibold text-white">Create Token</h2>
          </div>
          <p className="text-slate-300 group-hover:text-white transition-colors">
            Launch your own startup token with an automated bonding curve
          </p>
        </a>

        {/* Explore Market */}
        <a href="/dashboard/market" className="glass-button rounded-2xl p-6 border border-blue-500/50 hover:border-blue-400/70 transition-all group block" style={{
          background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.4), rgba(6, 182, 212, 0.4))',
          borderColor: 'rgba(59, 130, 246, 0.5)',
        }}>
          <div className="flex items-center gap-3 mb-4">
            <span className="text-3xl">🔍</span>
            <h2 className="text-xl font-semibold text-white">Market</h2>
          </div>
          <p className="text-slate-300 group-hover:text-white transition-colors">
            Discover and trade startup tokens in the marketplace
          </p>
        </a>
      </div>

      {/* Info Section */}
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20">
        <h2 className="text-2xl font-bold text-white mb-4">How It Works</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-slate-800/50 rounded-xl p-4">
            <div className="text-2xl mb-3">1️⃣</div>
            <h3 className="font-semibold text-white mb-2">Create Your Token</h3>
            <p className="text-sm text-slate-400">
              Launch a token for your startup with automated bonding curve pricing
            </p>
          </div>
          <div className="bg-slate-800/50 rounded-xl p-4">
            <div className="text-2xl mb-3">2️⃣</div>
            <h3 className="font-semibold text-white mb-2">Users Trade</h3>
            <p className="text-sm text-slate-400">
              Instant liquidity through bonding curves - no need for traditional liquidity pools
            </p>
          </div>
          <div className="bg-slate-800/50 rounded-xl p-4">
            <div className="text-2xl mb-3">3️⃣</div>
            <h3 className="font-semibold text-white mb-2">Auto-Migration</h3>
            <p className="text-sm text-slate-400">
              When threshold is reached, tokens automatically migrate to Raydium DEX
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

