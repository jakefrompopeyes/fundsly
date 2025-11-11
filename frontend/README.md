## Fundly Frontend

Lightweight Next.js interface showcasing Solana wallet connectivity for Fundly.

### Prerequisites
- Node.js 18+
- npm (project uses npm lockfile)
- A Solana wallet such as Phantom or Solflare

### Environment Variables
Create a `.env.local` file in this directory with the Solana network you want to target (defaults to mainnet-beta if omitted):

```
NEXT_PUBLIC_SOLANA_NETWORK=mainnet-beta

# Optional: set a custom RPC endpoint instead of the public cluster URL
# NEXT_PUBLIC_SOLANA_RPC_ENDPOINT=https://your-mainnet-rpc-url
```

Valid values for `NEXT_PUBLIC_SOLANA_NETWORK` are `testnet` or `mainnet-beta`.

### Run the App
```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the landing page. Connect your wallet with the button to see the live balance and network details.

### Switching to Mainnet
1. Update `.env.local` to `NEXT_PUBLIC_SOLANA_NETWORK=mainnet-beta`.
2. Provide `NEXT_PUBLIC_SOLANA_RPC_ENDPOINT` from a mainnet provider (Helius, Triton, QuickNode, etc.). The public Solana RPC often returns HTTP 403 for anonymous requests.
3. Restart `npm run dev` so Next.js picks up the new environment.

The UI will automatically adjust its messaging to highlight that transactions occur with real SOL on mainnet.

### Notes for Non-Technical Reviewers
- Every page is wrapped in Solana wallet providers, so the connection persists across navigation.
- The hero card displays the connected wallet address in a friendly format plus the current SOL balance.
- Copy changes based on the chosen network to avoid confusion between test and production environments.
