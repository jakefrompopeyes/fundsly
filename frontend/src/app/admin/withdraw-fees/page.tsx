"use client";

import { useState, useEffect } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import {
  rpc_withdrawPlatformFees,
  calculateAccumulatedFees,
  fetchGlobalConfig,
} from "@/lib/anchorClient";

export default function WithdrawFeesPage() {
  const { connection } = useConnection();
  const wallet = useWallet();

  const [mintAddress, setMintAddress] = useState("");
  const [treasuryAddress, setTreasuryAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | "info">("info");
  const [feeInfo, setFeeInfo] = useState<{
    vaultBalance: number;
    realSolReserves: number;
    rentExemptMinimum: number;
    accumulatedFees: number;
    accumulatedFeesSOL: number;
  } | null>(null);
  const [authority, setAuthority] = useState<string>("");

  // Fetch authority from global config
  useEffect(() => {
    async function loadAuthority() {
      if (!wallet.publicKey) return;
      try {
        const globalConfig = await fetchGlobalConfig(connection, wallet);
        setAuthority(globalConfig.authority.toString());
      } catch (err) {
        console.error("Failed to load authority:", err);
      }
    }
    loadAuthority();
  }, [connection, wallet, wallet.publicKey]);

  const handleCalculateFees = async () => {
    if (!wallet.publicKey) {
      setMessage("Please connect your wallet");
      setMessageType("error");
      return;
    }

    if (!mintAddress) {
      setMessage("Please enter a mint address");
      setMessageType("error");
      return;
    }

    setCalculating(true);
    setMessage("");
    setFeeInfo(null);

    try {
      const mint = new PublicKey(mintAddress);
      const fees = await calculateAccumulatedFees(connection, wallet, mint);
      setFeeInfo(fees);
      setMessage(
        `Found ${fees.accumulatedFeesSOL.toFixed(6)} SOL in accumulated fees`
      );
      setMessageType("info");
    } catch (err) {
      console.error("Failed to calculate fees:", err);
      const error = err as Error;
      setMessage(`Error: ${error.message}`);
      setMessageType("error");
    } finally {
      setCalculating(false);
    }
  };

  const handleWithdraw = async () => {
    if (!wallet.publicKey) {
      setMessage("Please connect your wallet");
      setMessageType("error");
      return;
    }

    if (!mintAddress || !treasuryAddress) {
      setMessage("Please enter both mint and treasury addresses");
      setMessageType("error");
      return;
    }

    // Check if connected wallet is the authority
    if (authority && wallet.publicKey.toString() !== authority) {
      setMessage(
        `Only the platform authority (${authority.slice(0, 8)}...${authority.slice(-8)}) can withdraw fees`
      );
      setMessageType("error");
      return;
    }

    setLoading(true);
    setMessage("Withdrawing fees...");
    setMessageType("info");

    try {
      const mint = new PublicKey(mintAddress);
      const treasury = new PublicKey(treasuryAddress);

      const txSig = await rpc_withdrawPlatformFees(
        connection,
        wallet,
        mint,
        treasury
      );

      setMessage(
        `✅ Fees withdrawn successfully! Transaction: ${txSig.slice(0, 8)}...${txSig.slice(-8)}`
      );
      setMessageType("success");

      // Recalculate fees after withdrawal
      setTimeout(() => handleCalculateFees(), 2000);
    } catch (err) {
      console.error("Failed to withdraw fees:", err);
      const error = err as Error;
      setMessage(`Error: ${error.message}`);
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      <div className="container mx-auto px-6 py-12">
        {/* Header */}
        <div className="max-w-3xl mx-auto mb-8">
          <h1 className="text-4xl font-bold text-white mb-4">
            Withdraw Platform Fees
          </h1>
          <p className="text-slate-400">
            Withdraw accumulated platform fees from bonding curve vaults to the
            treasury.
          </p>
        </div>

        {/* Main Card */}
        <div className="max-w-3xl mx-auto bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-8">
          {/* Authority Display */}
          {authority && (
            <div className="mb-6 p-4 bg-slate-900/50 border border-slate-700 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Platform Authority:</span>
                <span className="text-white font-mono text-sm">
                  {authority.slice(0, 12)}...{authority.slice(-12)}
                </span>
              </div>
              {wallet.publicKey && wallet.publicKey.toString() === authority && (
                <div className="mt-2 text-green-400 text-sm">
                  ✓ You are authorized to withdraw fees
                </div>
              )}
              {wallet.publicKey && wallet.publicKey.toString() !== authority && (
                <div className="mt-2 text-yellow-400 text-sm">
                  ⚠️ You are not the platform authority
                </div>
              )}
            </div>
          )}

          {/* Form */}
          <div className="space-y-6">
            {/* Mint Address */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Token Mint Address
              </label>
              <input
                type="text"
                value={mintAddress}
                onChange={(e) => setMintAddress(e.target.value)}
                placeholder="Enter the token mint address"
                className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono"
                disabled={loading || calculating}
              />
            </div>

            {/* Calculate Fees Button */}
            <button
              onClick={handleCalculateFees}
              disabled={calculating || !mintAddress}
              className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition-colors"
            >
              {calculating ? "Calculating..." : "Calculate Accumulated Fees"}
            </button>

            {/* Fee Information Display */}
            {feeInfo && (
              <div className="p-4 bg-slate-900/50 border border-slate-700 rounded-lg space-y-2">
                <h3 className="text-lg font-semibold text-white mb-3">
                  Fee Information
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-slate-400 text-sm">Vault Balance:</span>
                    <p className="text-white font-mono">
                      {(feeInfo.vaultBalance / 1e9).toFixed(6)} SOL
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400 text-sm">Real Reserves:</span>
                    <p className="text-white font-mono">
                      {(feeInfo.realSolReserves / 1e9).toFixed(6)} SOL
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400 text-sm">Rent Exempt:</span>
                    <p className="text-white font-mono">
                      {(feeInfo.rentExemptMinimum / 1e9).toFixed(6)} SOL
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400 text-sm">
                      Accumulated Fees:
                    </span>
                    <p className="text-green-400 font-mono font-semibold text-lg">
                      {feeInfo.accumulatedFeesSOL.toFixed(6)} SOL
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Treasury Address */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Treasury Address
              </label>
              <input
                type="text"
                value={treasuryAddress}
                onChange={(e) => setTreasuryAddress(e.target.value)}
                placeholder="Enter the treasury wallet address"
                className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono"
                disabled={loading || calculating}
              />
            </div>

            {/* Withdraw Button */}
            <button
              onClick={handleWithdraw}
              disabled={
                loading ||
                !mintAddress ||
                !treasuryAddress ||
                (feeInfo && feeInfo.accumulatedFees === 0)
              }
              className="w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:from-slate-700 disabled:to-slate-700 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition-all"
            >
              {loading ? "Withdrawing..." : "Withdraw Fees to Treasury"}
            </button>

            {/* Message Display */}
            {message && (
              <div
                className={`p-4 rounded-lg border ${
                  messageType === "success"
                    ? "bg-green-900/20 border-green-700 text-green-300"
                    : messageType === "error"
                    ? "bg-red-900/20 border-red-700 text-red-300"
                    : "bg-blue-900/20 border-blue-700 text-blue-300"
                }`}
              >
                {message}
              </div>
            )}
          </div>

          {/* Info Box */}
          <div className="mt-8 p-4 bg-slate-900/30 border border-slate-700/50 rounded-lg">
            <h3 className="text-sm font-semibold text-slate-300 mb-2">
              ℹ️ How It Works
            </h3>
            <ul className="text-sm text-slate-400 space-y-1 list-disc list-inside">
              <li>
                Platform fees (1%) are accumulated in each bonding curve vault
              </li>
              <li>
                Only the platform authority can withdraw accumulated fees
              </li>
              <li>Fees are calculated as: Vault Balance - Real Reserves - Rent</li>
              <li>Withdrawn fees are sent to the specified treasury address</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

