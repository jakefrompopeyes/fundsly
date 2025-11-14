"use client";

import { useEffect, useState } from "react";
import { Connection, PublicKey, ParsedTransactionWithMeta } from "@solana/web3.js";
import { useConnection } from "@solana/wallet-adapter-react";
import { deriveBondingCurvePda } from "@/lib/anchorClient";
import { reportRPCError } from "@/lib/rpcManager";

interface Transaction {
  signature: string;
  type: "buy" | "sell";
  user: string;
  amount: number;
  price: number;
  total: number;
  timestamp: number;
}

interface TransactionHistoryProps {
  mintAddress: string;
  tokenSymbol: string;
}

export default function TransactionHistory({
  mintAddress,
  tokenSymbol,
}: TransactionHistoryProps) {
  const { connection } = useConnection();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "buy" | "sell">("all");

  useEffect(() => {
    // Helper function for exponential backoff retry
    const fetchWithRetry = async <T,>(
      fn: () => Promise<T>,
      maxRetries = 3,
      initialDelay = 500
    ): Promise<T | null> => {
      for (let i = 0; i < maxRetries; i++) {
        try {
          return await fn();
        } catch (error: any) {
          const is429 = error?.message?.includes("429") || error?.status === 429;
          
          // Report error to RPC manager for automatic endpoint rotation
          if (is429 || error?.message?.includes("limit")) {
            reportRPCError(error);
          }
          
          if (is429 && i < maxRetries - 1) {
            const delay = initialDelay * Math.pow(2, i); // Exponential backoff
            console.warn(`Rate limited (429) - retrying after ${delay}ms... (attempt ${i + 1}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, delay));
          } else if (!is429) {
            // If it's not a rate limit error, throw immediately
            throw error;
          } else {
            // Max retries reached
            console.error("Max retries exceeded for rate limit");
            return null;
          }
        }
      }
      return null;
    };

    const fetchTransactions = async () => {
      try {
        setLoading(true);
        
        // Fetch real transaction signatures from the bonding curve account
        const mint = new PublicKey(mintAddress);
        const bondingCurvePda = await deriveBondingCurvePda(mint);
        
        // Get transaction signatures for the bonding curve account
        // Very limited for free tiers (Helius: 10 req/s, Alchemy: 25 req/s)
        const signatures = await fetchWithRetry(() => 
          connection.getSignaturesForAddress(
            bondingCurvePda,
            { limit: 10 } // Limited to 10 for free tier constraints
          )
        );

        if (!signatures) {
          console.warn("Failed to fetch signatures after retries");
          setTransactions([]);
          return;
        }

        // Fetch full transaction details for each signature
        const txList: Transaction[] = [];
        
        // Process one at a time for free tier limits (Helius: 10 req/s, Alchemy: 25 req/s)
        const batchSize = 1; // Sequential processing to avoid rate limits
        for (let i = 0; i < signatures.length; i += batchSize) {
          const batch = signatures.slice(i, i + batchSize);
          
          // Process batch with retry logic
          const results = await Promise.allSettled(
            batch.map(sig => 
              fetchWithRetry(() => 
                connection.getParsedTransaction(sig.signature, {
                  maxSupportedTransactionVersion: 0,
                })
              )
            )
          );

          for (let j = 0; j < results.length; j++) {
            const result = results[j];
            const sig = batch[j];
            
            if (result.status === 'rejected' || !result.value) continue;
            
            const tx = result.value;

            if (!tx || !tx.meta) continue;

            const signature = sig.signature;
            const timestamp = (sig.blockTime || Date.now() / 1000) * 1000;

            // Extract signer (user) - first account that's a signer
            const signers = tx.transaction.message.accountKeys.filter((key) => key.signer);
            const user = signers.length > 0 
              ? signers[0].pubkey.toBase58()
              : tx.transaction.message.accountKeys[0]?.pubkey.toBase58() || "Unknown";
            
            const userShort = user.slice(0, 4) + "..." + user.slice(-4);

            // Parse transaction logs to extract trade info
            let type: "buy" | "sell" = "buy";
            let amount = 0;
            let total = 0;
            let price = 0;

            // Check the logs for BuyTokens or SellTokens events
            const logs = tx.meta.logMessages || [];
            
            console.log("Transaction logs:", logs);
            
            // Look for program logs with trade data
            for (const log of logs) {
              // Check for various instruction patterns
              if (log.toLowerCase().includes("buy") || 
                  log.includes("Instruction: BuyTokens") ||
                  log.includes("Program log: buy_tokens")) {
                type = "buy";
              } else if (log.toLowerCase().includes("sell") || 
                         log.includes("Instruction: SellTokens") ||
                         log.includes("Program log: sell_tokens")) {
                type = "sell";
              }
            }

            // Extract amounts from pre/post token balances
            const preTokenBalances = tx.meta.preTokenBalances || [];
            const postTokenBalances = tx.meta.postTokenBalances || [];
            const preBalances = tx.meta.preBalances || [];
            const postBalances = tx.meta.postBalances || [];

            console.log("Pre token balances:", preTokenBalances);
            console.log("Post token balances:", postTokenBalances);
            console.log("Pre balances:", preBalances);
            console.log("Post balances:", postBalances);

            // Find SOL changes - look at all accounts for the user's SOL change
            let maxSolDiff = 0;
            for (let i = 0; i < preBalances.length; i++) {
              if (preBalances[i] && postBalances[i]) {
                const diff = Math.abs(postBalances[i] - preBalances[i]) / 1_000_000_000;
                if (diff > maxSolDiff && diff < 100) { // Reasonable SOL amount
                  maxSolDiff = diff;
                }
              }
            }

            // Find token amount changes - check all token balances
            let maxTokenDiff = 0;
            for (const postBalance of postTokenBalances) {
              const preBalance = preTokenBalances.find(
                (b) => b.accountIndex === postBalance.accountIndex
              );
              
              if (preBalance) {
                const preAmount = parseFloat(
                  preBalance.uiTokenAmount.uiAmountString || "0"
                );
                const postAmount = parseFloat(
                  postBalance.uiTokenAmount.uiAmountString || "0"
                );
                const tokenDiff = Math.abs(postAmount - preAmount);
                
                if (tokenDiff > maxTokenDiff) {
                  maxTokenDiff = tokenDiff;
                }
              } else if (postBalance.uiTokenAmount.uiAmountString) {
                // New account - use the post balance as the change
                const tokenAmount = parseFloat(postBalance.uiTokenAmount.uiAmountString);
                if (tokenAmount > maxTokenDiff) {
                  maxTokenDiff = tokenAmount;
                }
              }
            }

            // Also check if any pre-balance accounts disappeared (sold all tokens)
            for (const preBalance of preTokenBalances) {
              const postBalance = postTokenBalances.find(
                (b) => b.accountIndex === preBalance.accountIndex
              );
              
              if (!postBalance && preBalance.uiTokenAmount.uiAmountString) {
                const tokenAmount = parseFloat(preBalance.uiTokenAmount.uiAmountString);
                if (tokenAmount > maxTokenDiff) {
                  maxTokenDiff = tokenAmount;
                }
              }
            }

            // Set the amounts
            total = maxSolDiff;
            amount = maxTokenDiff;

            // Calculate price if we have both amounts
            if (amount > 0 && total > 0) {
              price = total / amount;
            }

            console.log(`Transaction ${signature.slice(0, 8)}: Type=${type}, Amount=${amount}, Total=${total}, Price=${price}`);

            // Only add if we have meaningful data
            if (total > 0 || amount > 0) {
              txList.push({
                signature: signature.slice(0, 4) + "..." + signature.slice(-4),
                type,
                user: userShort,
                amount,
                price,
                total,
                timestamp,
              });
            }
          }

          // Much longer delay for free tier rate limits (Helius: 10 req/s, Alchemy: 25 req/s)
          if (i + batchSize < signatures.length) {
            await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second between each request
          }
        }

        setTransactions(txList);
      } catch (error: any) {
        console.error("Error fetching transactions:", error);
        
        // Handle rate limiting gracefully
        if (error?.message?.includes("429") || error?.status === 429) {
          console.warn("Rate limited - will retry later");
        }
        
        setTransactions([]);
      } finally {
        setLoading(false);
      }
    };

    fetchTransactions();

    // Longer refresh interval for free tier rate limits
    const interval = setInterval(fetchTransactions, 90000); // Every 90 seconds (1.5 minutes)
    return () => clearInterval(interval);
  }, [mintAddress, connection]);

  const filteredTransactions =
    filter === "all"
      ? transactions
      : transactions.filter((tx) => tx.type === filter);

  const formatTime = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return "Just now";
  };

  const formatNumber = (num: number, decimals: number = 2) => {
    if (num < 0.01) return num.toFixed(6);
    return num.toFixed(decimals);
  };

  return (
    <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-white">
          Recent Transactions
        </h3>
        
        {/* Filter Buttons */}
        <div className="flex gap-2">
          {(["all", "buy", "sell"] as const).map((type) => (
            <button
              key={type}
              onClick={() => setFilter(type)}
              className={`px-3 py-1 text-xs font-medium rounded-lg transition-all capitalize ${
                filter === type
                  ? "glass-button glass-button-primary text-white"
                  : "glass-button text-slate-300"
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Transaction List */}
      {loading ? (
        <div className="flex items-center justify-center h-[400px]">
          <p className="text-slate-300">Loading transactions...</p>
        </div>
      ) : filteredTransactions.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-[400px] space-y-2">
          <p className="text-slate-300">No transactions found</p>
          <p className="text-xs text-slate-400">
            Transactions will appear here once trading begins
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          {/* Desktop Table View */}
          <table className="hidden md:table w-full text-sm">
            <thead>
              <tr className="border-b border-white/20">
                <th className="text-left py-3 px-2 font-medium text-slate-400">
                  Type
                </th>
                <th className="text-left py-3 px-2 font-medium text-slate-400">
                  User
                </th>
                <th className="text-right py-3 px-2 font-medium text-slate-400">
                  Amount
                </th>
                <th className="text-right py-3 px-2 font-medium text-slate-400">
                  Price
                </th>
                <th className="text-right py-3 px-2 font-medium text-slate-400">
                  Total (SOL)
                </th>
                <th className="text-right py-3 px-2 font-medium text-slate-400">
                  Time
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.map((tx) => (
                <tr
                  key={tx.signature}
                  className="border-b border-white/10 hover:bg-white/5 transition-colors"
                >
                  <td className="py-3 px-2">
                    <span
                      className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        tx.type === "buy"
                          ? "bg-green-500/20 text-green-300 border border-green-500/30"
                          : "bg-red-500/20 text-red-300 border border-red-500/30"
                      }`}
                    >
                      {tx.type === "buy" ? "Buy" : "Sell"}
                    </span>
                  </td>
                  <td className="py-3 px-2">
                    <a
                      href={`https://solscan.io/account/${tx.user}?cluster=devnet`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-purple-300 hover:text-purple-200 transition-colors font-mono"
                    >
                      {tx.user}
                    </a>
                  </td>
                  <td className="py-3 px-2 text-right font-medium text-white font-mono">
                    {tx.amount > 0 ? `${formatNumber(tx.amount)} ${tokenSymbol}` : "N/A"}
                  </td>
                  <td className="py-3 px-2 text-right text-slate-300 font-mono">
                    {tx.price > 0 ? `${formatNumber(tx.price, 6)} SOL` : "N/A"}
                  </td>
                  <td className="py-3 px-2 text-right font-medium text-white font-mono">
                    {tx.total > 0 ? formatNumber(tx.total, 4) : "N/A"}
                  </td>
                  <td className="py-3 px-2 text-right text-slate-400">
                    {formatTime(tx.timestamp)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Mobile Card View */}
          <div className="md:hidden space-y-3">
            {filteredTransactions.map((tx) => (
              <div
                key={tx.signature}
                className="border border-white/20 bg-white/5 rounded-xl p-4 hover:border-purple-500/50 transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <span
                    className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      tx.type === "buy"
                        ? "bg-green-500/20 text-green-300 border border-green-500/30"
                        : "bg-red-500/20 text-red-300 border border-red-500/30"
                    }`}
                  >
                    {tx.type === "buy" ? "Buy" : "Sell"}
                  </span>
                  <span className="text-xs text-slate-400">
                    {formatTime(tx.timestamp)}
                  </span>
                </div>

                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Signature:</span>
                    <a
                      href={`https://solscan.io/tx/${tx.signature}?cluster=devnet`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-purple-300 hover:text-purple-200 transition-colors font-mono"
                    >
                      {tx.signature}
                    </a>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Amount:</span>
                    <span className="font-medium text-white font-mono">
                      {tx.amount > 0 ? `${formatNumber(tx.amount)} ${tokenSymbol}` : "N/A"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Price:</span>
                    <span className="text-slate-300 font-mono">
                      {tx.price > 0 ? `${formatNumber(tx.price, 6)} SOL` : "N/A"}
                    </span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-white/20">
                    <span className="text-slate-400">Total:</span>
                    <span className="font-semibold text-white font-mono">
                      {tx.total > 0 ? `${formatNumber(tx.total, 4)} SOL` : "N/A"}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Summary Stats */}
      {transactions.length > 0 && (
        <div className="mt-4 pt-4 border-t border-white/20">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-slate-400 mb-1">
                Total Transactions
              </p>
              <p className="text-sm font-semibold text-white">
                {transactions.length}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-1">
                Total Buy Volume
              </p>
              <p className="text-sm font-semibold text-green-300">
                {formatNumber(
                  transactions
                    .filter((tx) => tx.type === "buy")
                    .reduce((sum, tx) => sum + tx.total, 0),
                  2
                )}{" "}
                SOL
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-1">
                Total Sell Volume
              </p>
              <p className="text-sm font-semibold text-red-300">
                {formatNumber(
                  transactions
                    .filter((tx) => tx.type === "sell")
                    .reduce((sum, tx) => sum + tx.total, 0),
                  2
                )}{" "}
                SOL
              </p>
            </div>
          </div>
          <div className="mt-3 p-3 bg-green-500/10 rounded-xl border border-green-500/30">
            <p className="text-xs text-green-200">
              ✅ Real-time transaction data fetched from the blockchain
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

