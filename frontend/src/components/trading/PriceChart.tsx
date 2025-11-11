"use client";

import { useEffect, useRef, useState } from "react";
import { createChart, ColorType, IChartApi, ISeriesApi, Time } from "lightweight-charts";
import { useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { deriveBondingCurvePda, fetchTokenMetadata } from "@/lib/anchorClient";
import { SolanaDataFeed, type Transaction } from "@/lib/tradingViewDataFeed";

interface PriceChartProps {
  mintAddress: string;
  currentPrice: number;
  tokenSymbol?: string;
  transactions?: Transaction[];
  totalSupply?: number;
}

export default function PriceChart({
  mintAddress,
  currentPrice,
  tokenSymbol: providedSymbol,
  transactions: providedTransactions,
  totalSupply = 1_000_000_000, // Default 1 billion tokens
}: PriceChartProps) {
  const { connection } = useConnection();
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [timeframe, setTimeframe] = useState<"1h" | "6h" | "24h" | "all">("24h");
  const [transactions, setTransactions] = useState<Transaction[]>(providedTransactions || []);
  const [loading, setLoading] = useState(!providedTransactions);
  const [tokenSymbol, setTokenSymbol] = useState(providedSymbol || "TOKEN");
  const [viewMode, setViewMode] = useState<"price" | "marketCap">("marketCap");
  const [solPriceUSD, setSolPriceUSD] = useState<number>(0);
  
  // Chart refs
  const lwChartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);

  // Fetch SOL price in USD
  useEffect(() => {
    const fetchSOLPrice = async () => {
      try {
        // Use CoinGecko API (free, no API key needed)
        const response = await fetch(
          "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd"
        );
        const data = await response.json();
        if (data.solana?.usd) {
          setSolPriceUSD(data.solana.usd);
        }
      } catch (error) {
        console.error("Error fetching SOL price:", error);
        // Fallback to a default price if API fails
        setSolPriceUSD(150); // Approximate SOL price fallback
      }
    };

    fetchSOLPrice();
    // Refresh SOL price every 5 minutes
    const interval = setInterval(fetchSOLPrice, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Calculate market cap in USD
  const currentMarketCapSOL = currentPrice * totalSupply;
  const currentMarketCapUSD = currentMarketCapSOL * solPriceUSD;

  // Fetch token metadata
  useEffect(() => {
    if (providedSymbol) {
      setTokenSymbol(providedSymbol);
      return;
    }

    const fetchMetadata = async () => {
      try {
        const mint = new PublicKey(mintAddress);
        const metadata = await fetchTokenMetadata(connection, mint);
        if (metadata) {
          setTokenSymbol(metadata.symbol || "TOKEN");
        }
      } catch (error) {
        console.error("Error fetching token metadata:", error);
      }
    };

    fetchMetadata();
  }, [mintAddress, connection, providedSymbol]);

  // Fetch transactions if not provided
  useEffect(() => {
    if (providedTransactions) {
      setTransactions(providedTransactions);
      return;
    }

    const fetchTransactions = async () => {
      try {
        setLoading(true);
        const mint = new PublicKey(mintAddress);
        const bondingCurvePda = await deriveBondingCurvePda(mint);
        
        const signatures = await connection.getSignaturesForAddress(
          bondingCurvePda,
          { limit: 100 }
        );

        const txList: Transaction[] = [];
        const batchSize = 5;
        
        for (let i = 0; i < signatures.length; i += batchSize) {
          const batch = signatures.slice(i, i + batchSize);
          const results = await Promise.allSettled(
            batch.map(sig => 
              connection.getParsedTransaction(sig.signature, {
                maxSupportedTransactionVersion: 0,
              })
            )
          );

          for (let j = 0; j < results.length; j++) {
            const result = results[j];
            const sig = batch[j];
            
            if (result.status === 'rejected' || !result.value) continue;
            
            const tx = result.value;
            if (!tx || !tx.meta) continue;

            const signature = sig.signature;
            const timestamp = (sig.blockTime || Date.now() / 1000) * 1000;

            const signers = tx.transaction.message.accountKeys.filter((key) => key.signer);
            const user = signers.length > 0 
              ? signers[0].pubkey.toBase58()
              : tx.transaction.message.accountKeys[0]?.pubkey.toBase58() || "Unknown";

            let type: "buy" | "sell" = "buy";
            const logs = tx.meta.logMessages || [];
            
            for (const log of logs) {
              if (log.toLowerCase().includes("buy") || 
                  log.includes("Instruction: BuyTokens") ||
                  log.includes("Program log: buy_tokens")) {
                type = "buy";
                break;
              } else if (log.toLowerCase().includes("sell") || 
                         log.includes("Instruction: SellTokens") ||
                         log.includes("Program log: sell_tokens")) {
                type = "sell";
                break;
              }
            }

            const preTokenBalances = tx.meta.preTokenBalances || [];
            const postTokenBalances = tx.meta.postTokenBalances || [];
            const preBalances = tx.meta.preBalances || [];
            const postBalances = tx.meta.postBalances || [];

            let maxSolDiff = 0;
            for (let k = 0; k < preBalances.length; k++) {
              if (preBalances[k] && postBalances[k]) {
                const diff = Math.abs(postBalances[k] - preBalances[k]) / 1_000_000_000;
                if (diff > maxSolDiff && diff < 100) {
                  maxSolDiff = diff;
                }
              }
            }

            let maxTokenDiff = 0;
            for (const postBalance of postTokenBalances) {
              const preBalance = preTokenBalances.find(
                (b) => b.accountIndex === postBalance.accountIndex
              );
              
              if (preBalance) {
                const preAmount = parseFloat(
                  preBalance.uiTokenAmount.uiAmountString || "0"
                );
                const postAmount = parseFloat(
                  postBalance.uiTokenAmount.uiAmountString || "0"
                );
                const tokenDiff = Math.abs(postAmount - preAmount);
                
                if (tokenDiff > maxTokenDiff) {
                  maxTokenDiff = tokenDiff;
                }
              } else if (postBalance.uiTokenAmount.uiAmountString) {
                const tokenAmount = parseFloat(postBalance.uiTokenAmount.uiAmountString);
                if (tokenAmount > maxTokenDiff) {
                  maxTokenDiff = tokenAmount;
                }
              }
            }

            for (const preBalance of preTokenBalances) {
              const postBalance = postTokenBalances.find(
                (b) => b.accountIndex === preBalance.accountIndex
              );
              
              if (!postBalance && preBalance.uiTokenAmount.uiAmountString) {
                const tokenAmount = parseFloat(preBalance.uiTokenAmount.uiAmountString);
                if (tokenAmount > maxTokenDiff) {
                  maxTokenDiff = tokenAmount;
                }
              }
            }

            const total = maxSolDiff;
            const amount = maxTokenDiff;
            const price = amount > 0 && total > 0 ? total / amount : 0;

            if (price > 0) {
              txList.push({
                signature: signature.slice(0, 4) + "..." + signature.slice(-4),
                type,
                user: user.slice(0, 4) + "..." + user.slice(-4),
                amount,
                price,
                total,
                timestamp,
              });
            }
          }

          if (i + batchSize < signatures.length) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }

        txList.sort((a, b) => a.timestamp - b.timestamp);
        setTransactions(txList);
      } catch (error: any) {
        console.error("Error fetching transactions for chart:", error);
        setTransactions([]);
      } finally {
        setLoading(false);
      }
    };

    fetchTransactions();
    const interval = setInterval(fetchTransactions, 45000);
    return () => clearInterval(interval);
  }, [mintAddress, connection, providedTransactions]);

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "#0f172a" },
        textColor: "#e2e8f0",
      },
      grid: {
        vertLines: { 
          visible: true,
          color: "rgba(148, 163, 184, 0.1)",
          style: 0,
        },
        horzLines: { 
          visible: true,
          color: "rgba(148, 163, 184, 0.1)",
          style: 0,
        },
      },
      width: chartContainerRef.current.clientWidth,
      height: 500,
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderColor: "rgba(148, 163, 184, 0.2)",
        rightOffset: 10,
      },
      rightPriceScale: {
        borderColor: "rgba(148, 163, 184, 0.2)",
        scaleMargins: {
          top: 0.1,
          bottom: 0.2,
        },
        autoScale: true,
        entireTextOnly: true, // Prevent overlapping labels
        ticksVisible: true,
      },
      leftPriceScale: {
        visible: false,
      },
    });

    const candlestickSeries = chart.addCandlestickSeries({
      upColor: "#10b981",
      downColor: "#ef4444",
      borderUpColor: "#10b981",
      borderDownColor: "#ef4444",
      wickUpColor: "#10b981",
      wickDownColor: "#ef4444",
      priceFormat: {
        type: "custom",
        formatter: (price: number) => {
          // This will be updated dynamically based on view mode
          return price.toFixed(8);
        },
      },
    });

    const volumeSeries = chart.addHistogramSeries({
      color: "#8b5cf6",
      priceFormat: {
        type: "volume",
      },
      priceScaleId: "",
    });

    lwChartRef.current = chart;
    candlestickSeriesRef.current = candlestickSeries;
    volumeSeriesRef.current = volumeSeries;

    const handleResize = () => {
      if (chartContainerRef.current && lwChartRef.current) {
        lwChartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
    };
  }, []);

  // Update chart data
  useEffect(() => {
    if (!candlestickSeriesRef.current || !volumeSeriesRef.current) return;

    const dataFeed = new SolanaDataFeed(transactions, currentPrice);
    const resolution = timeframe === "1h" ? "60" : timeframe === "6h" ? "240" : timeframe === "24h" ? "D" : "D";
    
    // Filter by timeframe
    const now = Date.now();
    const timeframeMs: Record<string, number> = {
      "1h": 60 * 60 * 1000,
      "6h": 6 * 60 * 60 * 1000,
      "24h": 24 * 60 * 60 * 1000,
      "all": Infinity,
    };
    
    const filteredTxs = transactions.filter(
      (tx) => now - tx.timestamp < timeframeMs[timeframe]
    );

    // Get bars from data feed
    const from = Math.floor((now - timeframeMs[timeframe]) / 1000);
    const to = Math.floor(now / 1000);
    
    dataFeed.getBars(
      { name: `${tokenSymbol}/SOL` } as any,
      resolution,
      { from, to, firstDataRequest: false },
      (bars, meta) => {
        if (bars.length > 0) {
          // Ensure all price values are valid numbers
          const formattedBars = bars
            .filter(bar => 
              bar.open > 0 && 
              bar.high > 0 && 
              bar.low > 0 && 
              bar.close > 0 &&
              !isNaN(bar.open) && 
              !isNaN(bar.high) && 
              !isNaN(bar.low) && 
              !isNaN(bar.close)
            )
            .map(bar => ({
              time: bar.time as Time,
              open: Number(bar.open.toFixed(10)),
              high: Number(bar.high.toFixed(10)),
              low: Number(bar.low.toFixed(10)),
              close: Number(bar.close.toFixed(10)),
            }));

          if (formattedBars.length > 0) {
            // Transform bars based on view mode
            const displayBars = viewMode === "marketCap" 
              ? formattedBars.map(bar => ({
                  time: bar.time,
                  open: bar.open * totalSupply * solPriceUSD,
                  high: bar.high * totalSupply * solPriceUSD,
                  low: bar.low * totalSupply * solPriceUSD,
                  close: bar.close * totalSupply * solPriceUSD,
                }))
              : formattedBars;
            
            candlestickSeriesRef.current!.setData(displayBars);
            
            // Format volume data
            const formattedVolume = bars
              .filter(bar => bar.time === formattedBars.find(b => b.time === bar.time)?.time)
              .map(bar => ({
                time: bar.time as Time,
                value: bar.volume || 0,
                color: bar.close >= bar.open ? "rgba(16, 185, 129, 0.5)" : "rgba(239, 68, 68, 0.5)",
              }));

            volumeSeriesRef.current!.setData(formattedVolume);
            
            // Auto-scale the price axis with proper formatting
            const values = displayBars.flatMap(bar => [bar.open, bar.high, bar.low, bar.close]);
            const minValue = Math.min(...values);
            const maxValue = Math.max(...values);
            
            if (lwChartRef.current && candlestickSeriesRef.current) {
              // Determine appropriate formatting based on value range
              let formatter: (price: number) => string;
              let minMove = 0.00000001;
              
              if (viewMode === "marketCap") {
                // Market cap formatting
                if (maxValue >= 1000000) {
                  formatter = (p: number) => {
                    if (p >= 1000000) return `$${(p / 1000000).toFixed(2)}M`;
                    if (p >= 1000) return `$${(p / 1000).toFixed(2)}K`;
                    return `$${p.toFixed(2)}`;
                  };
                  minMove = 1000; // Tick every $1K
                } else if (maxValue >= 1000) {
                  formatter = (p: number) => `$${p.toFixed(2)}`;
                  minMove = 10; // Tick every $10
                } else {
                  formatter = (p: number) => `$${p.toFixed(4)}`;
                  minMove = 0.01;
                }
              } else {
                // Price mode formatting
                if (maxValue >= 1) {
                  formatter = (p: number) => p.toFixed(4);
                  minMove = 0.0001; // Tick every 0.0001
                } else if (maxValue >= 0.01) {
                  formatter = (p: number) => p.toFixed(6);
                  minMove = 0.000001; // Tick every 0.000001
                } else if (maxValue >= 0.0001) {
                  formatter = (p: number) => p.toFixed(8);
                  minMove = 0.00000001; // Tick every 0.00000001
                } else {
                  formatter = (p: number) => {
                    // Use scientific notation for very small numbers
                    if (p < 0.000001) return p.toExponential(2);
                    return p.toFixed(10);
                  };
                  minMove = 0.0000000001;
                }
              }
              
              // Apply price scale options
              candlestickSeriesRef.current.priceScale().applyOptions({
                autoScale: true,
                entireTextOnly: true,
                ticksVisible: true,
                scaleMargins: {
                  top: 0.1,
                  bottom: 0.2,
                },
              });
              
              // Update price format with custom formatter
              candlestickSeriesRef.current.applyOptions({
                priceFormat: {
                  type: "custom",
                  formatter: formatter,
                  minMove: minMove,
                },
              });
              
              lwChartRef.current.timeScale().fitContent();
            }
          }
        } else if (currentPrice > 0) {
          // If no bars but we have current price, create a single point
          const now = Math.floor(Date.now() / 1000) as Time;
          const value = viewMode === "marketCap" 
            ? currentPrice * totalSupply * solPriceUSD
            : currentPrice;
          const displayValue = Number(value.toFixed(10));
          
          candlestickSeriesRef.current!.setData([{
            time: now,
            open: displayValue,
            high: displayValue,
            low: displayValue,
            close: displayValue,
          }]);
          
          if (candlestickSeriesRef.current) {
            // Set appropriate formatter for single point
            const value = viewMode === "marketCap" 
              ? currentPrice * totalSupply * solPriceUSD
              : currentPrice;
            
            let formatter: (price: number) => string;
            if (viewMode === "marketCap") {
              if (value >= 1000000) {
                formatter = (p: number) => `$${(p / 1000000).toFixed(2)}M`;
              } else if (value >= 1000) {
                formatter = (p: number) => `$${(p / 1000).toFixed(2)}K`;
              } else {
                formatter = (p: number) => `$${p.toFixed(2)}`;
              }
            } else {
              if (value >= 1) {
                formatter = (p: number) => p.toFixed(4);
              } else if (value >= 0.01) {
                formatter = (p: number) => p.toFixed(6);
              } else {
                formatter = (p: number) => p.toFixed(8);
              }
            }
            
            candlestickSeriesRef.current.applyOptions({
              priceFormat: {
                type: "custom",
                formatter: formatter,
              },
            });
            
            candlestickSeriesRef.current.priceScale().applyOptions({
              autoScale: true,
              entireTextOnly: true,
              ticksVisible: true,
            });
          }
        }
      },
      (error) => console.error("Error getting bars:", error)
    );
  }, [transactions, currentPrice, timeframe, tokenSymbol, viewMode, totalSupply, solPriceUSD]);

  const hasData = transactions.length > 0 || currentPrice > 0;

  return (
    <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold text-white">
            {viewMode === "price" ? "Price Chart" : "Market Cap Chart"}
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            {viewMode === "price" ? `${tokenSymbol} / SOL` : `${tokenSymbol} Market Cap (USD)`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex gap-1 bg-white/10 border border-white/20 rounded-lg p-1">
            <button
              onClick={() => setViewMode("price")}
              className={`px-3 py-1 text-xs font-medium rounded transition-all ${
                viewMode === "price"
                  ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              Price
            </button>
            <button
              onClick={() => setViewMode("marketCap")}
              className={`px-3 py-1 text-xs font-medium rounded transition-all ${
                viewMode === "marketCap"
                  ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              Market Cap
            </button>
          </div>

          {/* Timeframe Selector */}
          <div className="flex gap-2">
            {(["1h", "6h", "24h", "all"] as const).map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-3 py-1 text-xs font-medium rounded-lg transition-all ${
                  timeframe === tf
                    ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white"
                    : "bg-white/10 border border-white/20 text-slate-300 hover:bg-white/20"
                }`}
              >
                {tf === "all" ? "All" : tf}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Current Value Display */}
      {currentPrice > 0 && (
        <div className="mb-4 flex items-center gap-4">
          <div>
            <span className="text-xs text-slate-400">
              {viewMode === "price" ? "Current Price" : "Current Market Cap"}
            </span>
            <p className="text-xl font-bold text-white font-mono">
              {viewMode === "price" 
                ? `${currentPrice.toFixed(8)} SOL`
                : `$${currentMarketCapUSD.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
              }
            </p>
          </div>
          {transactions.length > 0 && (
            <div className="text-xs text-slate-400">
              {transactions.length} transaction{transactions.length !== 1 ? "s" : ""}
            </div>
          )}
        </div>
      )}

      {/* Chart Container */}
      <div className="relative bg-slate-900 rounded-lg overflow-hidden">
        <div
          id={`chart_${mintAddress.slice(0, 8)}`}
          ref={chartContainerRef}
          className="w-full"
          style={{ height: "500px" }}
        />
        {loading && !hasData && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900/90 rounded-lg pointer-events-none">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto mb-2"></div>
              <p className="text-slate-300">Loading chart data...</p>
            </div>
          </div>
        )}
        {!hasData && !loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900/90 rounded-lg pointer-events-none">
            <div className="text-center">
              <p className="text-slate-300 mb-2">No trading data yet</p>
              <p className="text-xs text-slate-400">
                Chart will appear once transactions occur
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="mt-4 p-3 bg-purple-500/10 border border-purple-500/30 rounded-xl">
        <p className="text-xs text-purple-200">
          📊 Live price data from Solana blockchain transactions for {tokenSymbol}
        </p>
      </div>
    </div>
  );
}
