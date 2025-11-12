"use client";

import { ReactNode, useEffect, useMemo, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { Sidebar } from "@/components/navigation/Sidebar";

/**
 * Plain-language overview:
 * This layout wraps every page inside /dashboard with a top bar and a left sidebar.
 * It keeps the wallet connection visible and shows the live SOL balance in the header.
 */
export default function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { connection } = useConnection();
  const { publicKey, connected } = useWallet();

  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const clusterLabel = useMemo(() => {
    const raw = process.env.NEXT_PUBLIC_SOLANA_NETWORK?.toLowerCase();
    if (raw === "mainnet" || raw === "mainnet-beta") return "Mainnet Beta";
    if (raw === "testnet") return "Testnet";
    // Default to devnet for testing
    return "Devnet";
  }, []);

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
    return () => {
      live = false;
    };
  }, [connection, connected, publicKey]);

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white">
      <Sidebar />
      <div className="flex min-h-screen flex-1 flex-col">
        <header className="relative z-[60] flex items-center justify-between border-b border-white/20 backdrop-blur-lg bg-white/5 px-6 py-4">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold">Fundly Dashboard</h1>
            <span className="ml-3 rounded-full border border-purple-400/30 bg-purple-400/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-purple-200">
              {clusterLabel}
            </span>
          </div>
          <div className="flex items-center gap-4">
            {connected ? (
              <div className="flex items-center gap-3">
                <span className="text-sm text-purple-200">
                  {loading ? "…" : balance !== null ? `${balance.toFixed(4)} SOL` : "Balance unavailable"}
                </span>
                <WalletMultiButton className="rounded-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 px-4 py-2 text-sm font-medium text-white transition-all" />
              </div>
            ) : (
              <WalletMultiButton className="rounded-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 px-4 py-2 text-sm font-medium text-white transition-all" />
            )}
          </div>
        </header>
        <main className="flex flex-1 flex-col p-6">{children}</main>
      </div>
    </div>
  );
}


