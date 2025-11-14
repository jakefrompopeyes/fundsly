'use client';

/**
 * Plain-language overview:
 * This file creates a wrapper around the entire app so every page can talk to Solana.
 * It picks the Solana network, lists the wallets we support, and gives child components
 * access to pop-up modals and connection state. Think of it as plumbing that keeps
 * the wallet connection alive across the site.
 */

import { type ReactNode, useMemo } from 'react';
import { clusterApiUrl } from '@solana/web3.js';
import {
  ConnectionProvider,
  WalletProvider,
} from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
} from '@solana/wallet-adapter-wallets';
import { getCurrentRPCEndpoint } from '@/lib/rpcManager';

import '@solana/wallet-adapter-react-ui/styles.css';

type WalletProvidersProps = {
  children: ReactNode;
};

// Default to devnet for testing. Change FALLBACK_CLUSTER to 'mainnet-beta' when ready for production.
const FALLBACK_CLUSTER = 'devnet' as const;
type SupportedCluster = 'devnet' | 'testnet' | 'mainnet-beta';

function resolveCluster(rawValue: string | undefined): SupportedCluster {
  if (!rawValue) return FALLBACK_CLUSTER;

  const value = rawValue.toLowerCase();

  if (value === 'mainnet' || value === 'mainnet-beta') {
    return 'mainnet-beta';
  }

  if (value === 'testnet') {
    return 'testnet';
  }

  if (value === 'devnet') {
    return 'devnet';
  }

  return FALLBACK_CLUSTER;
}

export function WalletProviders({ children }: WalletProvidersProps) {
  /**
   * Read the preferred cluster from an environment variable. Defaults to devnet for testing.
   * Set NEXT_PUBLIC_SOLANA_NETWORK=mainnet-beta in .env.local when ready for production.
   */
  const cluster = useMemo<SupportedCluster>(
    () => resolveCluster(process.env.NEXT_PUBLIC_SOLANA_NETWORK),
    [],
  );

  /**
   * Use multi-RPC manager that rotates between multiple endpoints
   * This helps avoid rate limits and provides automatic fallback
   */
  const endpoint = useMemo(() => {
    try {
      // Try to get endpoint from RPC manager (supports multiple providers)
      return getCurrentRPCEndpoint();
    } catch (error) {
      console.warn('RPC Manager failed, falling back to single endpoint:', error);
      // Fallback to old behavior if RPC manager fails
      const raw = process.env.NEXT_PUBLIC_SOLANA_RPC_ENDPOINT;
      const custom = typeof raw === 'string' ? raw.trim() : '';
      return custom || clusterApiUrl(cluster);
    }
  }, [cluster]);

  // Log endpoint for debugging
  console.log("🔗 Using RPC endpoint:", endpoint);

  /**
   * List the wallet brands we want to support. The wallet adapter library knows how to talk
   * to each wallet once we add it to this array. useMemo keeps the list stable between renders,
   * avoiding reconnection churn.
   */
  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
    [],
  );

  return (
    /**
     * ConnectionProvider opens the network pipe to Solana using the endpoint above.
     * WalletProvider tracks who is connected and can automatically reconnect on refresh.
     * WalletModalProvider adds the pre-built "Connect Wallet" pop-up UI components.
     */
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

