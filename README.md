# Fundly - Solana Token Launch Platform

A decentralized platform for launching and trading startup tokens on Solana with bonding curves, automatic DEX migration, and vesting schedules.

## Project Structure

```
fundly.site/
├── programs/           # Solana/Anchor smart contracts
│   └── fundly/        # Main Fundly program
├── frontend/          # Next.js web application
├── scripts/           # Deployment and testing scripts
└── docs/              # Documentation files (*.md)
```

## Features

- 🚀 **Token Launch**: Create startup tokens with bonding curve pricing
- 📈 **Trading Interface**: Buy/sell tokens with real-time price updates
- 💰 **Automatic Migration**: Tokens migrate to DEX when market cap threshold is reached
- 🔒 **Vesting Schedules**: Creator token allocation with configurable vesting
- 💹 **TradingView Charts**: Professional charting with lightweight-charts
- 🎫 **Support System**: Integrated ticketing via Supabase
- 👛 **Wallet Integration**: Solana wallet adapter support

## Tech Stack

### Smart Contract
- **Anchor Framework** (Solana)
- **Rust**

### Frontend
- **Next.js 16** (React 19)
- **TypeScript**
- **Tailwind CSS 4**
- **@solana/web3.js** & **@coral-xyz/anchor**
- **Solana Wallet Adapter**
- **Lightweight Charts** (TradingView)
- **Supabase** (Database & Support)

## Getting Started

### Prerequisites

- Node.js 18+
- Rust & Cargo
- Solana CLI
- Anchor Framework
- Supabase account

### Environment Variables

Copy `.env.example` to `frontend/.env.local` and fill in your values:

```bash
cp .env.example frontend/.env.local
```

Required variables:
- `NEXT_PUBLIC_SOLANA_NETWORK` - devnet/mainnet-beta
- `NEXT_PUBLIC_SOLANA_RPC_ENDPOINT` - Your RPC endpoint
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key
- `NEXT_PUBLIC_PROGRAM_ID` - Your deployed program ID

### Local Development

1. **Install Frontend Dependencies**
```bash
cd frontend
npm install
```

2. **Run Development Server**
```bash
npm run dev
```

Visit `http://localhost:3000`

3. **Build Anchor Program**
```bash
anchor build
```

4. **Deploy Program (Devnet)**
```bash
anchor deploy
```

## Deploying to Vercel

### Quick Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/jakefrompopeyes/fundsly)

### Manual Deployment

1. **Connect Repository**: Import your GitHub repository to Vercel

2. **Configure Build Settings**:
   - **Framework Preset**: Next.js
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `.next`

3. **Add Environment Variables** in Vercel Dashboard:
   - Add all variables from `.env.example`
   - Use production values for mainnet deployment

4. **Deploy**: Click "Deploy" and Vercel will build and deploy your app

### Important Notes for Vercel

- ✅ The `vercel.json` configuration is already set up for the subdirectory structure
- ✅ Build commands point to the `frontend/` directory
- ⚠️ Make sure to set all environment variables in Vercel dashboard
- ⚠️ Update `NEXT_PUBLIC_PROGRAM_ID` with your deployed program ID

## Documentation

Detailed guides available in the repository:

- [Bonding Curve Guide](BONDING_CURVE_GUIDE.md)
- [Market Cap & Migration](MARKET_CAP_LAUNCH_GUIDE.md)
- [Vesting Implementation](VESTING_GUIDE.md)
- [Backend Implementation](BACKEND_IMPLEMENTATION_GUIDE.md)
- [Deployment Checklist](DEPLOYMENT_CHECKLIST.md)

## Project Status

This is an active development project. See documentation files for implementation details and guides.

## License

Private - All Rights Reserved

