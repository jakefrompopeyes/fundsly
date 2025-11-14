/**
 * TradingView Custom Data Feed
 * Converts Solana transaction data into TradingView's format
 */

export interface Bar {
  time: number; // Unix timestamp in seconds
  low: number;
  high: number;
  open: number;
  close: number;
  volume: number;
}

export interface Transaction {
  signature: string;
  type: "buy" | "sell";
  user: string;
  amount: number;
  price: number;
  total: number;
  timestamp: number; // Unix timestamp in milliseconds
}

export class SolanaDataFeed {
  private transactions: Transaction[] = [];
  private currentPrice: number = 0;
  private resolution: string = "1"; // Default 1 minute
  private onReadyCallback?: (config: any) => void;
  private onRealtimeCallback?: (bar: Bar) => void;
  private subscriptions: Map<string, any> = new Map();

  constructor(transactions: Transaction[], currentPrice: number) {
    this.transactions = transactions.sort((a, b) => a.timestamp - b.timestamp);
    this.currentPrice = currentPrice;
  }

  updateData(transactions: Transaction[], currentPrice: number) {
    this.transactions = transactions.sort((a, b) => a.timestamp - b.timestamp);
    this.currentPrice = currentPrice;
  }

  // Convert transactions to bars (candlesticks)
  // Each transaction creates its own candle for granular view
  private transactionsToBars(
    transactions: Transaction[],
    resolution: string
  ): Bar[] {
    if (transactions.length === 0 && this.currentPrice === 0) {
      return [];
    }

    // Create one bar per transaction for maximum granularity
    const bars: Bar[] = [];

    transactions.forEach((tx, index) => {
      if (tx.price <= 0) return;

      // Each transaction gets its own bar with a visible body
      // Add a 3% spread to make the candle clearly visible
      const spread = tx.price * 0.03; // 3% spread for visibility
      
      // Determine if it's a buy (green/up) or sell (red/down) based on transaction type
      const isBuy = tx.type === "buy";
      
      bars.push({
        time: Math.floor(tx.timestamp / 1000), // Convert to seconds
        open: isBuy ? tx.price - spread : tx.price + spread,
        high: tx.price + spread,
        low: tx.price - spread,
        close: isBuy ? tx.price + spread : tx.price - spread,
        volume: tx.total,
      });
    });

    // Add current price if we have one and it's different from the last transaction
    if (this.currentPrice > 0) {
      const now = Date.now();
      const spread = this.currentPrice * 0.03; // 3% spread for visibility
      
      if (bars.length === 0) {
        // No transactions, create a bar with current price (neutral/flat)
        bars.push({
          time: Math.floor(now / 1000),
          open: this.currentPrice - spread,
          high: this.currentPrice + spread,
          low: this.currentPrice - spread,
          close: this.currentPrice + spread,
          volume: 0,
        });
      } else {
        const lastBar = bars[bars.length - 1];
        // Only add a new bar if the current price is different and some time has passed
        if (this.currentPrice !== lastBar.close && now - (lastBar.time * 1000) > 1000) {
          const isUp = this.currentPrice > lastBar.close;
          bars.push({
            time: Math.floor(now / 1000),
            open: isUp ? this.currentPrice - spread : this.currentPrice + spread,
            high: this.currentPrice + spread,
            low: this.currentPrice - spread,
            close: isUp ? this.currentPrice + spread : this.currentPrice - spread,
            volume: 0,
          });
        }
      }
    }

    return bars;
  }

  private parseResolution(resolution: string): number {
    // Resolution format: "1", "5", "15", "60", "D", "W", "M"
    if (resolution === "D") return 24 * 60 * 60 * 1000; // 1 day
    if (resolution === "W") return 7 * 24 * 60 * 60 * 1000; // 1 week
    if (resolution === "M") return 30 * 24 * 60 * 60 * 1000; // 1 month
    
    const minutes = parseInt(resolution);
    if (!isNaN(minutes)) {
      return minutes * 60 * 1000;
    }
    
    return 60 * 1000; // Default to 1 minute
  }

  // TradingView Datafeed API methods
  onReady(callback: (config: any) => void) {
    this.onReadyCallback = callback;
    
    // Call immediately with configuration
    callback({
      supported_resolutions: ["1", "5", "15", "30", "60", "240", "D"],
      supports_group_request: false,
      supports_marks: false,
      supports_search: false,
      supports_timescale_marks: false,
      supports_time: true,
    });
  }

  searchSymbols(
    userInput: string,
    exchange: string,
    symbolType: string,
    onResult: (symbols: any[]) => void
  ) {
    // Not implemented - we only have one symbol
    onResult([]);
  }

  resolveSymbol(
    symbolName: string,
    onResolve: (symbolInfo: any) => void,
    onError: (reason: string) => void
  ) {
    // Return symbol configuration
    onResolve({
      name: symbolName,
      ticker: symbolName,
      description: symbolName,
      type: "crypto",
      session: "24x7",
      timezone: "Etc/UTC",
      exchange: "Solana",
      minmov: 1,
      pricescale: 100000000, // 8 decimal places
      has_intraday: true,
      has_weekly_and_monthly: true,
      supported_resolutions: ["1", "5", "15", "30", "60", "240", "D"],
      volume_precision: 8,
      data_status: "streaming",
    });
  }

  getBars(
    symbolInfo: any,
    resolution: string,
    periodParams: {
      from: number;
      to: number;
      firstDataRequest: boolean;
    },
    onResult: (bars: Bar[], meta: { noData: boolean }) => void,
    onError: (reason: string) => void
  ) {
    try {
      this.resolution = resolution;
      
      // Filter transactions by time range
      const fromMs = periodParams.from * 1000;
      const toMs = periodParams.to * 1000;
      
      const filteredTxs = this.transactions.filter(
        (tx) => tx.timestamp >= fromMs && tx.timestamp <= toMs
      );

      const bars = this.transactionsToBars(filteredTxs, resolution);
      
      onResult(bars, {
        noData: bars.length === 0,
      });
    } catch (error: any) {
      onError(error.message || "Failed to get bars");
    }
  }

  subscribeBars(
    symbolInfo: any,
    resolution: string,
    onTick: (bar: Bar) => void,
    subscriberUID: string,
    onResetCacheNeededCallback: () => void
  ) {
    this.subscriptions.set(subscriberUID, {
      symbolInfo,
      resolution,
      onTick,
      onResetCacheNeededCallback,
    });

    // Send current bar if we have data
    if (this.transactions.length > 0 || this.currentPrice > 0) {
      const bars = this.transactionsToBars(this.transactions, resolution);
      if (bars.length > 0) {
        onTick(bars[bars.length - 1]);
      }
    }
  }

  unsubscribeBars(subscriberUID: string) {
    this.subscriptions.delete(subscriberUID);
  }

  // Update real-time data
  updateRealtimeData(transactions: Transaction[], currentPrice: number) {
    this.updateData(transactions, currentPrice);
    
    // Notify all subscribers
    this.subscriptions.forEach((subscription) => {
      const bars = this.transactionsToBars(this.transactions, subscription.resolution);
      if (bars.length > 0) {
        subscription.onTick(bars[bars.length - 1]);
      }
    });
  }
}

