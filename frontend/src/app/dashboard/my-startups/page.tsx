"use client";

import { useEffect, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { fetchUserProjects } from "@/lib/anchorClient";
import { PublicKey } from "@solana/web3.js";

interface Project {
  publicKey: PublicKey;
  account: {
    owner: PublicKey;
    mint: PublicKey;
    name: string;
    symbol: string;
    createdAt: any;
    totalSupply: any;
    category: string;
  };
}

export default function MyStartupsPage() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadProjects() {
      if (!wallet.connected || !wallet.publicKey) {
        setProjects([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const userProjects = await fetchUserProjects(connection, wallet);
        setProjects(userProjects as Project[]);
      } catch (e: any) {
        console.error("Error fetching projects:", e);
        setError(e?.message || "Failed to load projects");
      } finally {
        setLoading(false);
      }
    }

    loadProjects();
  }, [connection, wallet.connected, wallet.publicKey]);

  if (!wallet.connected) {
    return (
      <div className="flex min-h-[400px] items-center justify-center rounded-2xl border border-white/20 bg-white/10 backdrop-blur-lg p-10">
        <p className="text-slate-300">Please connect your wallet to view your startups</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center rounded-2xl border border-white/20 bg-white/10 backdrop-blur-lg p-10">
        <p className="text-slate-300">Loading your startups...</p>
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

  if (projects.length === 0) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-4 rounded-2xl border border-white/20 bg-white/10 backdrop-blur-lg p-10">
        <p className="text-slate-300">You haven't created any startups yet</p>
        <a
          href="/dashboard/create-startup"
          className="rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 px-6 py-3 text-sm font-semibold text-white transition-all"
        >
          Create Your First Startup
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">My Startups</h1>
          <span className="text-sm text-purple-300 font-semibold">{projects.length} project{projects.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {projects.map((project) => {
          const createdDate = new Date(project.account.createdAt.toNumber() * 1000);
          
          return (
            <div
              key={project.publicKey.toBase58()}
              className="rounded-2xl border border-white/20 bg-white/10 backdrop-blur-lg p-6 transition-all hover:border-purple-500/50 hover:bg-white/15"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-white">{project.account.name}</h3>
                  <p className="mt-1 text-sm text-purple-300">${project.account.symbol}</p>
                </div>
                <span className="rounded-full bg-purple-500/20 px-3 py-1 text-xs font-medium text-purple-300">
                  {project.account.category}
                </span>
              </div>

              <div className="mt-4 space-y-2 text-sm bg-slate-800/50 rounded-lg p-3">
                <div className="flex justify-between">
                  <span className="text-slate-400">Supply:</span>
                  <span className="text-white font-mono">999,999,999.999999</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Created:</span>
                  <span className="text-white">{createdDate.toLocaleDateString()}</span>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                <a
                  href={`/dashboard/trade/${project.account.mint.toBase58()}`}
                  className="block w-full rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 px-4 py-3 text-center text-sm font-semibold text-white hover:from-purple-500 hover:to-pink-500 transition-all"
                >
                  🔄 Trade Token
                </a>
                <a
                  href={`https://solscan.io/token/${project.account.mint.toBase58()}?cluster=devnet`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full rounded-lg bg-slate-800/70 border border-white/10 px-4 py-2 text-center text-sm font-medium text-white hover:bg-slate-700"
                >
                  View on Solscan
                </a>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(project.account.mint.toBase58());
                    alert("Mint address copied!");
                  }}
                  className="block w-full rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-center text-sm font-medium text-slate-300 hover:bg-white/10"
                >
                  Copy Mint Address
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}


