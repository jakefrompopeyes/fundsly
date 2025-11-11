"use client";

/**
 * Plain-language overview:
 * This component is the friendly card people see on the landing page. It shows the
 * connect button and a short status message that updates as the wallet connects.
 * Think of it as the "reception desk" for Solana wallets inside Fundly.
 */

import { useEffect, useMemo, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";

/**
 * Helper to keep wallet addresses readable. We only show the first and last few characters
 * so non-technical users aren't overwhelmed by a long string.
 */
function shortenAddress(address: PublicKey | null) {
  if (!address) return '';
  const addressString = address.toBase58();
  return `${addressString.slice(0, 4)}••${addressString.slice(-4)}`;
}

export function WalletConnectionCard() {
  /**
   * useWallet gives us live details about the visitor's wallet: whether they are connected,
   * which wallet brand they chose, and the public address if available.
   */
  const { publicKey, connected, wallet } = useWallet();

  /**
   * useConnection exposes the Solana RPC connection that WalletProviders set up for us.
   * We use it to ask the blockchain how much SOL the visitor currently holds.
   */
  const { connection } = useConnection();

  /**
   * Local state to show the balance and whether we're still waiting on a response.
   * We keep it simple: null = nothing to show yet, number = balance in SOL.
   */
  const [balance, setBalance] = useState<number | null>(null);
  const [isFetchingBalance, setIsFetchingBalance] = useState(false);
  const [balanceError, setBalanceError] = useState<string | null>(null);

  // Diagnostics removed after verification

  /**
   * Read the same network flag used in WalletProviders so the copy matches the actual cluster.
   */
  const cluster = useMemo(() => {
    const rawValue = process.env.NEXT_PUBLIC_SOLANA_NETWORK;
    if (!rawValue) return "devnet"; // Default to devnet for testing
    const value = rawValue.toLowerCase();
    if (value === "mainnet" || value === "mainnet-beta") {
      return "mainnet-beta";
    }
    if (value === "testnet") {
      return "testnet";
    }
    if (value === "devnet") {
      return "devnet";
    }
    return "devnet"; // Default to devnet
  }, []);

  const clusterLabel = useMemo(() => {
    switch (cluster) {
      case "mainnet-beta":
        return "Mainnet Beta";
      case "testnet":
        return "Testnet";
      case "devnet":
        return "Devnet";
      default:
        return "Devnet";
    }
  }, [cluster]);

  /**
   * We translate the raw wallet state into a short sentence the user can understand.
   * useMemo keeps the sentence stable unless the wallet state actually changes.
   */
  const statusMessage = useMemo(() => {
    if (!wallet) {
      return 'Connect your Solana wallet to get started.';
    }

    if (!connected) {
      return `Wallet detected: ${wallet.adapter.name}. Please approve the connection.`;
    }

    return `Connected as ${shortenAddress(publicKey)}.`;
  }, [wallet, connected, publicKey]);

  /**
   * Whenever the visitor connects or switches wallets, we fetch their SOL balance
   * from the active Solana cluster. The try/catch ensures we fail gracefully if the network is slow.
   */
  useEffect(() => {
    if (!connected || !publicKey) {
      setBalance(null);
      setBalanceError(null);
      return;
    }

    let isCurrent = true;

    const fetchBalance = async () => {
      setIsFetchingBalance(true);
      setBalanceError(null);
      try {
        const lamports = await connection.getBalance(publicKey);
        if (isCurrent) {
          setBalance(lamports / LAMPORTS_PER_SOL);
        }
      } catch (error) {
        if (isCurrent) {
          setBalance(null);
          const errorMessage = error instanceof Error ? error.message : String(error);
          if (errorMessage.includes("403")) {
            setBalanceError(
              "This RPC endpoint blocked the balance request. Supply NEXT_PUBLIC_SOLANA_RPC_ENDPOINT with your mainnet provider.",
            );
          } else {
            setBalanceError("We couldn't reach the Solana RPC. Please retry in a moment.");
          }
        }
        console.error("Failed to fetch balance", error);
      } finally {
        if (isCurrent) {
          setIsFetchingBalance(false);
        }
      }
    };

    fetchBalance();

    return () => {
      isCurrent = false;
    };
  }, [connected, connection, publicKey]);

  return (
    /**
     * Card layout that blends with the hero section. We use Tailwind utility classes to
     * create a glassmorphic effect so the card feels premium and approachable.
     */
    <section className="mx-auto flex w-full max-w-xl flex-col gap-6 rounded-3xl border border-white/10 bg-white/70 p-8 shadow-xl backdrop-blur-lg dark:border-white/5 dark:bg-white/10">
      <header className="flex flex-col gap-2">
        {/* Headline and subcopy explain the purpose of this card in plain language. */}
        <p className="text-sm uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-300">
          Fundly Sandbox
        </p>
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-white">
          Connect Your Wallet
        </h1>
        <p className="text-base text-slate-600 dark:text-slate-300">{statusMessage}</p>
      </header>

      <div className="flex flex-col items-start gap-4">
        <WalletMultiButton className="rounded-full bg-emerald-600 px-6 py-3 text-base font-medium text-white shadow-sm transition hover:bg-emerald-500" />
        <p className="text-xs text-slate-500 dark:text-slate-400">
          New to Solana? You can use wallets like Phantom or Solflare.
        </p>
      </div>

      {connected && (
        <aside className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm text-emerald-100">
          {/* Balance summary keeps non-technical teammates informed about what we show users. */}
          <p className="font-medium uppercase tracking-[0.2em] text-emerald-200">
            Wallet Balance ({clusterLabel})
          </p>
          <p className="mt-2 text-2xl font-semibold text-white">
            {isFetchingBalance && "Checking balance..."}
            {!isFetchingBalance &&
              (balance !== null ? `${balance.toFixed(4)} SOL` : "Balance unavailable")}
          </p>
          <p className="mt-1 text-xs text-emerald-200/80">
            {cluster === "mainnet-beta"
              ? "Mainnet SOL is live currency. Double-check amounts before approving transactions."
              : cluster === "devnet"
              ? "Devnet SOL is test currency. You can get free devnet SOL from a faucet to test with."
              : "You are connected to Solana testnet. Balances here do not represent real funds."}
          </p>
          {balanceError && (
            <p className="mt-2 rounded-lg border border-emerald-300/30 bg-emerald-300/10 p-3 text-xs text-emerald-100">
              {balanceError}
            </p>
          )}
        </aside>
      )}
    </section>
  );
}

