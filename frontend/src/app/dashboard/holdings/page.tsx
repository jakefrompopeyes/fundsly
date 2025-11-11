"use client";

import { useEffect, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Connection, PublicKey } from "@solana/web3.js";
import { AnchorProvider, Program, BN } from "@coral-xyz/anchor";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import idlJson from "@/idl/fundly.json";
import { Fundly } from "@/idl/fundly";

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

interface Holding {
  mint: PublicKey;
  tokenAmount: number;
  project?: ProjectAccount;
  bondingCurve?: BondingCurveAccount;
  currentPrice?: number;
  currentValueSOL?: number;
  currentValueUSD?: number;
}

export default function HoldingsPage() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [solPriceUSD, setSolPriceUSD] = useState<number>(180); // Default fallback
  const [totalValueSOL, setTotalValueSOL] = useState<number>(0);
  const [totalValueUSD, setTotalValueUSD] = useState<number>(0);

  // Fetch SOL price in USD
  useEffect(() => {
    async function fetchSolPrice() {
      try {
        const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
        const data = await response.json();
        if (data?.solana?.usd) {
          setSolPriceUSD(data.solana.usd);
        }
      } catch (error) {
        console.warn("Failed to fetch SOL price, using default:", error);
      }
    }
    fetchSolPrice();
    const interval = setInterval(fetchSolPrice, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    async function loadHoldings() {
      if (!wallet.publicKey || !wallet.connected) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const programId = new PublicKey(idlJson.address);
        
        // Create a minimal provider
        const provider = new AnchorProvider(
          connection,
          wallet as any,
          { commitment: "confirmed" }
        );
        
        const program = new Program(idlJson as Fundly, provider);

        // Get all token accounts for the user's wallet
        const tokenAccountsResponse = await connection.getParsedTokenAccountsByOwner(
          wallet.publicKey,
          { programId: TOKEN_PROGRAM_ID }
        );

        const tokenAccounts = tokenAccountsResponse.value;
        console.log(`Found ${tokenAccounts.length} token accounts`);

        // Filter for tokens with non-zero balances
        const nonZeroAccounts = tokenAccounts.filter(
          (account) => account.account.data.parsed.info.tokenAmount.uiAmount > 0
        );

        console.log(`Found ${nonZeroAccounts.length} non-zero token accounts`);

        // Fetch all project states to create a mint -> project mapping
        const projectAccounts = await program.account.projectState.all();
        const mintToProject = new Map<string, ProjectAccount>();
        
        for (const projectAccount of projectAccounts) {
          const account = projectAccount.account as any;
          if (!account.mint.equals(PublicKey.default)) {
            mintToProject.set(account.mint.toBase58(), account);
          }
        }

        console.log(`Found ${mintToProject.size} projects`);

        // Process each token account
        const holdingsList: Holding[] = [];

        for (const tokenAccount of nonZeroAccounts) {
          const mintAddress = tokenAccount.account.data.parsed.info.mint;
          const mintPubkey = new PublicKey(mintAddress);
          const tokenAmount = tokenAccount.account.data.parsed.info.tokenAmount.uiAmount || 0;

          // Check if this token belongs to a Fundly project
          const project = mintToProject.get(mintAddress);
          
          if (!project) {
            // Skip tokens that aren't part of Fundly projects
            continue;
          }

          // Try to fetch bonding curve data
          let bondingCurveData: BondingCurveAccount | undefined;
          let currentPrice: number | undefined;
          let currentValueSOL: number | undefined;
          let currentValueUSD: number | undefined;

          try {
            const [bondingCurvePda] = PublicKey.findProgramAddressSync(
              [Buffer.from("bonding_curve"), mintPubkey.toBuffer()],
              programId
            );

            const bondingCurve = await program.account.bondingCurve.fetch(bondingCurvePda);
            
            if (bondingCurve) {
              bondingCurveData = bondingCurve as any;
              
              // Calculate current price: price = (virtualSol + realSol) / (virtualToken + realToken)
              const totalSol = (bondingCurve.virtualSolReserves as BN).toNumber() + (bondingCurve.realSolReserves as BN).toNumber();
              const totalToken = (bondingCurve.virtualTokenReserves as BN).toNumber() + (bondingCurve.realTokenReserves as BN).toNumber();
              
              // Convert from lamports/raw units to SOL/tokens (accounting for 6 decimals)
              currentPrice = (totalSol / 1e9) / (totalToken / 1e6);
              
              // Calculate current value
              currentValueSOL = tokenAmount * currentPrice;
              currentValueUSD = currentValueSOL * solPriceUSD;
            }
          } catch (bcError) {
            console.log(`No bonding curve found for ${project.symbol}`);
            // Continue without bonding curve data
          }

          holdingsList.push({
            mint: mintPubkey,
            tokenAmount,
            project,
            bondingCurve: bondingCurveData,
            currentPrice,
            currentValueSOL,
            currentValueUSD,
          });
        }

        // Sort by value (highest first)
        holdingsList.sort((a, b) => {
          const valueA = a.currentValueSOL || 0;
          const valueB = b.currentValueSOL || 0;
          return valueB - valueA;
        });

        // Calculate totals
        const totalSOL = holdingsList.reduce((sum, h) => sum + (h.currentValueSOL || 0), 0);
        const totalUSD = holdingsList.reduce((sum, h) => sum + (h.currentValueUSD || 0), 0);

        setTotalValueSOL(totalSOL);
        setTotalValueUSD(totalUSD);
        setHoldings(holdingsList);
      } catch (e: any) {
        console.error("Error fetching holdings:", e);
        setError(e?.message || "Failed to load holdings");
      } finally {
        setLoading(false);
      }
    }

    loadHoldings();
  }, [connection, wallet, solPriceUSD]);

  if (!wallet.connected || !wallet.publicKey) {
    return (
      <div className="flex min-h-[400px] items-center justify-center rounded-2xl border border-white/20 bg-white/10 backdrop-blur-lg p-10">
        <div className="text-center">
          <p className="text-slate-300 mb-4">Please connect your wallet to view your holdings</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center rounded-2xl border border-white/20 bg-white/10 backdrop-blur-lg p-10">
        <p className="text-slate-300">Loading holdings...</p>
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
      {/* Header with total value */}
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Current Holdings</h1>
            <p className="text-sm text-slate-300 mt-1">
              Track your investments across all startup tokens
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-purple-300">
              {totalValueSOL.toFixed(4)} SOL
            </div>
            <div className="text-sm text-slate-400">
              ${totalValueUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
        </div>
      </div>

      {holdings.length === 0 ? (
        <div className="flex min-h-[400px] flex-col items-center justify-center gap-4 rounded-2xl border border-white/20 bg-white/10 backdrop-blur-lg p-10">
          <p className="text-slate-300 text-lg">No holdings found</p>
          <p className="text-slate-400 text-sm">Start investing in startups from the market to see your holdings here</p>
          <a
            href="/dashboard/market"
            className="mt-4 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-3 text-sm font-semibold text-white hover:from-purple-500 hover:to-pink-500 transition-all"
          >
            Browse Market
          </a>
        </div>
      ) : (
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-white/5 border-b border-white/20">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Startup
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Tokens Held
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Current Price
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Value (SOL)
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Value (USD)
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {holdings.map((holding) => (
                  <tr
                    key={holding.mint.toBase58()}
                    className="hover:bg-white/5 transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-white">
                          {holding.project?.name || "Unknown"}
                        </div>
                        <div className="text-xs text-purple-300">
                          ${holding.project?.symbol || "N/A"}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex rounded-full bg-purple-500/20 px-2 py-1 text-xs font-medium text-purple-300">
                        {holding.project?.category || "N/A"}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="text-sm font-mono text-white">
                        {holding.tokenAmount.toLocaleString(undefined, {
                          maximumFractionDigits: 6,
                        })}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      {holding.currentPrice !== undefined ? (
                        <div className="text-sm font-mono text-green-400">
                          {holding.currentPrice.toFixed(9)} SOL
                        </div>
                      ) : (
                        <div className="text-sm text-slate-500">N/A</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      {holding.currentValueSOL !== undefined ? (
                        <div className="text-sm font-mono text-white">
                          {holding.currentValueSOL.toFixed(4)} SOL
                        </div>
                      ) : (
                        <div className="text-sm text-slate-500">N/A</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      {holding.currentValueUSD !== undefined ? (
                        <div className="text-sm font-mono text-white">
                          ${holding.currentValueUSD.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </div>
                      ) : (
                        <div className="text-sm text-slate-500">N/A</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center gap-2">
                        <a
                          href={`/dashboard/trade/${holding.mint.toBase58()}`}
                          className="text-xs text-purple-300 hover:text-purple-200 transition-colors"
                        >
                          Trade
                        </a>
                        <span className="text-slate-600">|</span>
                        <a
                          href={`https://solscan.io/token/${holding.mint.toBase58()}?cluster=devnet`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-purple-300 hover:text-purple-200 transition-colors"
                        >
                          View
                        </a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

