"use client";

import { useState, useEffect } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import {
  fetchGlobalConfig,
  rpc_updateGlobalConfig,
} from "@/lib/anchorClient";

export default function TreasuryPage() {
  const { connection } = useConnection();
  const wallet = useWallet();

  const [loading, setLoading] = useState(false);
  const [treasuryAddress, setTreasuryAddress] = useState<string>("");
  const [treasuryBalance, setTreasuryBalance] = useState<number>(0);
  const [authority, setAuthority] = useState<string>("");
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isTreasuryYourWallet, setIsTreasuryYourWallet] = useState(false);
  const [yourWalletBalance, setYourWalletBalance] = useState<number>(0);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | "info">("info");
  
  // Treasury update
  const [newTreasuryAddress, setNewTreasuryAddress] = useState("");
  const [updatingTreasury, setUpdatingTreasury] = useState(false);
  const [showUpdateForm, setShowUpdateForm] = useState(false);

  // Fetch treasury info on mount and when wallet changes
  useEffect(() => {
    loadTreasuryInfo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connection, wallet.publicKey]);

  const loadTreasuryInfo = async () => {
    if (!wallet.publicKey) return;

    try {
      setLoading(true);
      const globalConfig = await fetchGlobalConfig(connection, wallet);
      
      const treasuryAddr = globalConfig.treasury.toString();
      setTreasuryAddress(treasuryAddr);
      setAuthority(globalConfig.authority.toString());
      setIsAuthorized(wallet.publicKey.toString() === globalConfig.authority.toString());
      
      // Check if treasury is your wallet
      const isYourWallet = treasuryAddr === wallet.publicKey.toString();
      setIsTreasuryYourWallet(isYourWallet);

      // Fetch treasury balance
      const balance = await connection.getBalance(globalConfig.treasury);
      setTreasuryBalance(balance / LAMPORTS_PER_SOL);
      
      // Fetch your wallet balance
      const walletBal = await connection.getBalance(wallet.publicKey);
      setYourWalletBalance(walletBal / LAMPORTS_PER_SOL);
    } catch (err) {
      console.error("Failed to load treasury info:", err);
      const error = err as Error;
      setMessage(error.message || "Failed to load treasury information. Make sure global config is initialized.");
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  };

  const refreshBalance = async () => {
    if (!treasuryAddress) return;
    
    try {
      const balance = await connection.getBalance(new PublicKey(treasuryAddress));
      setTreasuryBalance(balance / LAMPORTS_PER_SOL);
      setMessage("Balance refreshed successfully");
      setMessageType("success");
      setTimeout(() => setMessage(""), 3000);
    } catch (err) {
      const error = err as Error;
      setMessage(`Failed to refresh balance: ${error.message}`);
      setMessageType("error");
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setMessage("Address copied to clipboard!");
    setMessageType("success");
    setTimeout(() => setMessage(""), 3000);
  };

  const viewOnExplorer = (address: string) => {
    const cluster = connection.rpcEndpoint.includes('devnet') ? 'devnet' : 
                    connection.rpcEndpoint.includes('localhost') ? 'devnet' : 'mainnet-beta';
    window.open(`https://explorer.solana.com/address/${address}?cluster=${cluster}`, '_blank');
  };

  const handleUpdateTreasury = async () => {
    if (!wallet.publicKey || !isAuthorized) {
      setMessage("Only the platform authority can update the treasury");
      setMessageType("error");
      return;
    }

    if (!newTreasuryAddress) {
      setMessage("Please enter a new treasury address");
      setMessageType("error");
      return;
    }

    try {
      const newTreasury = new PublicKey(newTreasuryAddress);
      
      setUpdatingTreasury(true);
      setMessage("Updating treasury address...");
      setMessageType("info");

      const signature = await rpc_updateGlobalConfig(
        connection,
        wallet,
        newTreasury, // Only update treasury
        null, null, null, null, null, null // Keep everything else unchanged
      );

      setMessage(`✅ Treasury updated successfully! Transaction: ${signature.slice(0, 8)}...${signature.slice(-8)}`);
      setMessageType("success");
      setShowUpdateForm(false);
      setNewTreasuryAddress("");

      // Reload treasury info
      setTimeout(() => loadTreasuryInfo(), 2000);
    } catch (err) {
      console.error("Failed to update treasury:", err);
      const error = err as Error;
      setMessage(`Error: ${error.message || "Failed to update treasury"}`);
      setMessageType("error");
    } finally {
      setUpdatingTreasury(false);
    }
  };

  if (!wallet.publicKey) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-8 max-w-md">
          <h2 className="text-2xl font-bold text-white mb-4">Connect Wallet</h2>
          <p className="text-slate-400">Please connect your wallet to access the Treasury Management page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      <div className="container mx-auto px-6 py-12">
        {/* Header */}
        <div className="max-w-6xl mx-auto mb-8">
          <h1 className="text-4xl font-bold text-white mb-4">
            💰 Treasury Management
          </h1>
          <p className="text-slate-400">
            Monitor and manage the platform treasury. All transaction fees automatically accumulate here.
          </p>
        </div>

        {/* Authorization Status */}
        {!loading && authority && (
          <div className="max-w-6xl mx-auto mb-6">
            <div className={`p-4 rounded-lg border ${
              isAuthorized 
                ? 'bg-green-900/20 border-green-700'
                : 'bg-yellow-900/20 border-yellow-700'
            }`}>
              <div className="flex items-center gap-2">
                {isAuthorized ? (
                  <>
                    <span className="text-green-400 text-xl">✓</span>
                    <span className="text-green-300">You are authorized as platform authority</span>
                  </>
                ) : (
                  <>
                    <span className="text-yellow-400 text-xl">⚠️</span>
                    <span className="text-yellow-300">You are not the platform authority (view-only)</span>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Treasury Ownership Notification */}
        {!loading && isTreasuryYourWallet && (
          <div className="max-w-6xl mx-auto mb-6">
            <div className="p-6 rounded-lg border bg-gradient-to-r from-purple-900/30 to-pink-900/30 border-purple-700">
              <div className="flex items-start gap-3">
                <span className="text-3xl">🎉</span>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-white mb-2">
                    You Already Have Access to These Funds!
                  </h3>
                  <p className="text-slate-300 mb-3">
                    The treasury is <strong>your wallet address</strong>. All fees are being sent directly to your wallet automatically.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                    <div className="p-3 bg-slate-900/50 rounded-lg">
                      <div className="text-xs text-slate-400 mb-1">Your Wallet Balance</div>
                      <div className="text-2xl font-bold text-white">{yourWalletBalance.toFixed(4)} SOL</div>
                      <div className="text-xs text-green-400 mt-1">✓ Includes all collected fees</div>
                    </div>
                    <div className="p-3 bg-slate-900/50 rounded-lg">
                      <div className="text-xs text-slate-400 mb-1">How to Access</div>
                      <div className="text-sm text-slate-300 space-y-1">
                        <div>💰 Open Phantom/Solflare</div>
                        <div>📤 Send/Swap as normal</div>
                        <div>✨ No special key needed!</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {!loading && !isTreasuryYourWallet && treasuryAddress && (
          <div className="max-w-6xl mx-auto mb-6">
            <div className="p-4 rounded-lg border bg-blue-900/20 border-blue-700">
              <div className="flex items-start gap-3">
                <span className="text-2xl">ℹ️</span>
                <div>
                  <h4 className="text-white font-semibold mb-1">Treasury is a Different Wallet</h4>
                  <p className="text-sm text-slate-300">
                    The treasury is set to a different address. Only that wallet can access these funds.
                    If you need to change the treasury, contact the platform authority.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Treasury Balance Card */}
          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">Treasury Balance</h2>
              <button
                onClick={refreshBalance}
                className="p-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors"
                title="Refresh balance"
              >
                <span className="text-white text-lg">🔄</span>
              </button>
            </div>

            {loading ? (
              <div className="animate-pulse space-y-4">
                <div className="h-16 bg-slate-700 rounded"></div>
                <div className="h-8 bg-slate-700 rounded w-3/4"></div>
              </div>
            ) : (
              <>
                <div className="mb-6">
                  <div className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400 mb-2">
                    {treasuryBalance.toFixed(4)} SOL
                  </div>
                  <div className="text-slate-400 text-sm">
                    Accumulated platform fees
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg">
                    <span className="text-slate-400 text-sm">Total Revenue</span>
                    <span className="text-white font-mono">{treasuryBalance.toFixed(4)} SOL</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg">
                    <span className="text-slate-400 text-sm">Fee Rate</span>
                    <span className="text-white font-mono">1.0%</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg">
                    <span className="text-slate-400 text-sm">Collection Type</span>
                    <span className="text-green-400 font-mono text-sm">Automatic</span>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Treasury Address Card */}
          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-8">
            <h2 className="text-2xl font-bold text-white mb-6">Treasury Details</h2>

            {loading ? (
              <div className="animate-pulse space-y-4">
                <div className="h-12 bg-slate-700 rounded"></div>
                <div className="h-12 bg-slate-700 rounded"></div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Treasury Address */}
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">
                    Treasury Address
                  </label>
                  <div className="flex gap-2">
                    <div className="flex-1 px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-lg font-mono text-sm text-white overflow-hidden">
                      {treasuryAddress ? (
                        `${treasuryAddress.slice(0, 8)}...${treasuryAddress.slice(-8)}`
                      ) : (
                        <span className="text-slate-500">Not loaded</span>
                      )}
                    </div>
                    <button
                      onClick={() => copyToClipboard(treasuryAddress)}
                      disabled={!treasuryAddress}
                      className="px-4 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                      title="Copy address"
                    >
                      📋
                    </button>
                    <button
                      onClick={() => viewOnExplorer(treasuryAddress)}
                      disabled={!treasuryAddress}
                      className="px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                      title="View on explorer"
                    >
                      🔍
                    </button>
                  </div>
                </div>

                {/* Authority Address */}
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">
                    Platform Authority
                  </label>
                  <div className="flex gap-2">
                    <div className="flex-1 px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-lg font-mono text-sm text-white overflow-hidden">
                      {authority ? (
                        `${authority.slice(0, 8)}...${authority.slice(-8)}`
                      ) : (
                        <span className="text-slate-500">Not loaded</span>
                      )}
                    </div>
                    <button
                      onClick={() => copyToClipboard(authority)}
                      disabled={!authority}
                      className="px-4 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                      title="Copy address"
                    >
                      📋
                    </button>
                  </div>
                </div>

                {/* Full Treasury Address */}
                <div className="p-3 bg-slate-900/50 border border-slate-700 rounded-lg">
                  <div className="text-xs text-slate-400 mb-1">Full Address:</div>
                  <div className="text-xs font-mono text-slate-300 break-all">
                    {treasuryAddress || "Loading..."}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Information Cards */}
        <div className="max-w-6xl mx-auto mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* How It Works */}
          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-6">
            <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <span>⚡</span>
              Automatic Collection
            </h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Fees are automatically sent to the treasury on every buy and sell transaction. No manual withdrawal needed!
            </p>
          </div>

          {/* Fee Structure */}
          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-6">
            <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <span>💸</span>
              Fee Structure
            </h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              1% fee on all trades (buys and sells). Fees are split automatically: liquidity to vault, fee to treasury.
            </p>
          </div>

          {/* Security */}
          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-6">
            <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <span>🔒</span>
              Security
            </h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Treasury address is validated on-chain. Only the platform authority can modify treasury settings.
            </p>
          </div>
        </div>

        {/* Message Display */}
        {message && (
          <div className="max-w-6xl mx-auto mt-6">
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
          </div>
        )}

        {/* Admin Actions (only shown to authority) */}
        {isAuthorized && (
          <div className="max-w-6xl mx-auto mt-6 space-y-6">
            {/* Update Treasury Section */}
            <div className="bg-gradient-to-r from-blue-900/20 to-purple-900/20 backdrop-blur-sm border border-blue-700/50 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-white">
                  🔄 Update Treasury Address
                </h3>
                <button
                  onClick={() => setShowUpdateForm(!showUpdateForm)}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors text-sm"
                >
                  {showUpdateForm ? "Cancel" : "Change Treasury"}
                </button>
              </div>

              {showUpdateForm && (
                <div className="space-y-4">
                  <div className="p-4 bg-yellow-900/20 border border-yellow-700 rounded-lg">
                    <div className="flex items-start gap-2">
                      <span className="text-yellow-400 text-xl">⚠️</span>
                      <div>
                        <h4 className="text-yellow-300 font-semibold mb-1">Important</h4>
                        <p className="text-sm text-yellow-200">
                          After updating, all future fees will go to the new treasury address.
                          Make sure you have access to the new wallet before proceeding!
                        </p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      New Treasury Address
                    </label>
                    <input
                      type="text"
                      value={newTreasuryAddress}
                      onChange={(e) => setNewTreasuryAddress(e.target.value)}
                      placeholder="Enter Solana wallet address"
                      className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-lg text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder-slate-500"
                      disabled={updatingTreasury}
                    />
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={handleUpdateTreasury}
                      disabled={updatingTreasury || !newTreasuryAddress}
                      className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:from-slate-700 disabled:to-slate-700 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition-all"
                    >
                      {updatingTreasury ? "Updating..." : "Update Treasury"}
                    </button>
                    <button
                      onClick={() => {
                        setShowUpdateForm(false);
                        setNewTreasuryAddress("");
                      }}
                      disabled={updatingTreasury}
                      className="px-6 py-3 bg-slate-700 hover:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {!showUpdateForm && (
                <p className="text-sm text-slate-400">
                  Change the treasury address to route all platform fees to a different wallet.
                  This is useful for using a multisig or dedicated treasury wallet.
                </p>
              )}
            </div>

            {/* Other Admin Actions */}
            <div className="bg-gradient-to-r from-purple-900/20 to-pink-900/20 backdrop-blur-sm border border-purple-700/50 rounded-2xl p-6">
              <h3 className="text-xl font-semibold text-white mb-4">
                🛠️ Other Admin Actions
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <a
                  href="/admin/init-config"
                  className="p-4 bg-slate-800/50 hover:bg-slate-800/70 border border-slate-700 rounded-lg transition-colors"
                >
                  <div className="text-white font-semibold mb-1">⚙️ Global Config</div>
                  <div className="text-sm text-slate-400">Initialize or update platform configuration</div>
                </a>
                <a
                  href="/admin/withdraw-fees"
                  className="p-4 bg-slate-800/50 hover:bg-slate-800/70 border border-slate-700 rounded-lg transition-colors"
                >
                  <div className="text-white font-semibold mb-1">💰 Legacy Fee Withdrawal</div>
                  <div className="text-sm text-slate-400">Withdraw any accumulated fees from old system</div>
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Documentation Link */}
        <div className="max-w-6xl mx-auto mt-6">
          <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl">📚</span>
              <div>
                <h4 className="text-white font-semibold mb-1">Documentation</h4>
                <p className="text-sm text-slate-400 mb-2">
                  Learn more about how automatic fee collection works and how to manage your treasury.
                </p>
                <a
                  href="/AUTOMATIC_FEE_COLLECTION.md"
                  target="_blank"
                  className="text-sm text-purple-400 hover:text-purple-300"
                >
                  View Complete Guide →
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

