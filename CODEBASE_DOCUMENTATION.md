# Fundly Codebase Documentation

## Table of Contents
1. [Project Overview](#project-overview)
2. [Architecture Overview](#architecture-overview)
3. [Directory Structure](#directory-structure)
4. [Smart Contract Layer (Anchor/Rust)](#smart-contract-layer-anchorrust)
5. [Frontend Layer (Next.js/TypeScript)](#frontend-layer-nextjstypescript)
6. [File-by-File Breakdown](#file-by-file-breakdown)
7. [Data Flow & Connections](#data-flow--connections)

---

## Project Overview

**Fundly** is a Solana-based startup incubator platform that enables startups to create tokenized projects and allows investors to discover and invest in them. The platform consists of:

- **Backend**: Anchor smart contracts (Rust) deployed on Solana
- **Frontend**: Next.js application with TypeScript and Tailwind CSS
- **Integration**: Solana wallet adapter for wallet connections and transactions

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    User Browser                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │         Next.js Frontend (React)                 │  │
│  │  - Wallet Connection UI                          │  │
│  │  - Dashboard Pages                                │  │
│  │  - Token Creation Forms                           │  │
│  └──────────────────────────────────────────────────┘  │
└───────────────────┬─────────────────────────────────────┘
                    │
                    │ Wallet Adapter
                    │ (Phantom, Solflare)
                    │
┌───────────────────▼─────────────────────────────────────┐
│              Solana Blockchain                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │      Fundly Anchor Program (Rust)                │  │
│  │  - initialize_project()                          │  │
│  │  - create_mint()                                 │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

---

## Directory Structure

```
fundly.site/
├── programs/
│   └── fundly/              # Anchor smart contract
│       ├── Cargo.toml       # Rust dependencies
│       └── src/
│           └── lib.rs        # Main program logic
├── frontend/                # Next.js application
│   └── src/
│       ├── app/             # Next.js App Router pages
│       │   ├── layout.tsx   # Root layout with wallet providers
│       │   ├── page.tsx     # Landing page
│       │   └── dashboard/   # Dashboard section
│       │       ├── layout.tsx      # Dashboard layout with sidebar
│       │       ├── page.tsx        # Dashboard overview
│       │       ├── create-startup/ # Token creation page
│       │       ├── my-startups/    # User's startups
│       │       └── market/         # Market browsing
│       ├── components/      # Reusable React components
│       │   ├── wallet/      # Wallet-related components
│       │   └── navigation/  # Navigation components
│       ├── lib/             # Utility functions
│       │   ├── anchorClient.ts  # Anchor program client
│       │   └── pumpCurve.ts     # Bonding curve utilities
│       └── idl/             # Anchor IDL (Interface Definition)
│           └── fundly.json  # Generated program interface
├── Anchor.toml              # Anchor configuration
└── Cargo.toml               # Root Rust workspace config
```

---

## Smart Contract Layer (Anchor/Rust)

### `programs/fundly/src/lib.rs`

**Purpose**: The core Solana smart contract that handles project initialization and token mint creation on-chain.

#### Code Block Explanations

```rust
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token};
```
**Explanation**: Imports Anchor framework and SPL Token program interfaces. `anchor_lang` provides the core Anchor macros and types, while `anchor_spl` gives us access to token operations.

```rust
declare_id!("H7XbHBj8QiHn6rE69UDHXeVs8Dtjvo12fZDvCdtpMSZC");
```
**Explanation**: Sets the program's unique identifier on Solana. This address is generated when you run `anchor keys list` and must match the one in `Anchor.toml`.

```rust
#[program]
pub mod fundly {
    use super::*;
```
**Explanation**: The `#[program]` macro tells Anchor this module contains the program's instruction handlers. Anchor will automatically generate account validation and serialization code.

```rust
pub fn initialize_project(
    ctx: Context<InitializeProject>,
    name: String,
    symbol: String,
) -> Result<()> {
    let state = &mut ctx.accounts.project_state;
    state.owner = ctx.accounts.owner.key();
    state.mint = Pubkey::default();
    state.name = name;
    state.symbol = symbol;
    state.created_at = Clock::get()?.unix_timestamp;
    Ok(())
}
```
**Explanation**: 
- Creates a new project state account (PDA) on-chain
- Stores the owner's public key, project name, symbol, and creation timestamp
- Sets mint to default (will be updated when mint is created)
- `Clock::get()?` reads the current Solana blockchain timestamp

```rust
pub fn create_mint(ctx: Context<CreateMint>) -> Result<()> {
    let state = &mut ctx.accounts.project_state;
    state.mint = ctx.accounts.mint.key();
    Ok(())
}
```
**Explanation**: 
- Creates a new SPL token mint (the actual token)
- Links the mint address to the project state account
- The mint initialization is handled by Anchor's `#[account(init, ...)]` constraint

```rust
#[derive(Accounts)]
#[instruction(name: String, symbol: String)]
pub struct InitializeProject<'info> {
    #[account(
        init,
        payer = owner,
        seeds = [b"project", owner.key().as_ref(), symbol.as_bytes()],
        bump,
        space = ProjectState::MAX_SIZE,
    )]
    pub project_state: Account<'info, ProjectState>,
```
**Explanation**: 
- `#[derive(Accounts)]` tells Anchor to validate these accounts
- `init` creates a new account if it doesn't exist
- `payer = owner` means the owner pays for account creation fees
- `seeds` defines the PDA derivation: `["project", owner_pubkey, symbol]`
- `bump` is the canonical bump seed (finds the valid PDA)
- `space` reserves the exact bytes needed for the account

```rust
#[account]
pub struct ProjectState {
    pub owner: Pubkey,      // 32 bytes
    pub mint: Pubkey,       // 32 bytes
    pub name: String,       // 4 + up to 64 bytes
    pub symbol: String,     // 4 + up to 16 bytes
    pub created_at: i64,    // 8 bytes
}
```
**Explanation**: 
- `#[account]` macro tells Anchor this struct represents an on-chain account
- Comments show byte sizes for calculating `MAX_SIZE`
- This data is stored permanently on Solana

```rust
impl ProjectState {
    pub const MAX_SIZE: usize = 8  // discriminator
        + 32
        + 32
        + 4 + Self::MAX_NAME
        + 4 + Self::MAX_SYMBOL
        + 8;
}
```
**Explanation**: 
- Calculates total account size needed
- 8 bytes for Anchor's account discriminator
- Fixed-size fields (Pubkey = 32 bytes, i64 = 8 bytes)
- Variable-size strings: 4-byte length prefix + max content

### `programs/fundly/Cargo.toml`

**Purpose**: Defines Rust dependencies and build features for the Anchor program.

```toml
[features]
idl-build = ["anchor-lang/idl-build", "anchor-spl/idl-build"]
```
**Explanation**: Enables IDL generation during build. The IDL (Interface Definition Language) is a JSON file that describes the program's instructions and accounts for the frontend to use.

```toml
[dependencies]
anchor-lang = "0.32.1"
anchor-spl = { version = "0.32.1", features = ["token", "associated_token"] }
```
**Explanation**: 
- `anchor-lang`: Core Anchor framework
- `anchor-spl`: SPL token program helpers
- `associated_token`: Feature for creating associated token accounts

### `Anchor.toml`

**Purpose**: Anchor project configuration file.

```toml
[toolchain]
anchor_version = "0.32.1"
```
**Explanation**: Locks Anchor CLI version to match dependencies, preventing version mismatches.

```toml
[programs.localnet]
fundly = "H7XbHBj8QiHn6rE69UDHXeVs8Dtjvo12fZDvCdtpMSZC"
```
**Explanation**: Maps program name to its on-chain address. Change `localnet` to `devnet` or `mainnet` for different networks.

---

## Frontend Layer (Next.js/TypeScript)

### Root Layout & Configuration

#### `frontend/src/app/layout.tsx`

**Purpose**: Root layout that wraps all pages with wallet providers and global styles.

```typescript
import { WalletProviders } from "@/components/wallet/WalletProviders";
```
**Explanation**: Imports the wallet provider component that makes Solana wallet functionality available to all pages.

```typescript
export const metadata: Metadata = {
  title: "Fundly | Solana Startup Incubator",
  description: "Fundly connects vetted startups with early investors...",
};
```
**Explanation**: SEO metadata that appears in browser tabs and search results.

```typescript
<body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
  <WalletProviders>{children}</WalletProviders>
</body>
```
**Explanation**: 
- Applies custom fonts via CSS variables
- Wraps all page content with `WalletProviders` so every route can access wallet state

#### `frontend/src/app/page.tsx`

**Purpose**: Landing page that introduces Fundly and provides wallet connection.

**Connection**: Uses `WalletConnectionCard` component which reads wallet state from `WalletProviders`.

### Wallet Components

#### `frontend/src/components/wallet/WalletProviders.tsx`

**Purpose**: Sets up Solana connection and wallet adapters for the entire app.

```typescript
const endpoint = useMemo(() => {
  const raw = process.env.NEXT_PUBLIC_SOLANA_RPC_ENDPOINT;
  const custom = typeof raw === 'string' ? raw.trim() : '';
  return custom || clusterApiUrl(cluster);
}, [cluster]);
```
**Explanation**: 
- Reads RPC endpoint from environment variable (supports custom providers like Helius)
- Falls back to public Solana RPC if no custom endpoint is set
- `useMemo` prevents recreating the endpoint on every render

```typescript
const wallets = useMemo(
  () => [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
  [],
);
```
**Explanation**: 
- Creates wallet adapter instances for supported wallets
- Empty dependency array means this list is created once and reused

```typescript
<ConnectionProvider endpoint={endpoint}>
  <WalletProvider wallets={wallets} autoConnect>
    <WalletModalProvider>{children}</WalletModalProvider>
  </WalletProvider>
</ConnectionProvider>
```
**Explanation**: 
- `ConnectionProvider`: Manages connection to Solana network
- `WalletProvider`: Manages wallet connection state and provides hooks like `useWallet()`
- `autoConnect`: Automatically reconnects wallet on page refresh if previously connected
- `WalletModalProvider`: Provides the "Connect Wallet" modal UI

#### `frontend/src/components/wallet/WalletConnectionCard.tsx`

**Purpose**: UI component that displays wallet connection status and balance.

```typescript
const { publicKey, connected, wallet } = useWallet();
```
**Explanation**: 
- `useWallet()` hook provides current wallet state
- `publicKey`: User's wallet address (null if not connected)
- `connected`: Boolean indicating connection status
- `wallet`: Wallet adapter instance (Phantom, Solflare, etc.)

```typescript
useEffect(() => {
  if (!connected || !publicKey) {
    setBalance(null);
    return;
  }
  // ... fetch balance
}, [connection, connected, publicKey]);
```
**Explanation**: 
- `useEffect` runs when wallet connection changes
- Fetches SOL balance from blockchain when wallet connects
- Cleans up on disconnect or when component unmounts

### Navigation Components

#### `frontend/src/components/navigation/Sidebar.tsx`

**Purpose**: Collapsible left sidebar navigation for dashboard pages.

```typescript
const [collapsed, setCollapsed] = useState(false);
```
**Explanation**: Local state to track whether sidebar is collapsed (narrow) or expanded (wide).

```typescript
const navItems = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/create-startup", label: "Create Startup" },
  // ...
];
```
**Explanation**: Navigation menu items. Each links to a dashboard sub-page.

```typescript
const active = pathname === item.href;
```
**Explanation**: Determines which nav item is currently active by comparing current URL path.

```typescript
{collapsed ? item.label.charAt(0) : item.label}
```
**Explanation**: When collapsed, shows only first letter of label. When expanded, shows full label.

### Dashboard Pages

#### `frontend/src/app/dashboard/layout.tsx`

**Purpose**: Layout wrapper for all dashboard pages, includes sidebar and header with balance.

```typescript
const { connection } = useConnection();
const { publicKey, connected } = useWallet();
```
**Explanation**: 
- `useConnection()`: Gets Solana RPC connection
- `useWallet()`: Gets wallet state (same as in WalletConnectionCard)

```typescript
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
```
**Explanation**: 
- Fetches wallet balance whenever connection or publicKey changes
- `live` flag prevents state updates if component unmounts during async operation
- Converts lamports (smallest SOL unit) to SOL by dividing by `LAMPORTS_PER_SOL` (1 billion)
- Cleanup function sets `live = false` to cancel pending updates

```typescript
<Sidebar />
<div className="flex min-h-screen flex-1 flex-col">
  <header>...</header>
  <main>{children}</main>
</div>
```
**Explanation**: 
- Sidebar on left, main content area on right
- `children` is the specific dashboard page (Overview, Create Startup, etc.)

#### `frontend/src/app/dashboard/create-startup/page.tsx`

**Purpose**: Page where users create new tokenized startup projects.

```typescript
const [name, setName] = useState("");
const [symbol, setSymbol] = useState("");
```
**Explanation**: React state for form inputs. `name` is the full project name, `symbol` is the token ticker (e.g., "MST").

```typescript
const { connection } = useConnection();
const wallet = useWallet();
```
**Explanation**: Gets Solana connection and wallet state needed for on-chain transactions.

```typescript
onClick={async () => {
  setNotice(null);
  setSubmitting(true);
  try {
    await rpc_initializeProject(connection, wallet, name, symbol);
    const mint = await rpc_createMint(connection, wallet, symbol);
    setNotice(`Project initialized. Mint: ${mint.toBase58()}`);
  } catch (e: any) {
    // error handling
  } finally {
    setSubmitting(false);
  }
}}
```
**Explanation**: 
- When "Create Token" is clicked:
  1. Calls `rpc_initializeProject()` to create project state account on-chain
  2. Calls `rpc_createMint()` to create the SPL token mint
  3. Shows success message with mint address
- `setSubmitting` prevents double-clicks during transaction
- Error handling shows user-friendly messages

### Library Functions

#### `frontend/src/lib/anchorClient.ts`

**Purpose**: Client-side wrapper for interacting with the Anchor program from the frontend.

```typescript
const idl = idlJson as unknown as Idl;
```
**Explanation**: 
- Loads the IDL (Interface Definition Language) JSON file
- Type assertion through `unknown` handles TypeScript type mismatches
- IDL describes all program instructions and accounts

```typescript
export function getProgram(connection: Connection, wallet: WalletContextState) {
  if (!wallet.publicKey) throw new Error("Wallet not connected");
  
  const anchorWallet = {
    publicKey: wallet.publicKey,
    signTransaction: async (tx: any) => {
      if (!wallet.signTransaction) {
        throw new Error("Wallet does not support signTransaction");
      }
      return await wallet.signTransaction(tx);
    },
    // ...
  };
```
**Explanation**: 
- Converts wallet adapter format to Anchor's expected wallet interface
- Anchor needs `signTransaction` and `signAllTransactions` methods
- Wallet adapter provides these, but in a different format

```typescript
const provider = new AnchorProvider(connection, anchorWallet as any, {
  commitment: "confirmed",
});
```
**Explanation**: 
- Creates Anchor provider that combines connection and wallet
- `commitment: "confirmed"` means wait for transaction confirmation before returning

```typescript
const program = new (Program as any)(idl, programId, provider) as Program<Idl>;
```
**Explanation**: 
- Creates program instance from IDL
- Type assertion workaround for TypeScript overload resolution issues
- This program object has methods like `.methods.initializeProject()`

```typescript
export async function deriveProjectPda(owner: web3.PublicKey, symbol: string) {
  const programId = new web3.PublicKey((idl as any).address || "...");
  const [pda] = web3.PublicKey.findProgramAddressSync(
    [Buffer.from("project"), owner.toBuffer(), Buffer.from(symbol)],
    programId,
  );
  return pda;
}
```
**Explanation**: 
- Derives the Program Derived Address (PDA) for a project
- PDAs are deterministic addresses derived from seeds
- Seeds: `["project", owner_pubkey, symbol]`
- Must match the seeds in the Rust program's `#[account(seeds = ...)]`

```typescript
export async function rpc_initializeProject(
  connection: Connection,
  wallet: WalletContextState,
  name: string,
  symbol: string,
) {
  if (!wallet.publicKey) throw new Error("Wallet not connected");
  const { program } = getProgram(connection, wallet);
  const owner = wallet.publicKey;
  const projectPda = await deriveProjectPda(owner, symbol);

  return program.methods
    .initializeProject(name, symbol)
    .accounts({
      projectState: projectPda,
      owner,
      systemProgram: web3.SystemProgram.programId,
    })
    .rpc();
}
```
**Explanation**: 
- Calls the `initialize_project` instruction on-chain
- `.methods.initializeProject()` matches the Rust function name (camelCase)
- `.accounts()` provides all accounts the instruction needs
- `.rpc()` sends the transaction and waits for confirmation
- Returns transaction signature

```typescript
export async function rpc_createMint(
  connection: Connection,
  wallet: WalletContextState,
  symbol: string,
) {
  // ...
  const mintKeypair = web3.Keypair.generate();

  await program.methods
    .createMint()
    .accounts({
      projectState: projectPda,
      mint: mintKeypair.publicKey,
      owner,
      systemProgram: web3.SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .signers([mintKeypair])
    .rpc();
```
**Explanation**: 
- Generates a new keypair for the mint account (mint needs its own keypair)
- `.signers([mintKeypair])` tells Anchor to sign with this keypair
- Mint account is created with this keypair as its address
- Returns the mint public key

#### `frontend/src/lib/pumpCurve.ts`

**Purpose**: Bonding curve mathematics for token pricing (currently not used but prepared for future pump.fun-style features).

**Note**: This file contains utility functions for calculating token prices based on a constant product market maker (CPMM) model with virtual reserves. It's not currently integrated but is ready for future bonding curve features.

### IDL File

#### `frontend/src/idl/fundly.json`

**Purpose**: Auto-generated JSON file that describes the Anchor program's interface.

**Explanation**: 
- Generated by `anchor build` command
- Contains all instruction names, account structures, and argument types
- Frontend uses this to know how to call program instructions
- Must be updated whenever the Rust program changes

**Key Fields**:
- `address`: Program's on-chain address
- `instructions`: List of all callable functions
- `types`: Account and data structure definitions

---

## Data Flow & Connections

### Wallet Connection Flow

```
1. User visits site
   ↓
2. RootLayout loads → WalletProviders wraps app
   ↓
3. WalletProviders sets up ConnectionProvider + WalletProvider
   ↓
4. User clicks "Connect Wallet" button
   ↓
5. WalletModalProvider shows wallet selection modal
   ↓
6. User selects Phantom/Solflare → Wallet connects
   ↓
7. useWallet() hook provides connection state to all components
   ↓
8. WalletConnectionCard and DashboardLayout fetch balance
```

### Token Creation Flow

```
1. User navigates to /dashboard/create-startup
   ↓
2. Fills in name and symbol fields
   ↓
3. Clicks "Create Token" button
   ↓
4. create-startup/page.tsx calls rpc_initializeProject()
   ↓
5. anchorClient.ts:
   - Gets program instance via getProgram()
   - Derives project PDA via deriveProjectPda()
   - Calls program.methods.initializeProject()
   ↓
6. Anchor sends transaction to Solana
   ↓
7. Rust program's initialize_project() executes:
   - Creates ProjectState PDA account
   - Stores owner, name, symbol, timestamp
   ↓
8. Frontend calls rpc_createMint()
   ↓
9. Anchor sends second transaction
   ↓
10. Rust program's create_mint() executes:
    - Creates SPL token mint account
    - Links mint to ProjectState
    ↓
11. Success message shown with mint address
```

### Component Hierarchy

```
RootLayout (app/layout.tsx)
└── WalletProviders (components/wallet/WalletProviders.tsx)
    ├── ConnectionProvider (Solana network connection)
    ├── WalletProvider (Wallet state management)
    └── WalletModalProvider (Connect wallet UI)
        └── All Pages
            ├── Landing Page (app/page.tsx)
            │   └── WalletConnectionCard
            └── Dashboard Pages (app/dashboard/*)
                └── DashboardLayout (app/dashboard/layout.tsx)
                    ├── Sidebar (components/navigation/Sidebar.tsx)
                    └── Page Content (varies by route)
                        └── Create Startup Page
                            └── Uses anchorClient.ts
                                └── Calls Anchor Program (Rust)
```

---

## Environment Variables

### Required for Frontend

Create `frontend/.env.local`:

```bash
NEXT_PUBLIC_SOLANA_NETWORK=mainnet-beta
NEXT_PUBLIC_SOLANA_RPC_ENDPOINT=https://your-rpc-endpoint.com/?api-key=...
```

**Explanation**:
- `NEXT_PUBLIC_*` prefix makes variables available in browser
- `NEXT_PUBLIC_SOLANA_NETWORK`: Which Solana network to use (mainnet-beta, testnet)
- `NEXT_PUBLIC_SOLANA_RPC_ENDPOINT`: Custom RPC provider URL (optional, falls back to public RPC)

---

## Key Concepts

### Program Derived Addresses (PDAs)

**What**: Deterministic addresses derived from seeds, controlled by the program (not a private key).

**Why**: Allows programs to "own" accounts without needing a keypair.

**In Fundly**: Project state accounts are PDAs derived from `["project", owner, symbol]`. This ensures:
- Each owner+symbol combination has a unique address
- Only the program can modify these accounts
- Addresses are predictable and can be calculated off-chain

### Anchor Framework

**What**: A Rust framework for building Solana programs that handles:
- Account validation
- Serialization/deserialization
- Instruction routing
- Error handling

**Benefits**: 
- Less boilerplate than raw Solana programs
- Type-safe account structures
- Automatic IDL generation

### Wallet Adapter

**What**: A React library that provides:
- Wallet connection management
- Transaction signing
- Balance fetching
- Multi-wallet support (Phantom, Solflare, etc.)

**How it works**: 
- Provides React hooks (`useWallet`, `useConnection`)
- Handles wallet-specific APIs
- Shows connection modals
- Manages connection state

---

## Development Workflow

### Building the Program

```bash
# 1. Ensure Rust, Solana CLI, and Anchor are installed
# 2. Build the Anchor program
cd /Users/dannyzirko/fundly.site
export PATH="$HOME/.cargo/bin:/Users/dannyzirko/.local/share/solana/install/active_release/bin:/Users/dannyzirko/.avm/bin:$PATH"
anchor build

# 3. Copy generated IDL to frontend
cp target/idl/fundly.json frontend/src/idl/fundly.json
```

### Running the Frontend

```bash
cd frontend
npm install
npm run dev
```

### Deploying the Program

```bash
# To devnet (for testing)
anchor deploy --provider.cluster devnet

# To mainnet (production)
anchor deploy --provider.cluster mainnet-beta
```

---

## Future Enhancements

Based on the codebase structure, potential next features:

1. **Bonding Curve Integration**: Use `pumpCurve.ts` to implement pump.fun-style token pricing
2. **Project Listings**: Display created projects in `/dashboard/market`
3. **User Dashboard**: Show user's created projects in `/dashboard/my-startups`
4. **Token Metadata**: Add Metaplex token metadata for richer token information
5. **Investment Flow**: Add instructions for investors to purchase tokens

---

## Troubleshooting

### Common Issues

1. **"Program failed to complete"**: Program not deployed to the network you're using
2. **"Account not provided"**: Missing account in `.accounts()` call
3. **"Invalid program ID"**: Program ID mismatch between IDL and Anchor.toml
4. **Balance shows 0**: Check RPC endpoint is correct and wallet is on the right network

---

## Summary

This codebase implements a minimal viable product for tokenized startup creation on Solana:

- **Smart Contract**: Two instructions (initialize project, create mint)
- **Frontend**: Dashboard with wallet integration and token creation form
- **Integration**: TypeScript client that calls Rust program via Anchor

The architecture separates concerns cleanly:
- Rust handles on-chain logic
- TypeScript handles UI and user interactions
- Anchor bridges the two with type-safe interfaces

