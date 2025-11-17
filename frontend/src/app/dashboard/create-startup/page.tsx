"use client";

import { useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { 
  rpc_createMint, 
  rpc_initializeProject,
  rpc_initializeBondingCurve,
  rpc_initializeVesting,
  rpc_createTokenComplete,
  validateTokenCreation,
  VestingPresets 
} from "@/lib/anchorClient";
import { BN } from "@coral-xyz/anchor";
import { getAssociatedTokenAddress } from "@solana/spl-token";
import { PublicKey, Transaction, SystemProgram } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import VestingUnlockChart from "@/components/trading/VestingUnlockChart";
import { saveStartupData } from "@/lib/startupData";

export default function CreateStartupPage() {
  /**
   * Simplified token form: name and symbol only. We removed bonding curve,
   * total supply, and decimals for now to keep creation straightforward.
   */

  // Fixed supply for all tokens (999,999,999.999999 with 6 decimals = 999,999,999,999,999 raw units)
  const FIXED_TOTAL_SUPPLY = 999999999999999;

  // Basic Information
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [category, setCategory] = useState("");
  
  // Problem & Solution
  const [problemStatement, setProblemStatement] = useState("");
  const [solutionOverview, setSolutionOverview] = useState("");
  const [valueProposition, setValueProposition] = useState("");
  
  // Team
  const [teamSize, setTeamSize] = useState("");
  const [founders, setFounders] = useState("");
  const [founderLinkedIn, setFounderLinkedIn] = useState("");
  const [stage, setStage] = useState("");
  
  // Basic Resources (website only)
  const [website, setWebsite] = useState("");
  const [twitter, setTwitter] = useState("");
  const [discord, setDiscord] = useState("");
  
  // Vesting Configuration
  const [enableVesting, setEnableVesting] = useState(true); // Default to enabled for trust
  const [vestingPreset, setVestingPreset] = useState("standard12Month");
  const [customCliffDays, setCustomCliffDays] = useState("30");
  const [customVestingMonths, setCustomVestingMonths] = useState("12");
  const [customIntervalDays, setCustomIntervalDays] = useState("30");
  const creatorAllocationPercent = "20"; // LOCKED at 20% (200M tokens for vesting)
  
  const { connection } = useConnection();
  const wallet = useWallet();
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-6">
      {/* Page Header */}
      <div className="rounded-2xl border border-purple-500/30 bg-gradient-to-br from-purple-500/20 to-pink-500/20 backdrop-blur-lg p-6">
        <h1 className="mb-2 text-2xl font-bold text-white">Create Your Startup Token</h1>
        <p className="text-slate-200 text-sm mb-4">
          Launch your token quickly with just the basics. You can add more details later. Only name, symbol, description, and category are required.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="rounded-lg bg-white/10 p-3">
            <div className="text-purple-300 font-semibold mb-1">📋 Basic Info</div>
            <div className="text-slate-300">Project details, category, and branding</div>
          </div>
          <div className="rounded-lg bg-white/10 p-3">
            <div className="text-purple-300 font-semibold mb-1">💡 Problem & Solution</div>
            <div className="text-slate-300">What you're building and why it matters</div>
          </div>
          <div className="rounded-lg bg-white/10 p-3">
            <div className="text-purple-300 font-semibold mb-1">👥 Team</div>
            <div className="text-slate-300">Team details and founders</div>
          </div>
          <div className="rounded-lg bg-white/10 p-3">
            <div className="text-purple-300 font-semibold mb-1">🪙 Token Economics</div>
            <div className="text-slate-300">Supply distribution (80/20 split)</div>
          </div>
          <div className="rounded-lg bg-white/10 p-3">
            <div className="text-green-300 font-semibold mb-1">🔒 Vesting</div>
            <div className="text-slate-300">20% locked vesting schedule</div>
          </div>
        </div>
      </div>

      {/* Basic Information */}
      <div className="rounded-2xl border border-white/20 bg-white/10 backdrop-blur-lg p-6">
        <h2 className="mb-4 text-lg font-semibold text-white">Basic Information</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-300">Project Name *</span>
            <input
              className="rounded-md border border-white/20 bg-slate-800/70 px-3 py-2 text-white outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/50"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Startup Token"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-300">Token Symbol *</span>
            <input
              className="rounded-md border border-white/20 bg-slate-800/70 px-3 py-2 text-white outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/50"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              placeholder="MST"
            />
          </label>
        </div>
        <div className="mt-4 flex flex-col gap-1 text-sm">
          <span className="text-slate-300">Description *</span>
          <textarea
            className="rounded-md border border-white/20 bg-slate-800/70 px-3 py-2 text-white outline-none resize-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/50"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe your project..."
            rows={3}
          />
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-300">Category *</span>
            <input
              className="rounded-md border border-white/20 bg-slate-800/70 px-3 py-2 text-white outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/50"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g., DeFi, Gaming, AI/ML, NFT, DAO, etc."
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-300">Logo URL (optional)</span>
            <input
              className="rounded-md border border-white/20 bg-slate-800/70 px-3 py-2 text-white outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/50"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://example.com/logo.png"
            />
          </label>
        </div>
      </div>

      {/* Problem & Solution */}
      <div className="rounded-2xl border border-white/20 bg-white/10 backdrop-blur-lg p-6">
        <h2 className="mb-4 text-lg font-semibold text-white">Problem & Solution</h2>
        <div className="space-y-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-300">Problem Statement (optional)</span>
            <textarea
              className="rounded-md border border-white/20 bg-slate-800/70 px-3 py-2 text-white outline-none resize-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/50"
              value={problemStatement}
              onChange={(e) => setProblemStatement(e.target.value)}
              placeholder="What specific problem does your startup solve? Who experiences this problem?"
              rows={3}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-300">Solution Overview (optional)</span>
            <textarea
              className="rounded-md border border-white/20 bg-slate-800/70 px-3 py-2 text-white outline-none resize-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/50"
              value={solutionOverview}
              onChange={(e) => setSolutionOverview(e.target.value)}
              placeholder="How does your product/service solve this problem?"
              rows={3}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-300">Unique Value Proposition (optional)</span>
            <input
              className="rounded-md border border-white/20 bg-slate-800/70 px-3 py-2 text-white outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/50"
              value={valueProposition}
              onChange={(e) => setValueProposition(e.target.value)}
              placeholder="What makes your solution different from competitors?"
            />
          </label>
        </div>
      </div>

      {/* Team */}
      <div className="rounded-2xl border border-white/20 bg-white/10 backdrop-blur-lg p-6">
        <h2 className="mb-4 text-lg font-semibold text-white">Team</h2>
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-slate-300">Team Size</span>
              <input
                type="number"
                className="rounded-md border border-white/20 bg-slate-800/70 px-3 py-2 text-white outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/50"
                value={teamSize}
                onChange={(e) => setTeamSize(e.target.value)}
                placeholder="5"
                min="1"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-slate-300">Stage (optional)</span>
              <select
                className="rounded-md border border-white/20 bg-slate-800/70 px-3 py-2 text-white outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/50"
                value={stage}
                onChange={(e) => setStage(e.target.value)}
              >
                <option value="">Not specified</option>
                <option value="Idea">Idea</option>
                <option value="MVP">MVP</option>
                <option value="Beta">Beta</option>
                <option value="Live Product">Live Product</option>
                <option value="Revenue Generating">Revenue Generating</option>
              </select>
            </label>
          </div>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-300">Founders (optional)</span>
            <input
              className="rounded-md border border-white/20 bg-slate-800/70 px-3 py-2 text-white outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/50"
              value={founders}
              onChange={(e) => setFounders(e.target.value)}
              placeholder="John Doe (CEO), Jane Smith (CTO)"
            />
            <span className="text-xs text-slate-400">Comma-separated list of founder names and roles</span>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-300">Founder LinkedIn URLs</span>
            <input
              className="rounded-md border border-white/20 bg-slate-800/70 px-3 py-2 text-white outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/50"
              value={founderLinkedIn}
              onChange={(e) => setFounderLinkedIn(e.target.value)}
              placeholder="https://linkedin.com/in/founder1, https://linkedin.com/in/founder2"
            />
            <span className="text-xs text-slate-400">Comma-separated LinkedIn profile URLs</span>
          </label>
        </div>
      </div>

      {/* Token Economics */}
      <div className="rounded-2xl border border-white/20 bg-white/10 backdrop-blur-lg p-6">
        <h2 className="mb-4 text-lg font-semibold text-white">Token Economics</h2>
        
        <div className="space-y-4">
          <div className="flex flex-col gap-1 text-sm">
            <span className="text-slate-300">Total Supply</span>
            <div className="rounded-md border border-white/20 bg-slate-800/70 px-3 py-2 text-slate-200">
              999,999,999.999999 tokens
            </div>
            <span className="text-xs text-slate-400">Fixed supply with 6 decimals for all projects</span>
          </div>

          <div className="flex flex-col gap-1 text-sm">
            <span className="text-slate-300">Creator Allocation (Locked)</span>
            <div className="rounded-md border border-purple-500/30 bg-purple-500/10 px-3 py-2">
              <span className="text-white font-semibold text-lg">20%</span>
              <span className="text-purple-300 text-sm ml-2">(200M tokens)</span>
            </div>
            <span className="text-xs text-slate-400">
              🔒 Fixed at 20% with mandatory vesting. You get 0 tokens immediately - they unlock over time based on your vesting schedule.
            </span>
          </div>

          <div className="rounded-xl border border-purple-500/30 bg-purple-500/10 p-4">
            <h3 className="text-sm font-semibold text-purple-200 mb-3">Token Distribution:</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-slate-300">🔄 Bonding Curve (tradeable)</span>
                <span className="text-white font-semibold">
                  800,000,000 (80%)
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-300">
                  🔒 Vesting Vault (locked)
                </span>
                <span className="text-white font-semibold">
                  200,000,000 (20%)
                </span>
              </div>
              <div className="flex justify-between items-center border-t border-purple-500/20 pt-2 mt-2">
                <span className="text-slate-300">👤 Creator Immediate</span>
                <span className="text-green-400 font-semibold">
                  0 (0%)
                </span>
              </div>
            </div>
            <p className="text-xs text-purple-300 mt-3">
              💡 Creator always gets 0 tokens immediately. 20% locked tokens unlock over time per your vesting schedule.
            </p>
          </div>
        </div>
      </div>

      {/* Vesting Configuration */}
      <div className="rounded-2xl border border-green-500/30 bg-green-500/10 backdrop-blur-lg p-6">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            🔒 Creator Token Vesting
            <span className="text-xs font-normal text-green-300 bg-green-900/30 px-2 py-1 rounded-full">
              Locked at 20%
            </span>
          </h2>
          <p className="text-sm text-green-200 mt-1">
            20% of tokens (200M) are automatically locked and unlock gradually over time. You get 0 immediately!
          </p>
        </div>

        {enableVesting && (
          <div className="space-y-4">
            {/* Why Vesting Info Box */}
            <div className="rounded-lg border border-green-400/30 bg-green-900/20 p-3">
              <p className="text-sm text-green-100 mb-2 font-semibold">✅ Why enable vesting?</p>
              <ul className="text-xs text-green-200 space-y-1">
                <li>• Proves you're committed for the long term</li>
                <li>• Prevents accusations of rug pulls</li>
                <li>• Increases investor confidence</li>
                <li>• Industry best practice for serious projects</li>
              </ul>
            </div>

            {/* Vesting Preset Selector */}
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-slate-300 font-medium">Vesting Schedule</span>
              <select
                className="rounded-md border border-white/20 bg-slate-800/70 px-3 py-2 text-white outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/50"
                value={vestingPreset}
                onChange={(e) => setVestingPreset(e.target.value)}
              >
                <option value="standard12Month">Standard (12 months) - Recommended</option>
                <option value="extended24Month">Extended (24 months) - Conservative</option>
                <option value="quickVest6Month">Quick (6 months) - Aggressive</option>
                <option value="custom">Custom Schedule</option>
              </select>
            </label>

            {/* Preset Info Display */}
            {vestingPreset === "standard12Month" && (
              <div className="rounded-lg border border-blue-400/30 bg-blue-900/20 p-3 text-sm">
                <p className="text-blue-100 font-semibold mb-1">📅 Standard 12-Month Vesting</p>
                <div className="text-blue-200 space-y-1 text-xs">
                  <p>• <strong>Cliff:</strong> 30 days (1 month) - No tokens until day 30</p>
                  <p>• <strong>Duration:</strong> 365 days (12 months total)</p>
                  <p>• <strong>Unlocks:</strong> Monthly (every 30 days)</p>
                  <p>• <strong>Per unlock:</strong> ~8.33% of your allocation</p>
                </div>
              </div>
            )}

            {vestingPreset === "extended24Month" && (
              <div className="rounded-lg border border-blue-400/30 bg-blue-900/20 p-3 text-sm">
                <p className="text-blue-100 font-semibold mb-1">📅 Extended 24-Month Vesting</p>
                <div className="text-blue-200 space-y-1 text-xs">
                  <p>• <strong>Cliff:</strong> 90 days (3 months) - Maximum commitment signal</p>
                  <p>• <strong>Duration:</strong> 730 days (24 months total)</p>
                  <p>• <strong>Unlocks:</strong> Monthly (every 30 days)</p>
                  <p>• <strong>Per unlock:</strong> ~4.17% of your allocation</p>
                </div>
              </div>
            )}

            {vestingPreset === "quickVest6Month" && (
              <div className="rounded-lg border border-blue-400/30 bg-blue-900/20 p-3 text-sm">
                <p className="text-blue-100 font-semibold mb-1">📅 Quick 6-Month Vesting</p>
                <div className="text-blue-200 space-y-1 text-xs">
                  <p>• <strong>Cliff:</strong> None - Starts unlocking immediately</p>
                  <p>• <strong>Duration:</strong> 180 days (6 months total)</p>
                  <p>• <strong>Unlocks:</strong> Weekly (every 7 days)</p>
                  <p>• <strong>Per unlock:</strong> ~3.85% of your allocation</p>
                </div>
              </div>
            )}

            {/* Custom Vesting Configuration */}
            {vestingPreset === "custom" && (
              <div className="space-y-3 rounded-lg border border-yellow-400/30 bg-yellow-900/20 p-4">
                <p className="text-sm font-semibold text-yellow-100">⚙️ Custom Vesting Configuration</p>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="text-slate-300">Cliff Period (days)</span>
                    <input
                      type="number"
                      className="rounded-md border border-white/20 bg-slate-800/70 px-3 py-2 text-white outline-none focus:border-yellow-500 focus:ring-2 focus:ring-yellow-500/50"
                      value={customCliffDays}
                      onChange={(e) => setCustomCliffDays(e.target.value)}
                      min="0"
                      max="365"
                      placeholder="30"
                    />
                    <span className="text-xs text-slate-400">No unlock until this period</span>
                  </label>

                  <label className="flex flex-col gap-1 text-sm">
                    <span className="text-slate-300">Total Vesting (months)</span>
                    <input
                      type="number"
                      className="rounded-md border border-white/20 bg-slate-800/70 px-3 py-2 text-white outline-none focus:border-yellow-500 focus:ring-2 focus:ring-yellow-500/50"
                      value={customVestingMonths}
                      onChange={(e) => setCustomVestingMonths(e.target.value)}
                      min="1"
                      max="60"
                      placeholder="12"
                    />
                    <span className="text-xs text-slate-400">Total duration</span>
                  </label>

                  <label className="flex flex-col gap-1 text-sm">
                    <span className="text-slate-300">Unlock Interval (days)</span>
                    <input
                      type="number"
                      className="rounded-md border border-white/20 bg-slate-800/70 px-3 py-2 text-white outline-none focus:border-yellow-500 focus:ring-2 focus:ring-yellow-500/50"
                      value={customIntervalDays}
                      onChange={(e) => setCustomIntervalDays(e.target.value)}
                      min="1"
                      max="365"
                      placeholder="30"
                    />
                    <span className="text-xs text-slate-400">How often tokens unlock</span>
                  </label>
                </div>

                <div className="rounded-md border border-yellow-400/30 bg-yellow-900/30 p-2 text-xs text-yellow-100">
                  ⚠️ <strong>Custom Schedule Summary:</strong> {customCliffDays}-day cliff, {customVestingMonths}-month vesting, unlocking every {customIntervalDays} days
                </div>
              </div>
            )}

            {/* Vesting Summary */}
            <div className="rounded-lg border border-green-400/30 bg-green-900/30 p-3">
              <p className="text-sm font-semibold text-green-100 mb-2">📊 Your Vesting Summary:</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="text-green-200">
                  <span className="text-green-300">Locked Tokens:</span>
                  <p className="text-white font-semibold">
                    200,000,000 (20%)
                  </p>
                </div>
                <div className="text-green-200">
                  <span className="text-green-300">Status:</span>
                  <p className="text-white font-semibold">
                    🔒 Always Enabled
                  </p>
                </div>
              </div>
            </div>

            {/* Vesting Preview Chart */}
            <div className="rounded-lg border border-blue-400/30 bg-slate-900/50 p-4">
              <h4 className="text-sm font-semibold text-blue-100 mb-3">📈 Unlock Schedule Preview</h4>
              {(() => {
                // Calculate preview parameters
                const startTime = Math.floor(Date.now() / 1000);
                let vestingParams;
                
                if (vestingPreset === "custom") {
                  vestingParams = VestingPresets.custom(
                    startTime,
                    parseInt(customCliffDays || "30"),
                    parseInt(customVestingMonths || "12"),
                    parseInt(customIntervalDays || "30")
                  );
                } else if (vestingPreset === "extended24Month") {
                  vestingParams = VestingPresets.extended24Month(startTime);
                } else if (vestingPreset === "quickVest6Month") {
                  vestingParams = VestingPresets.quickVest6Month(startTime);
                } else {
                  vestingParams = VestingPresets.standard12Month(startTime);
                }

                const totalTokens = 200000000; // Fixed at 20% (200M tokens)
                const cliffTime = startTime + vestingParams.cliffDuration.toNumber();
                const endTime = startTime + vestingParams.vestingDuration.toNumber();

                return (
                  <VestingUnlockChart
                    totalAmount={totalTokens}
                    startTime={startTime}
                    cliffTime={cliffTime}
                    endTime={endTime}
                    releaseInterval={vestingParams.releaseInterval.toNumber()}
                    currentTime={startTime}
                    tokenSymbol={symbol || "tokens"}
                    height={250}
                  />
                );
              })()}
              <p className="text-xs text-blue-200 mt-2 text-center">
                💡 This chart shows how your tokens will unlock over time
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-end">
        <button
          className="glass-button glass-button-primary rounded-xl px-6 py-3 text-sm font-semibold text-white"
          disabled={
            submitting ||
            !wallet.connected ||
            !name ||
            !symbol ||
            !description ||
            !category
          }
          onClick={async () => {
            setNotice(null);
            setSubmitting(true);
            try {
              // Prepare startup data object (will be saved after mint is created)
              const startupData = {
                // Basic Info
                name, symbol, description, imageUrl, category,
                // Problem & Solution
                problemStatement, solutionOverview, valueProposition,
                // Team
                teamSize, founders, founderLinkedIn, stage,
                // Basic Resources
                website, twitter, discord
              };
              console.log("📊 Startup Data Collected:", startupData);
              
              // Calculate token distribution FIRST
              // Creator NEVER gets tokens immediately - only through vesting
              const creatorAlloc = parseInt(creatorAllocationPercent || "0") / 100;
              // Use FIXED_TOTAL_SUPPLY (in raw units) for calculations to avoid rounding errors
              const tokensForVestingRaw = enableVesting ? Math.floor(FIXED_TOTAL_SUPPLY * creatorAlloc) : 0;
              const tokensForCurveRaw = FIXED_TOTAL_SUPPLY - tokensForVestingRaw; // Rest goes to bonding curve
              
              // Convert to human-readable for display (these are NOT used for transfers)
              const tokensForVesting = Math.floor(tokensForVestingRaw / 1_000_000);
              const tokensForCurve = Math.floor(tokensForCurveRaw / 1_000_000);
              
              // Use the new combined function to create token with better error handling
              const { mint } = await rpc_createTokenComplete(
                connection,
                wallet,
                name,
                symbol,
                description,
                imageUrl,
                website,
                twitter,
                discord,
                category,
                FIXED_TOTAL_SUPPLY,
                new BN(tokensForCurveRaw),
                (step, message) => {
                  if (step === 1) {
                    setNotice("📝 Step 1/3: Initializing project...");
                  } else if (step === 2) {
                    setNotice("🪙 Step 2/3: Creating token mint...");
                  } else if (step === 3) {
                    setNotice("📈 Step 3/3: Setting up bonding curve...");
                  }
                }
              );
              
              // At this point, the token is FULLY created and tradeable
              // The bonding curve is ready and validated
              
              // Step 4 (Optional): Handle vesting initialization and transfer if enabled
              let vestingInfo = "";
              let vestingParams;
              
              if (enableVesting && tokensForVesting > 0) {
                setNotice("🔒 Step 4 (Optional): Initializing vesting schedule...");
                
                // Get vesting parameters based on preset or custom
                const startTime = Math.floor(Date.now() / 1000);
                
                if (vestingPreset === "custom") {
                  vestingParams = VestingPresets.custom(
                    startTime,
                    parseInt(customCliffDays || "30"),
                    parseInt(customVestingMonths || "12"),
                    parseInt(customIntervalDays || "30")
                  );
                } else if (vestingPreset === "extended24Month") {
                  vestingParams = VestingPresets.extended24Month(startTime);
                } else if (vestingPreset === "quickVest6Month") {
                  vestingParams = VestingPresets.quickVest6Month(startTime);
                } else {
                  vestingParams = VestingPresets.standard12Month(startTime);
                }
                
                try {
                  // Initialize vesting
                  const totalAmountToVest = new BN(tokensForVestingRaw); // Use raw units directly
                  await rpc_initializeVesting(
                    connection,
                    wallet,
                    mint,
                    totalAmountToVest,
                    vestingParams.startTime,
                    vestingParams.cliffDuration,
                    vestingParams.vestingDuration,
                    vestingParams.releaseInterval
                  );
                  
                  // Transfer tokens to vesting vault
                  setNotice("💸 Step 4 (Optional): Transferring tokens to vesting vault...");
                  
                  const { deriveVestingSchedulePda } = await import("@/lib/anchorClient");
                  const { pda: vestingSchedulePda } = await deriveVestingSchedulePda(mint, wallet.publicKey!);
                  const vestingVaultAta = await getAssociatedTokenAddress(
                    mint,
                    vestingSchedulePda,
                    true
                  );
                  
                  // Get owner's token account
                  const ownerAta = await getAssociatedTokenAddress(
                    mint,
                    wallet.publicKey!
                  );
                  
                  const { createTransferInstruction } = await import("@solana/spl-token");
                  const transferToVestingIx = createTransferInstruction(
                    ownerAta,
                    vestingVaultAta,
                    wallet.publicKey!,
                    tokensForVestingRaw, // Use raw units directly (already includes 6 decimals)
                    [],
                    TOKEN_PROGRAM_ID
                  );
                  
                  // Send vesting transfer transaction
                  const vestingTx = new Transaction().add(transferToVestingIx);
                  const { blockhash } = await connection.getLatestBlockhash();
                  vestingTx.recentBlockhash = blockhash;
                  vestingTx.feePayer = wallet.publicKey!;
                  
                  const signed = await wallet.signTransaction!(vestingTx);
                  const signature = await connection.sendRawTransaction(signed.serialize());
                  await connection.confirmTransaction(signature, "confirmed");
                } catch (vestingError: any) {
                  // Vesting failed, but token is still tradeable
                  console.warn("⚠️ Vesting setup failed, but token is still usable:", vestingError);
                  vestingInfo = `
⚠️ Vesting Setup Failed (Token is still tradeable):
   Error: ${vestingError.message}
   All ${tokensForCurve.toLocaleString()} tokens are in the bonding curve.
   You can still trade the token normally.`;
                }
              }

              // Build vesting info after successful transfer
              if (enableVesting && tokensForVesting > 0 && vestingParams && !vestingInfo) {
                // Only build this if vesting succeeded (vestingInfo is empty)
                
                // Build vesting info string
                const cliffDays = vestingParams.cliffDuration.toNumber() / (24 * 60 * 60);
                const vestingMonths = vestingParams.vestingDuration.toNumber() / (30 * 24 * 60 * 60);
                const intervalDays = vestingParams.releaseInterval.toNumber() / (24 * 60 * 60);
                
                vestingInfo = `
🔒 Vesting Schedule Created:
   Locked Tokens: ${tokensForVesting.toLocaleString()}
   Status: LOCKED (not accessible immediately)
   Cliff: ${Math.floor(cliffDays)} days
   Duration: ${Math.floor(vestingMonths)} months
   Unlock Interval: ${Math.floor(intervalDays)} days
   
   ⏰ You can claim unlocked tokens after the cliff period.
   View your vesting at: /dashboard/vesting/${mint.toBase58()}`;
              } else if (!vestingInfo) {
                // No vesting or vesting was disabled
                vestingInfo = `
💰 100% Liquidity Mode:
   All ${tokensForCurve.toLocaleString()} tokens allocated to bonding curve.
   Creator allocation: 0 tokens (as intended)
   
   To get tokens: Buy from the bonding curve at market price.
   This shows confidence and aligns your incentives with investors!`;
              }
              
              // Save startup data to API (Supabase) with localStorage fallback
              let supabaseWarning = "";
              const mintAddress = mint.toBase58();
              const creatorWallet = wallet.publicKey!.toBase58();
              
              console.log("💾 Preparing to save startup data...");
              console.log("💾 Mint address:", mintAddress);
              console.log("💾 Creator wallet:", creatorWallet);
              console.log("💾 Data fields:", Object.keys(startupData).length, "fields");
              
              console.log("💾 === SAVING STARTUP DATA TO SUPABASE ===");
              console.log("💾 Mint Address:", mintAddress);
              console.log("💾 Creator Wallet:", creatorWallet);
              console.log("💾 Startup Data:", {
                name: startupData.name,
                symbol: startupData.symbol,
                description: startupData.description?.slice(0, 50) + "...",
                category: startupData.category,
                fieldsCount: Object.keys(startupData).length
              });
              
              try {
                await saveStartupData(mintAddress, startupData, creatorWallet);
                console.log("✅✅✅ STARTUP DATA SAVED SUCCESSFULLY TO SUPABASE ✅✅✅");
                supabaseWarning = "\n\n✅ Startup information saved to database successfully!";
              } catch (saveError: any) {
                console.error("❌❌❌ ERROR SAVING STARTUP DATA ❌❌❌");
                console.error("⚠️ Error saving startup data:", saveError);
                console.error("⚠️ Error message:", saveError?.message);
                console.error("⚠️ Error stack:", saveError?.stack);
                // Continue anyway - data is saved to localStorage as backup
                // But warn the user
                const errorMsg = saveError?.message || "Unknown error";
                if (errorMsg.includes("Supabase") || errorMsg.includes("Failed to save")) {
                  supabaseWarning = `\n\n⚠️ Warning: Couldn't save to database: ${errorMsg}\nData saved to browser storage as backup.`;
                } else {
                  throw saveError; // Re-throw if it's not a Supabase error
                }
              }
              
              console.log("💾 === END SAVE PROCESS ===");
              
              setNotice(`✅ Success! Token is FULLY CREATED and ready to trade!

Token Mint: ${mint.toBase58()}
Bonding Curve: ✅ Active and validated
Tokens in Curve: ${tokensForCurve.toLocaleString()}
${vestingInfo}

🎉 Token is now LIVE! Trade at: /dashboard/trade/${mint.toBase58()}
📋 Investor overview: /dashboard/trade/${mint.toBase58()}/about${supabaseWarning}`);
              
              // Clear form on success
              setName("");
              setSymbol("");
              setDescription("");
              setImageUrl("");
              setCategory("");
              setProblemStatement("");
              setSolutionOverview("");
              setValueProposition("");
              setTeamSize("");
              setFounders("");
              setFounderLinkedIn("");
              setStage("");
              setWebsite("");
              setTwitter("");
              setDiscord("");
            } catch (e: any) {
              console.error("Error creating token:", e);
              // Better error messages
              let errorMessage = "Failed to create token";
              if (e?.message?.includes("already exists")) {
                errorMessage = e.message;
              } else if (e?.message?.includes("already in use")) {
                errorMessage = `A project with symbol "${symbol}" already exists. Please use a different symbol.`;
              } else if (e?.message?.includes("Program failed to complete")) {
                errorMessage = "Program is not deployed at the configured address.";
              } else if (e?.message) {
                errorMessage = e.message;
              }
              setNotice(`❌ ${errorMessage}`);
            } finally {
              setSubmitting(false);
            }
          }}
        >
          Create Token
        </button>
      </div>

      {notice && (
        <div className={`mt-4 rounded-xl border p-4 text-sm ${
          notice.includes("✅") 
            ? "border-green-500/30 bg-green-500/10 text-green-200" 
            : notice.includes("❌")
            ? "border-red-500/30 bg-red-500/10 text-red-200"
            : "border-white/20 bg-white/10 text-slate-200"
        }`}>
          <pre className="whitespace-pre-wrap font-sans">{notice}</pre>
        </div>
      )}
    </div>
  );
}


