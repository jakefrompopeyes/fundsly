"use client";

import { useEffect, useRef, useState } from "react";
import { useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { deriveBondingCurvePda } from "@/lib/anchorClient";

interface TradingViewPriceChartProps {
  mintAddress: string;
  currentPrice: number;
  poolState?: {
    solReserves: number;
    tokenReserves: number;
  };
  totalSupply?: number; // Total token supply for accurate market cap
}

interface PricePoint {
  time: number;
  value: number;
}

export default function TradingViewPriceChart({
  mintAddress,
  currentPrice,
  poolState,
  totalSupply,
}: TradingViewPriceChartProps) {
  const { connection } = useConnection();
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chart = useRef<any>(null);
  const series = useRef<any>(null);
  const [priceData, setPriceData] = useState<PricePoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currency, setCurrency] = useState<"SOL" | "USD">("SOL");
  const [solPrice, setSolPrice] = useState<number>(0);

  // Fetch SOL price in USD
  useEffect(() => {
    const fetchSolPrice = async () => {
      try {
        const response = await fetch(
          "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd"
        );
        const data = await response.json();
        if (data?.solana?.usd) {
          setSolPrice(data.solana.usd);
        }
      } catch (error) {
        console.error("Error fetching SOL price:", error);
        setSolPrice(100);
      }
    };

    fetchSolPrice();
    const interval = setInterval(fetchSolPrice, 60000);
    return () => clearInterval(interval);
  }, []);

  // Initialize chart
  useEffect(() => {
    let cleanup: (() => void) | undefined;
    let mounted = true;

    // Safety timeout - force loading to false after 3 seconds
    const safetyTimeout = setTimeout(() => {
      if (mounted) {
        console.warn("Chart initialization timeout - forcing loading state to false");
        setIsLoading(false);
      }
    }, 3000);

    const initChart = async () => {
      try {
        // Wait a tick for the ref to be ready
        await new Promise(resolve => setTimeout(resolve, 100));
        
        if (!mounted || !chartContainerRef.current) {
          if (mounted) setIsLoading(false);
          clearTimeout(safetyTimeout);
          return;
        }

        const { createChart, ColorType } = await import("lightweight-charts");

        if (!mounted || !chartContainerRef.current) {
          if (mounted) setIsLoading(false);
          clearTimeout(safetyTimeout);
          return;
        }

        const isDark = document.documentElement.classList.contains("dark");
        const container = chartContainerRef.current;

        const chartInstance = createChart(container, {
          layout: {
            background: { type: ColorType.Solid, color: "transparent" },
            textColor: "#94A3B8",
          },
          grid: {
            vertLines: { color: "rgba(148, 163, 184, 0.1)" },
            horzLines: { color: "rgba(148, 163, 184, 0.1)" },
          },
          width: container.clientWidth,
          height: 400,
          rightPriceScale: {
            borderColor: "rgba(255, 255, 255, 0.1)",
            scaleMargins: {
              top: 0.1,
              bottom: 0.1,
            },
            mode: 0, // Normal mode
          },
          timeScale: {
            borderColor: "rgba(255, 255, 255, 0.1)",
            timeVisible: true,
            secondsVisible: false,
          },
          handleScale: {
            axisPressedMouseMove: {
              time: true,
              price: true,
            },
          },
        });

        chart.current = chartInstance;

        const areaSeries = chartInstance.addAreaSeries({
          lineColor: "#A855F7",
          topColor: "rgba(168, 85, 247, 0.3)",
          bottomColor: "rgba(168, 85, 247, 0.0)",
          lineWidth: 2,
          priceFormat: {
            type: 'custom',
            formatter: (price: number) => {
              if (price === 0) return '0';
              if (price < 0.000001) return price.toExponential(2);
              if (price < 0.01) return price.toFixed(8);
              if (price < 1) return price.toFixed(6);
              return price.toFixed(4);
            },
          },
        });

        series.current = areaSeries;

        // Handle resize
        const handleResize = () => {
          if (chartContainerRef.current && chart.current) {
            chart.current.applyOptions({
              width: chartContainerRef.current.clientWidth,
            });
          }
        };

        window.addEventListener("resize", handleResize);

        cleanup = () => {
          window.removeEventListener("resize", handleResize);
          if (chart.current) {
            chart.current.remove();
            chart.current = null;
          }
        };

        if (mounted) {
          clearTimeout(safetyTimeout);
          setIsLoading(false);
        }
      } catch (error) {
        console.error("Error initializing chart:", error);
        clearTimeout(safetyTimeout);
        if (mounted) setIsLoading(false);
      }
    };

    initChart();

    return () => {
      mounted = false;
      clearTimeout(safetyTimeout);
      if (cleanup) cleanup();
    };
  }, []);

  // Fetch transaction data
  useEffect(() => {
    let isMounted = true;

    const fetchTransactionPrices = async () => {
      try {
        const mint = new PublicKey(mintAddress);
        const bondingCurvePda = await deriveBondingCurvePda(mint);

        const signatures = await connection.getSignaturesForAddress(
          bondingCurvePda,
          { limit: 50 }
        );

        const prices: PricePoint[] = [];
        const batchSize = 10;

        for (let i = 0; i < signatures.length; i += batchSize) {
          if (!isMounted) break;

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
            if (!tx || !tx.meta || !sig.blockTime) continue;

            const preTokenBalances = tx.meta.preTokenBalances || [];
            const postTokenBalances = tx.meta.postTokenBalances || [];
            const preBalances = tx.meta.preBalances || [];
            const postBalances = tx.meta.postBalances || [];

            let solDiff = 0;
            for (let k = 0; k < Math.min(preBalances.length, postBalances.length); k++) {
              const diff = Math.abs(postBalances[k] - preBalances[k]) / 1_000_000_000;
              if (diff > solDiff && diff < 100) {
                solDiff = diff;
              }
            }

            let tokenDiff = 0;
            for (const postBalance of postTokenBalances) {
              const preBalance = preTokenBalances.find(
                (b) => b.accountIndex === postBalance.accountIndex
              );

              if (preBalance) {
                const preAmount = parseFloat(preBalance.uiTokenAmount.uiAmountString || "0");
                const postAmount = parseFloat(postBalance.uiTokenAmount.uiAmountString || "0");
                const diff = Math.abs(postAmount - preAmount);
                if (diff > tokenDiff) tokenDiff = diff;
              } else if (postBalance.uiTokenAmount.uiAmountString) {
                const amount = parseFloat(postBalance.uiTokenAmount.uiAmountString);
                if (amount > tokenDiff) tokenDiff = amount;
              }
            }

            if (tokenDiff > 0 && solDiff > 0) {
              const price = solDiff / tokenDiff;
              prices.push({ time: sig.blockTime, value: price });
            }
          }

          if (i + batchSize < signatures.length) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }

        prices.sort((a, b) => a.time - b.time);

        if (currentPrice > 0) {
          const now = Math.floor(Date.now() / 1000);
          prices.push({ time: now, value: currentPrice });
        }

        if (isMounted && prices.length > 0) {
          setPriceData(prices);
        }
      } catch (error) {
        console.error("Error fetching transaction prices:", error);
        
        if (currentPrice > 0 && isMounted) {
          const now = Math.floor(Date.now() / 1000);
          setPriceData([{ time: now, value: currentPrice }]);
        }
      }
    };

    if (mintAddress && connection && currentPrice > 0) {
      fetchTransactionPrices();

      const interval = setInterval(() => {
        if (isMounted) fetchTransactionPrices();
      }, 30000);

      return () => {
        isMounted = false;
        clearInterval(interval);
      };
    }
  }, [mintAddress, connection, currentPrice]);

  // Update chart data when price data or currency changes
  useEffect(() => {
    if (!series.current) {
      console.log("Chart series not ready yet");
      return;
    }
    
    // If we have no price data but have a current price, show at least that
    let dataToShow = priceData;
    if (priceData.length === 0 && currentPrice > 0) {
      const now = Math.floor(Date.now() / 1000);
      dataToShow = [
        { time: now - 3600, value: currentPrice }, // 1 hour ago
        { time: now, value: currentPrice }
      ];
      console.log("No historical data, showing current price:", dataToShow);
    }
    
    if (dataToShow.length === 0) {
      console.log("No data to display on chart");
      return;
    }

    // Use a safe solPrice value (default to 100 if not loaded for USD display)
    const safeSolPrice = solPrice > 0 ? solPrice : 100;
    const displayData = dataToShow.map(p => ({
      time: p.time,
      value: currency === "USD" ? p.value * safeSolPrice : p.value,
    }));

    console.log("Setting chart data:", displayData);
    series.current.setData(displayData);
    chart.current?.timeScale().fitContent();
  }, [priceData, currency, solPrice, currentPrice]);

  // Format price with proper decimals
  const formatPrice = (price: number) => {
    if (price === 0) return currency === "USD" ? "$0.00" : "0 SOL";
    
    const safeSolPrice = solPrice > 0 ? solPrice : 100;
    const displayPrice = currency === "USD" ? price * safeSolPrice : price;
    const symbol = currency === "USD" ? "$" : "";
    const suffix = currency === "SOL" ? " SOL" : "";

    if (currency === "USD") {
      if (displayPrice < 0.000001) return `${symbol}${displayPrice.toFixed(10)}`;
      if (displayPrice < 0.01) return `${symbol}${displayPrice.toFixed(8)}`;
      if (displayPrice < 1) return `${symbol}${displayPrice.toFixed(6)}`;
      return `${symbol}${displayPrice.toFixed(4)}`;
    } else {
      if (displayPrice < 0.000001) return `${displayPrice.toFixed(10)}${suffix}`;
      if (displayPrice < 0.01) return `${displayPrice.toFixed(8)}${suffix}`;
      return `${displayPrice.toFixed(6)}${suffix}`;
    }
  };

  // Format market cap using total supply (not reserves)
  const formatMarketCap = (price: number) => {
    if (!totalSupply || totalSupply === 0) {
      console.log("Market cap N/A - totalSupply:", totalSupply);
      return "N/A";
    }
    
    // Market cap = Total Supply × Current Price
    const marketCapSOL = price * totalSupply;
    const safeSolPrice = solPrice > 0 ? solPrice : 100;
    const marketCap = currency === "USD" ? marketCapSOL * safeSolPrice : marketCapSOL;
    const symbol = currency === "USD" ? "$" : "";
    const suffix = currency === "SOL" ? " SOL" : "";

    console.log("Market cap calculation:", { price, totalSupply, marketCapSOL, safeSolPrice, marketCap, currency });

    if (marketCap < 0.01) return `${symbol}${marketCap.toFixed(10)}${suffix}`;
    if (marketCap < 1000) return `${symbol}${marketCap.toFixed(2)}${suffix}`;
    if (marketCap < 1000000) return `${symbol}${(marketCap / 1000).toFixed(2)}K${suffix}`;
    if (marketCap < 1000000000) return `${symbol}${(marketCap / 1000000).toFixed(2)}M${suffix}`;
    return `${symbol}${(marketCap / 1000000000).toFixed(2)}B${suffix}`;
  };

  if (isLoading) {
    return (
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 p-6">
        <div className="flex items-center justify-center h-[400px]">
          <p className="text-slate-300">Loading chart...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 overflow-hidden">
      {/* Header - Clean and Minimal */}
      <div className="p-4 border-b border-white/20">
        <div className="flex items-center justify-between">
          <div className="flex items-baseline gap-3">
            <span className="text-2xl font-bold text-white font-mono">
              {formatPrice(currentPrice)}
            </span>
            {totalSupply && (
              <span className="text-sm text-slate-300">
                MCap: {formatMarketCap(currentPrice)}
              </span>
            )}
          </div>

          {/* Currency Toggle */}
          <button
            onClick={() => setCurrency(curr => curr === "SOL" ? "USD" : "SOL")}
            className="px-3 py-1.5 text-sm font-medium rounded-lg bg-white/10 border border-white/20 text-slate-300 hover:bg-white/20 transition-colors"
          >
            Switch to {currency === "SOL" ? "USD" : "SOL"}
          </button>
        </div>
      </div>

      {/* Chart Container - Full Width */}
      <div 
        ref={chartContainerRef} 
        className="w-full bg-slate-900/50" 
        style={{ minHeight: "400px" }}
      />

      {/* Debug Info */}
      {!chart.current && (
        <div className="p-3 bg-yellow-500/10 border-t border-yellow-500/30">
          <p className="text-xs text-yellow-200 text-center">
            ⚠️ Chart instance not created - Check console for errors
          </p>
        </div>
      )}

      {/* Footer Info */}
      <div className="p-3 bg-slate-800/50 border-t border-white/10">
        <p className="text-xs text-slate-400 text-center">
          {priceData.length > 0 ? (
            `${priceData.length} historical price points • Updates every 30s`
          ) : currentPrice > 0 ? (
            "Showing current price • Historical data will appear after trades"
          ) : (
            "Waiting for price data..."
          )}
        </p>
      </div>
    </div>
  );
}

