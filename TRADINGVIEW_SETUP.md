# TradingView Charting Library Setup Guide

This guide explains how to set up TradingView Charting Library with custom Solana token data.

## Overview

We've implemented a custom data feed (`SolanaDataFeed`) that converts your Solana transaction data into TradingView's format. The chart component is ready to use once you set up the TradingView Charting Library.

## Step 1: Get TradingView Charting Library

1. Visit [TradingView Charting Library](https://www.tradingview.com/charting-library/)
2. Request access (free for non-commercial use, requires license for commercial)
3. Download the library files after approval

## Step 2: Install Library Files

1. Extract the downloaded TradingView Charting Library
2. Copy the entire `charting_library` folder to your `public` directory:
   ```
   frontend/public/charting_library/
   ```

## Step 3: Load the Library

Add the TradingView script to your main layout file (`frontend/src/app/layout.tsx`):

```tsx
import Script from 'next/script';

export default function RootLayout({ children }) {
  return (
    <html>
      <head>
        <Script
          src="/charting_library/charting_library.js"
          strategy="beforeInteractive"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
```

## Step 4: Verify Setup

The `PriceChart` component will automatically detect if TradingView Charting Library is loaded. If not, it will show setup instructions.

## How It Works

1. **Data Feed**: `SolanaDataFeed` class converts your Solana transactions into TradingView's bar/candlestick format
2. **Real-time Updates**: The data feed updates automatically when new transactions occur
3. **Multiple Timeframes**: Supports 1m, 5m, 15m, 30m, 1h, 4h, and daily charts

## Customization

You can customize the chart by modifying the `widgetOptions` in `PriceChart.tsx`:

- `disabled_features`: Remove features you don't need
- `enabled_features`: Add features you want
- `theme`: Change chart theme ("light" or "dark")
- `studies_overrides`: Customize indicators

## Troubleshooting

- **Library not loading**: Check that files are in `public/charting_library/`
- **No data showing**: Ensure transactions are being fetched correctly
- **Chart not rendering**: Check browser console for errors

## Alternative: Use lightweight-charts

If you prefer not to use TradingView Charting Library, you can switch back to `lightweight-charts` which is already installed and doesn't require setup.

