"use client";

import { use, useState, useEffect } from "react";
import Link from "next/link";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import BondingCurveTrader from "@/components/trading/BondingCurveTrader";
import TransactionHistory from "@/components/trading/TransactionHistory";
import PriceChart from "@/components/trading/PriceChart";
import TopHoldersList from "@/components/trading/TopHoldersList";
import { fetchBondingCurve, fetchTokenMetadata } from "@/lib/anchorClient";
import { getSpotPriceSOLPerToken, type PoolState, type CurveParams } from "@/lib/pumpCurve";

export default function TradePage({
  params,
}: {
  params: Promise<{ mint: string }>;
}) {
  const { mint } = use(params);
  const { connection } = useConnection();
  const wallet = useWallet();

  const [poolState, setPoolState] = useState<PoolState | null>(null);
  const [curveParams, setCurveParams] = useState<CurveParams | null>(null);
  const [spotPrice, setSpotPrice] = useState<number>(0);
  const [totalSupply, setTotalSupply] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [tokenSymbol, setTokenSymbol] = useState<string>("TOKEN");
  const [tokenName, setTokenName] = useState<string>("Token");

  // Fetch bonding curve data
  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      if (!wallet.publicKey) {
        // Set loading to false even without wallet
        if (isMounted) setLoading(false);
        return;
      }

      try {
        // Only show loading on initial load, not on refreshes
        if (isMounted && !poolState) setLoading(true);
        const mintPubkey = new PublicKey(mint);
        
        // Fetch token metadata
        const metadata = await fetchTokenMetadata(connection, mintPubkey);
        if (metadata && isMounted) {
          setTokenSymbol(metadata.symbol || "TOKEN");
          setTokenName(metadata.name || "Token");
        }
        
        const data = await fetchBondingCurve(connection, wallet, mintPubkey);

        const state: PoolState = {
          solReserves: data.realSolReserves.toNumber() / 1_000_000_000,
          tokenReserves: data.realTokenReserves.toNumber() / 1_000_000,
        };

        const params: CurveParams = {
          virtualSol: data.virtualSolReserves.toNumber() / 1_000_000_000,
          virtualTokens: data.virtualTokenReserves.toNumber() / 1_000_000,
          feeBps: 100,
        };

        // Fetch total supply from the initial token supply in global config
        // For now, we'll use a standard supply of 1 billion tokens (1e9 with 6 decimals)
        // This matches the common bonding curve setup
        const standardTotalSupply = 1_000_000_000; // 1 billion tokens
        
        if (isMounted) {
          setPoolState(state);
          setCurveParams(params);
          setTotalSupply(standardTotalSupply);

          const price = getSpotPriceSOLPerToken(state, params);
          console.log("Trade page data:", {
            state,
            params,
            price,
            totalSupply: standardTotalSupply,
            marketCapSOL: price * standardTotalSupply
          });
          setSpotPrice(price);
        }
      } catch (error) {
        console.error("Error fetching bonding curve data:", error);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchData();

    // Auto-refresh every 15 seconds (reduced to avoid rate limiting)
    const interval = setInterval(() => {
      if (isMounted && wallet.publicKey) {
        fetchData();
      }
    }, 15000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [mint, wallet.publicKey, connection]);

  return (
    <div className="space-y-6">
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            onClick={() => window.history.back()}
            className="text-purple-300 hover:text-purple-200 transition-colors flex items-center gap-2 text-sm"
          >
            ← Back to Market
          </button>
          <Link
            href={`/dashboard/trade/${mint}/about`}
            className="inline-flex items-center gap-2 rounded-lg border border-purple-500/40 bg-purple-500/10 px-4 py-2 text-sm font-medium text-purple-100 hover:bg-purple-500/20 transition-all"
          >
            Learn About This Startup ↗
          </Link>
        </div>
        <div>
          <h1 className="text-3xl font-bold text-white">
            Trade Token
          </h1>
          <p className="text-slate-300 mt-2 font-mono text-sm">
            Mint: {mint.slice(0, 8)}...{mint.slice(-8)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left Column - Trading Interface */}
        <div className="xl:col-span-1 space-y-6">
          <BondingCurveTrader
            mintAddress={mint}
            tokenSymbol={tokenSymbol}
            tokenName={tokenName}
          />

          {/* Top Holders List */}
          <TopHoldersList mintAddress={mint} tokenSymbol={tokenSymbol} />
        </div>

        {/* Right Column - Chart and Transactions */}
        <div className="xl:col-span-2 space-y-6">
          {/* Price Chart */}
          <PriceChart
            mintAddress={mint}
            currentPrice={spotPrice}
            tokenSymbol={tokenSymbol}
            totalSupply={totalSupply}
          />
          
          {/* Transaction History */}
          <TransactionHistory mintAddress={mint} tokenSymbol={tokenSymbol} />
        </div>
      </div>
    </div>
  );
}

