"use client";

import { useState, useEffect } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddress, getAccount } from "@solana/spl-token";
import {
  rpc_buyTokens,
  rpc_sellTokens,
  fetchBondingCurve,
  fetchGlobalConfig,
} from "@/lib/anchorClient";
import {
  quoteBuyTokens,
  quoteSellTokens,
  getSpotPriceSOLPerToken,
  calculateBuyPriceImpact,
  calculateSellPriceImpact,
  getMigrationProgress,
  shouldMigrate,
  getMigrationStatusText,
  type PoolState,
  type CurveParams,
} from "@/lib/pumpCurve";

interface BondingCurveTraderProps {
  mintAddress: string;
  tokenSymbol: string;
  tokenName: string;
}

export default function BondingCurveTrader({
  mintAddress,
  tokenSymbol,
  tokenName,
}: BondingCurveTraderProps) {
  const { connection } = useConnection();
  const wallet = useWallet();

  const [mode, setMode] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Bonding curve state
  const [curveData, setCurveData] = useState<any | null>(null);
  const [poolState, setPoolState] = useState<PoolState | null>(null);
  const [curveParams, setCurveParams] = useState<CurveParams | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [migrationThreshold, setMigrationThreshold] = useState<number>(0);

  // Calculation results
  const [estimatedOutput, setEstimatedOutput] = useState<number>(0);
  const [priceImpact, setPriceImpact] = useState<number>(0);
  const [spotPrice, setSpotPrice] = useState<number>(0);
  const [userTokenBalance, setUserTokenBalance] = useState<number>(0);

  // Fetch bonding curve data
  const fetchCurveData = async () => {
    if (!wallet.publicKey) return;
    
    try {
      setRefreshing(true);
      const mint = new PublicKey(mintAddress);
      const data = await fetchBondingCurve(connection, wallet, mint);
      setCurveData(data);

      // Fetch global config to get migration threshold
      const globalConfig = await fetchGlobalConfig(connection, wallet);
      const thresholdSol = globalConfig.migrationThresholdSol.toNumber() / 1_000_000_000;
      setMigrationThreshold(thresholdSol);

      // Convert to UI-friendly format
      const state: PoolState = {
        solReserves: data.realSolReserves.toNumber() / 1_000_000_000, // lamports to SOL
        tokenReserves: data.realTokenReserves.toNumber() / 1_000_000, // raw to tokens
      };

      const params: CurveParams = {
        virtualSol: data.virtualSolReserves.toNumber() / 1_000_000_000,
        virtualTokens: data.virtualTokenReserves.toNumber() / 1_000_000,
        feeBps: 100, // Assume 1% fee (100 basis points)
      };

      setPoolState(state);
      setCurveParams(params);

      // Calculate spot price
      const price = getSpotPriceSOLPerToken(state, params);
      setSpotPrice(price);

      // Fetch user's token balance
      try {
        const mint = new PublicKey(mintAddress);
        const userTokenAccount = await getAssociatedTokenAddress(
          mint,
          wallet.publicKey
        );
        const accountInfo = await getAccount(connection, userTokenAccount);
        const balance = Number(accountInfo.amount) / 1_000_000; // Convert to token amount
        setUserTokenBalance(balance);
      } catch (balanceErr) {
        // User might not have a token account yet
        console.log("No token account found or error fetching balance:", balanceErr);
        setUserTokenBalance(0);
      }
    } catch (err: any) {
      console.error("Error fetching bonding curve:", err);
      setError(err.message || "Failed to fetch bonding curve data");
    } finally {
      setRefreshing(false);
    }
  };

  // Fetch on mount and when mint changes
  useEffect(() => {
    if (wallet.publicKey) {
      fetchCurveData();
    }
  }, [wallet.publicKey, mintAddress]);

  // Update estimates when amount or mode changes
  useEffect(() => {
    if (!poolState || !curveParams || !amount || parseFloat(amount) <= 0) {
      setEstimatedOutput(0);
      setPriceImpact(0);
      return;
    }

    const inputAmount = parseFloat(amount);

    try {
      if (mode === "buy") {
        const { tokensOut } = quoteBuyTokens(poolState, curveParams, inputAmount);
        setEstimatedOutput(tokensOut);
        const impact = calculateBuyPriceImpact(poolState, curveParams, inputAmount);
        setPriceImpact(impact);
      } else {
        const { solOut } = quoteSellTokens(poolState, curveParams, inputAmount);
        setEstimatedOutput(solOut);
        const impact = calculateSellPriceImpact(poolState, curveParams, inputAmount);
        setPriceImpact(impact);
      }
    } catch (err) {
      console.error("Error calculating estimates:", err);
    }
  }, [amount, mode, poolState, curveParams]);

  const handleTrade = async () => {
    if (!wallet.publicKey) {
      setError("Please connect your wallet");
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      setError("Please enter a valid amount");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const mint = new PublicKey(mintAddress);
      const inputAmount = parseFloat(amount);

      if (mode === "buy") {
        const signature = await rpc_buyTokens(
          connection,
          wallet,
          mint,
          inputAmount,
          0.01, // 1% slippage tolerance
        );
        setSuccess(`Successfully bought ${estimatedOutput.toFixed(4)} ${tokenSymbol}! TX: ${signature}`);
      } else {
        const signature = await rpc_sellTokens(
          connection,
          wallet,
          mint,
          inputAmount,
          0.01, // 1% slippage tolerance
        );
        setSuccess(`Successfully sold ${inputAmount} ${tokenSymbol} for ${estimatedOutput.toFixed(4)} SOL! TX: ${signature}`);
      }

      // Refresh curve data
      setTimeout(() => fetchCurveData(), 2000);
      setAmount("");
    } catch (err: any) {
      console.error("Trade error:", err);
      setError(err.message || "Transaction failed");
    } finally {
      setLoading(false);
    }
  };

  const isComplete = curveData ? curveData.complete : false;

  return (
    <div className="w-full bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 p-6">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white mb-2">
          Trade {tokenSymbol}
        </h2>
        <p className="text-sm text-slate-300">{tokenName}</p>
      </div>

      {/* Migration Progress */}
      {poolState && curveData && migrationThreshold > 0 && (
        <div className="mb-6 p-4 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-xl border border-purple-500/30">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-white">
              🚀 DEX Migration Progress
            </span>
            <div className="flex items-center gap-2">
              {curveData.migrated && (
                <span className="text-xs px-2 py-1 bg-green-500 text-white rounded-full">
                  Migrated!
                </span>
              )}
              <button
                onClick={fetchCurveData}
                disabled={refreshing}
                className="text-xs text-purple-300 hover:text-purple-200 transition-colors"
              >
                {refreshing ? "Refreshing..." : "Refresh"}
              </button>
            </div>
          </div>
          <div className="w-full bg-slate-800/70 rounded-full h-2 mb-2">
            <div
              className={`h-2 rounded-full transition-all duration-300 ${
                shouldMigrate(poolState, migrationThreshold)
                  ? "bg-gradient-to-r from-green-500 to-emerald-500"
                  : "bg-gradient-to-r from-purple-500 to-pink-500"
              }`}
              style={{ width: `${Math.min(getMigrationProgress(poolState, migrationThreshold), 100)}%` }}
            />
          </div>
          <div className="text-xs text-purple-200">
            {getMigrationStatusText(poolState, migrationThreshold)}
          </div>
          {shouldMigrate(poolState, migrationThreshold) && !curveData.migrated && (
            <div className="mt-3 text-xs text-purple-100 bg-purple-500/20 p-2 rounded border border-purple-500/30">
              ✨ This token has reached the migration threshold and will be listed on Raydium!
            </div>
          )}
        </div>
      )}

      {/* Stats */}
      {poolState && curveParams && (
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="p-3 bg-slate-800/50 rounded-xl border border-white/10">
            <div className="text-xs text-slate-400 mb-1">
              Spot Price
            </div>
            <div className="text-lg font-semibold text-white font-mono">
              {spotPrice.toFixed(8)} SOL
            </div>
          </div>
          <div className="p-3 bg-slate-800/50 rounded-xl border border-white/10">
            <div className="text-xs text-slate-400 mb-1">
              Liquidity (SOL)
            </div>
            <div className="text-lg font-semibold text-white font-mono">
              {poolState.solReserves.toFixed(2)}
            </div>
          </div>
        </div>
      )}

      {/* Buy/Sell Toggle */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setMode("buy")}
          className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${
            mode === "buy"
              ? "bg-gradient-to-r from-green-600 to-emerald-600 text-white"
              : "bg-white/10 border border-white/20 text-slate-300 hover:bg-white/20"
          }`}
        >
          Buy
        </button>
        <button
          onClick={() => setMode("sell")}
          className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${
            mode === "sell"
              ? "bg-gradient-to-r from-red-600 to-pink-600 text-white"
              : "bg-white/10 border border-white/20 text-slate-300 hover:bg-white/20"
          }`}
        >
          Sell
        </button>
      </div>

      {/* Input */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-slate-300 mb-2">
          {mode === "buy" ? "SOL Amount" : `${tokenSymbol} Amount`}
        </label>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.0"
          className="w-full px-4 py-3 border border-white/20 rounded-xl 
                     bg-slate-800/70 text-white font-mono
                     focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
          disabled={loading || isComplete}
          step="0.001"
          min="0"
        />
        {mode === "sell" && userTokenBalance > 0 && (
          <div className="mt-2 text-xs text-slate-400">
            Balance: {userTokenBalance.toFixed(4)} {tokenSymbol}
          </div>
        )}
      </div>

      {/* Quick Sell Buttons - Only show in sell mode */}
      {mode === "sell" && userTokenBalance > 0 && (
        <div className="mb-4 p-4 bg-gradient-to-br from-orange-500/10 to-red-500/10 rounded-xl border border-orange-500/30">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-slate-300">Quick Sell</span>
          </div>
          <div className="grid grid-cols-5 gap-2">
            <button
              onClick={() => setAmount((userTokenBalance * 0.25).toFixed(6))}
              disabled={loading || isComplete}
              className="rounded-lg bg-gradient-to-br from-orange-600 to-red-600 px-3 py-2 text-xs font-semibold text-white hover:from-orange-500 hover:to-red-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              25%
            </button>
            <button
              onClick={() => setAmount((userTokenBalance * 0.50).toFixed(6))}
              disabled={loading || isComplete}
              className="rounded-lg bg-gradient-to-br from-orange-600 to-red-600 px-3 py-2 text-xs font-semibold text-white hover:from-orange-500 hover:to-red-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              50%
            </button>
            <button
              onClick={() => setAmount((userTokenBalance * 0.75).toFixed(6))}
              disabled={loading || isComplete}
              className="rounded-lg bg-gradient-to-br from-orange-600 to-red-600 px-3 py-2 text-xs font-semibold text-white hover:from-orange-500 hover:to-red-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              75%
            </button>
            <button
              onClick={() => setAmount((userTokenBalance * 0.97).toFixed(6))}
              disabled={loading || isComplete}
              className="rounded-lg bg-gradient-to-br from-orange-600 to-red-600 px-3 py-2 text-xs font-semibold text-white hover:from-orange-500 hover:to-red-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              97%
            </button>
            <button
              onClick={() => setAmount(userTokenBalance.toFixed(6))}
              disabled={loading || isComplete}
              className="rounded-lg bg-gradient-to-br from-red-700 to-red-900 px-3 py-2 text-xs font-semibold text-white hover:from-red-600 hover:to-red-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              All
            </button>
          </div>
        </div>
      )}

      {/* Estimated Output */}
      {estimatedOutput > 0 && (
        <div className="mb-4 p-4 bg-purple-500/10 rounded-xl border border-purple-500/30">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-slate-300">
              You will receive
            </span>
            <span className="text-lg font-bold text-white font-mono">
              {estimatedOutput.toFixed(mode === "buy" ? 4 : 6)}{" "}
              {mode === "buy" ? tokenSymbol : "SOL"}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-slate-400">
              Price Impact
            </span>
            <span
              className={`text-xs font-medium ${
                Math.abs(priceImpact) > 5
                  ? "text-red-400"
                  : "text-purple-300"
              }`}
            >
              {priceImpact > 0 ? "+" : ""}
              {priceImpact.toFixed(2)}%
            </span>
          </div>
        </div>
      )}

      {/* Trade Button */}
      <button
        onClick={handleTrade}
        disabled={loading || !wallet.publicKey || !amount || parseFloat(amount) <= 0 || isComplete}
        className={`w-full py-3 px-4 rounded-xl font-semibold text-white transition-all
          ${
            mode === "buy"
              ? "bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500"
              : "bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-500 hover:to-pink-500"
          }
          disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        {loading
          ? "Processing..."
          : !wallet.publicKey
            ? "Connect Wallet"
            : isComplete
              ? "Bonding Curve Complete"
              : mode === "buy"
                ? `Buy ${tokenSymbol}`
                : `Sell ${tokenSymbol}`}
      </button>

      {/* Error Message */}
      {error && (
        <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl">
          <p className="text-sm text-red-200">{error}</p>
        </div>
      )}

      {/* Success Message */}
      {success && (
        <div className="mt-4 p-3 bg-green-500/10 border border-green-500/30 rounded-xl">
          <p className="text-sm text-green-200 break-all">
            {success}
          </p>
        </div>
      )}

      {/* Warning */}
      <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
        <p className="text-xs text-yellow-200">
          ⚠️ Trading involves risk. Price impact increases with larger trades.
          1% slippage tolerance is applied.
        </p>
      </div>
    </div>
  );
}

