"use client";

import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import Link from "next/link";
import VestingDashboard from "@/components/trading/VestingDashboard";
import { loadStartupData, StartupData } from "@/lib/startupData";

export default function VestingPage() {
  const params = useParams();
  const mintAddress = params.mint as string;
  
  const [startupData, setStartupData] = useState<StartupData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const data = await loadStartupData(mintAddress);
        setStartupData(data);
      } catch (error) {
        console.error("Error fetching startup data:", error);
      } finally {
        setLoading(false);
      }
    };

    if (mintAddress) {
      fetchData();
    }
  }, [mintAddress]);

  if (!mintAddress) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6">
        <div className="max-w-5xl mx-auto">
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
            <p className="text-slate-400 text-center">Invalid token address</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">
              {loading ? (
                <span className="animate-pulse bg-slate-700 rounded inline-block w-48 h-8"></span>
              ) : (
                `${startupData?.name || "Token"} Vesting`
              )}
            </h1>
            <p className="text-slate-400 text-sm">
              View and manage your vesting schedule
            </p>
          </div>
          <Link
            href="/dashboard/my-startups"
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors border border-slate-600"
          >
            ← Back to My Startups
          </Link>
        </div>

        {/* Info Box */}
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="text-blue-400 text-xl">ℹ️</div>
            <div className="flex-1">
              <h3 className="text-blue-300 font-semibold mb-1">About Vesting</h3>
              <p className="text-blue-100 text-sm">
                Your tokens are locked on a vesting schedule to prevent rug pulls and build investor trust. 
                Tokens unlock gradually over time based on your schedule. You can claim unlocked tokens at any time.
              </p>
            </div>
          </div>
        </div>

        {/* Vesting Dashboard */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg overflow-hidden">
          <VestingDashboard
            mintAddress={mintAddress}
            tokenSymbol={loading ? "..." : startupData?.symbol || "TOKEN"}
            tokenDecimals={6}
          />
        </div>

        {/* Help Section */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
          <h3 className="text-white font-semibold mb-3">Need Help?</h3>
          <div className="space-y-2 text-sm text-slate-300">
            <p>
              <strong className="text-slate-200">What is a cliff period?</strong><br />
              The cliff is a waiting period before any tokens unlock. No tokens can be claimed until the cliff date passes.
            </p>
            <p>
              <strong className="text-slate-200">When can I claim tokens?</strong><br />
              You can claim tokens after the cliff period has passed. Tokens unlock gradually based on your vesting schedule.
            </p>
            <p>
              <strong className="text-slate-200">How often do tokens unlock?</strong><br />
              Tokens unlock continuously over time (linear vesting). The "Release Interval" shows how often you should check for new unlocked tokens.
            </p>
            <p>
              <strong className="text-slate-200">Can I claim multiple times?</strong><br />
              Yes! You can claim as often as you like once the cliff passes. Unclaimed tokens remain safe in the vesting vault.
            </p>
          </div>
        </div>

        {/* Footer Links */}
        <div className="flex justify-center gap-4 text-sm text-slate-400">
          <Link href="/dashboard/my-startups" className="hover:text-white transition-colors">
            My Startups
          </Link>
          <span>•</span>
          <Link href="/dashboard/holdings" className="hover:text-white transition-colors">
            Holdings
          </Link>
          <span>•</span>
          <Link href="/dashboard/support" className="hover:text-white transition-colors">
            Support
          </Link>
        </div>
      </div>
    </div>
  );
}

