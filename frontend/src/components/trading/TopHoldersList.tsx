"use client";

import { useEffect, useState } from "react";
import { useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { deriveBondingCurvePda } from "@/lib/anchorClient";

interface TokenHolder {
  address: string;
  balance: number;
  percentage: number;
  label?: string;
}

interface TopHoldersListProps {
  mintAddress: string;
  tokenSymbol: string;
}

export default function TopHoldersList({
  mintAddress,
  tokenSymbol,
}: TopHoldersListProps) {
  const { connection } = useConnection();
  const [holders, setHolders] = useState<TokenHolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalSupply, setTotalSupply] = useState(0);

  useEffect(() => {
    let isMounted = true;

    const fetchHolders = async () => {
      if (!mintAddress) return;

      try {
        setLoading(true);
        const mintPubkey = new PublicKey(mintAddress);

        // Get bonding curve PDA to identify the liquidity pool account
        const bondingCurvePda = await deriveBondingCurvePda(mintPubkey);

        // Get all token accounts for this mint
        const tokenAccounts = await connection.getProgramAccounts(
          TOKEN_PROGRAM_ID,
          {
            filters: [
              {
                dataSize: 165, // Size of token account
              },
              {
                memcmp: {
                  offset: 0, // Mint address is at offset 0
                  bytes: mintPubkey.toBase58(),
                },
              },
            ],
          }
        );

        // Parse token account data
        const holderData: { address: string; balance: number; label?: string }[] = [];
        let total = 0;

        for (const account of tokenAccounts) {
          // Token account layout:
          // - mint (32 bytes)
          // - owner (32 bytes at offset 32)
          // - amount (8 bytes at offset 64)
          const data = account.account.data;
          const owner = new PublicKey(data.slice(32, 64));
          const amount = Number(
            data.readBigUInt64LE(64)
          );

          if (amount > 0) {
            // Convert from raw amount (6 decimals)
            const balance = amount / 1_000_000;
            
            // Check if this is the bonding curve token account
            const isLiquidityPool = owner.equals(bondingCurvePda);
            
            holderData.push({
              address: owner.toBase58(),
              balance: balance,
              label: isLiquidityPool ? "Bonding Curve (Liquidity Pool)" : undefined,
            });
            total += balance;
          }
        }

        // Sort by balance (highest first) and take top 10
        holderData.sort((a, b) => b.balance - a.balance);
        const topHolders = holderData.slice(0, 10);

        // Calculate percentages
        const holdersWithPercentage = topHolders.map((holder) => ({
          ...holder,
          percentage: (holder.balance / total) * 100,
        }));

        if (isMounted) {
          setHolders(holdersWithPercentage);
          setTotalSupply(total);
        }
      } catch (error) {
        console.error("Error fetching holders:", error);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchHolders();

    // Refresh every 30 seconds
    const interval = setInterval(() => {
      if (isMounted) {
        fetchHolders();
      }
    }, 30000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [mintAddress, connection]);

  const formatNumber = (num: number) => {
    if (num >= 1_000_000_000) {
      return (num / 1_000_000_000).toFixed(2) + "B";
    }
    if (num >= 1_000_000) {
      return (num / 1_000_000).toFixed(2) + "M";
    }
    if (num >= 1_000) {
      return (num / 1_000).toFixed(2) + "K";
    }
    return num.toFixed(2);
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  return (
    <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-white">Top Holders</h2>
        {!loading && (
          <span className="text-sm text-slate-400">
            {holders.length} holders
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
        </div>
      ) : holders.length === 0 ? (
        <div className="text-center py-8 text-slate-400">
          No holders found
        </div>
      ) : (
        <div className="space-y-3">
          {holders.map((holder, index) => (
            <div
              key={holder.address}
              className="bg-slate-800/50 rounded-xl p-4 hover:bg-slate-800/70 transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-purple-500/20 text-purple-300 font-bold text-sm">
                    {index + 1}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="text-white font-mono text-sm">
                        {formatAddress(holder.address)}
                      </div>
                      {holder.label && (
                        <span className="px-2 py-0.5 text-xs bg-blue-500/20 text-blue-300 rounded-full border border-blue-500/30">
                          {holder.label}
                        </span>
                      )}
                    </div>
                    <div className="text-slate-400 text-xs">
                      {holder.percentage.toFixed(2)}% of supply
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-white font-semibold">
                    {formatNumber(holder.balance)}
                  </div>
                  <div className="text-slate-400 text-xs">{tokenSymbol}</div>
                </div>
              </div>

              {/* Progress bar showing percentage */}
              <div className="w-full bg-slate-700/50 rounded-full h-2 mt-2">
                <div
                  className={`h-2 rounded-full transition-all duration-300 ${
                    holder.label 
                      ? 'bg-gradient-to-r from-blue-500 to-cyan-500' 
                      : 'bg-gradient-to-r from-purple-500 to-pink-500'
                  }`}
                  style={{ width: `${Math.min(holder.percentage, 100)}%` }}
                ></div>
              </div>
            </div>
          ))}

          {/* Total Supply Summary */}
          <div className="mt-6 pt-4 border-t border-white/10">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">Circulating Supply</span>
              <span className="text-white font-semibold">
                {formatNumber(totalSupply)} {tokenSymbol}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

