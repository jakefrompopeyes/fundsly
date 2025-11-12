"use client";

import { useState, useEffect } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import {
  fetchVestingSchedule,
  rpc_claimVestedTokens,
  calculateClaimableTokens,
  fetchProjectByMint,
} from "@/lib/anchorClient";
import VestingUnlockChart from "./VestingUnlockChart";

interface VestingDashboardProps {
  mintAddress: string;
  tokenSymbol?: string;
  tokenDecimals?: number;
}

export default function VestingDashboard({
  mintAddress,
  tokenSymbol = "TOKEN",
  tokenDecimals = 6,
}: VestingDashboardProps) {
  const { connection } = useConnection();
  const wallet = useWallet();

  const [vestingSchedule, setVestingSchedule] = useState<any>(null);
  const [projectOwner, setProjectOwner] = useState<PublicKey | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [claimableData, setClaimableData] = useState<{
    unlocked: number;
    claimed: number;
    claimable: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Fetch vesting schedule
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        const mint = new PublicKey(mintAddress);
        
        // First, fetch the project to get the owner
        const project = await fetchProjectByMint(connection, mint);
        
        if (!project || !project.account) {
          setError("Project not found for this token");
          setLoading(false);
          return;
        }

        const owner = project.account.owner as PublicKey;
        setProjectOwner(owner);
        
        // Check if current wallet is the owner
        if (wallet.publicKey) {
          setIsOwner(wallet.publicKey.equals(owner));
        }

        // Fetch vesting schedule for the project owner, not the current wallet
        const schedule = await fetchVestingSchedule(connection, wallet, mint, owner);

        if (schedule) {
          setVestingSchedule(schedule);
          
          // Calculate claimable tokens
          const currentTime = Math.floor(Date.now() / 1000);
          const claimable = calculateClaimableTokens(schedule, currentTime);
          setClaimableData(claimable);
        } else {
          setError("No vesting schedule found for this token");
        }
      } catch (err: any) {
        console.error("Error fetching vesting schedule:", err);
        setError(err.message || "Failed to fetch vesting schedule");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    
    // Refresh every 10 seconds
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [connection, wallet, wallet.publicKey, mintAddress]);

  const handleClaim = async () => {
    if (!wallet.publicKey || !claimableData || claimableData.claimable === 0) {
      return;
    }

    try {
      setClaiming(true);
      setError(null);
      setSuccess(null);

      const mint = new PublicKey(mintAddress);
      const result = await rpc_claimVestedTokens(connection, wallet, mint);

      setSuccess(`Successfully claimed ${formatTokenAmount(claimableData.claimable)} ${tokenSymbol}!`);
      
      // Refresh data after claiming
      setTimeout(async () => {
        const schedule = await fetchVestingSchedule(connection, wallet, mint);
        if (schedule) {
          setVestingSchedule(schedule);
          const currentTime = Math.floor(Date.now() / 1000);
          const claimable = calculateClaimableTokens(schedule, currentTime);
          setClaimableData(claimable);
        }
      }, 2000);
    } catch (err: any) {
      console.error("Error claiming tokens:", err);
      setError(err.message || "Failed to claim tokens");
    } finally {
      setClaiming(false);
    }
  };

  const formatTokenAmount = (amount: number) => {
    return (amount / Math.pow(10, tokenDecimals)).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 6,
    });
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getVestingProgress = () => {
    if (!vestingSchedule || !claimableData) return 0;
    const total = vestingSchedule.totalAmount.toNumber();
    if (total === 0) return 0;
    return (claimableData.unlocked / total) * 100;
  };

  const getClaimProgress = () => {
    if (!vestingSchedule || !claimableData) return 0;
    const total = vestingSchedule.totalAmount.toNumber();
    if (total === 0) return 0;
    return (claimableData.claimed / total) * 100;
  };

  // No longer need to require wallet connection for viewing vesting data

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
          <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
      </div>
    );
  }

  if (error && !vestingSchedule) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <p className="text-yellow-800 dark:text-yellow-200 text-sm">
            {error}
          </p>
        </div>
      </div>
    );
  }

  if (!vestingSchedule || !claimableData) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <p className="text-gray-600 dark:text-gray-400 text-center">
          No vesting schedule found for this token
        </p>
      </div>
    );
  }

  const currentTime = Math.floor(Date.now() / 1000);
  const isCliffReached = currentTime >= vestingSchedule.cliffTime.toNumber();
  const isFullyVested = currentTime >= vestingSchedule.endTime.toNumber();

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Vesting Schedule
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {tokenSymbol} · {mintAddress.slice(0, 4)}...{mintAddress.slice(-4)}
          </p>
        </div>
        {isFullyVested && (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
            Fully Vested
          </span>
        )}
      </div>

      {/* Status Messages */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-200 text-sm">{error}</p>
        </div>
      )}
      {success && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <p className="text-green-800 dark:text-green-200 text-sm">{success}</p>
        </div>
      )}

      {/* Cliff Warning */}
      {!isCliffReached && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <p className="text-blue-800 dark:text-blue-200 text-sm">
            <strong>Cliff Period:</strong> Tokens will start unlocking after{" "}
            {formatDate(vestingSchedule.cliffTime.toNumber())}
          </p>
        </div>
      )}

      {/* Token Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Total Vesting</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {formatTokenAmount(vestingSchedule.totalAmount.toNumber())}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{tokenSymbol}</p>
        </div>

        <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Unlocked</p>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {formatTokenAmount(claimableData.unlocked)}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {getVestingProgress().toFixed(1)}% vested
          </p>
        </div>

        <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Claimable Now</p>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">
            {formatTokenAmount(claimableData.claimable)}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {formatTokenAmount(claimableData.claimed)} already claimed
          </p>
        </div>
      </div>

      {/* Unlock Schedule Chart */}
      <VestingUnlockChart
        totalAmount={vestingSchedule.totalAmount.toNumber() / Math.pow(10, tokenDecimals)}
        startTime={vestingSchedule.startTime.toNumber()}
        cliffTime={vestingSchedule.cliffTime.toNumber()}
        endTime={vestingSchedule.endTime.toNumber()}
        releaseInterval={vestingSchedule.releaseInterval.toNumber()}
        currentTime={currentTime}
        tokenSymbol={tokenSymbol}
        height={300}
      />

      {/* Progress Bars */}
      <div className="space-y-4">
        {/* Vesting Progress */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Vesting Progress
            </span>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {getVestingProgress().toFixed(1)}%
            </span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
            <div
              className="bg-blue-600 dark:bg-blue-500 h-3 rounded-full transition-all duration-500"
              style={{ width: `${getVestingProgress()}%` }}
            />
          </div>
        </div>

        {/* Claim Progress */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Claimed Progress
            </span>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {getClaimProgress().toFixed(1)}%
            </span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
            <div
              className="bg-green-600 dark:bg-green-500 h-3 rounded-full transition-all duration-500"
              style={{ width: `${getClaimProgress()}%` }}
            />
          </div>
        </div>
      </div>

      {/* Vesting Schedule Details */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
          Schedule Details
        </h3>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-gray-500 dark:text-gray-400">Beneficiary:</span>
            <p className="text-gray-900 dark:text-white font-medium font-mono text-xs">
              {projectOwner?.toBase58().slice(0, 4)}...{projectOwner?.toBase58().slice(-4)}
            </p>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">Status:</span>
            <p className="text-gray-900 dark:text-white font-medium">
              {isOwner ? "You are the beneficiary" : "Read-only view"}
            </p>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">Start Date:</span>
            <p className="text-gray-900 dark:text-white font-medium">
              {formatDate(vestingSchedule.startTime.toNumber())}
            </p>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">Cliff Date:</span>
            <p className="text-gray-900 dark:text-white font-medium">
              {formatDate(vestingSchedule.cliffTime.toNumber())}
            </p>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">End Date:</span>
            <p className="text-gray-900 dark:text-white font-medium">
              {formatDate(vestingSchedule.endTime.toNumber())}
            </p>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">Release Interval:</span>
            <p className="text-gray-900 dark:text-white font-medium">
              {Math.floor(vestingSchedule.releaseInterval.toNumber() / 86400)} days
            </p>
          </div>
        </div>
      </div>

      {/* Claim Button - Only show to owner */}
      {!wallet.publicKey ? (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <p className="text-blue-800 dark:text-blue-200 text-sm text-center">
            Connect your wallet to claim tokens (if you are the beneficiary)
          </p>
        </div>
      ) : !isOwner ? (
        <div className="bg-gray-50 dark:bg-gray-900/20 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <p className="text-gray-600 dark:text-gray-400 text-sm text-center">
            Only the beneficiary can claim vested tokens
          </p>
        </div>
      ) : (
        <button
          onClick={handleClaim}
          disabled={
            claiming ||
            !isCliffReached ||
            claimableData.claimable === 0
          }
          className={`w-full py-3 px-4 rounded-lg font-semibold transition-all duration-200 ${
            claiming ||
            !isCliffReached ||
            claimableData.claimable === 0
              ? "bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed"
              : "bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
          }`}
        >
        {claiming ? (
          <span className="flex items-center justify-center">
            <svg
              className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            Claiming...
          </span>
        ) : !isCliffReached ? (
          "Cliff Period Not Reached"
        ) : claimableData.claimable === 0 ? (
          "No Tokens to Claim"
        ) : (
          `Claim ${formatTokenAmount(claimableData.claimable)} ${tokenSymbol}`
        )}
        </button>
      )}
    </div>
  );
}

