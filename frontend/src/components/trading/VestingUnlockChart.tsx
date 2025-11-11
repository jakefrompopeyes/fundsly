"use client";

import { useEffect, useRef, useState } from "react";

interface VestingUnlockChartProps {
  totalAmount: number;
  startTime: number;
  cliffTime: number;
  endTime: number;
  releaseInterval: number;
  currentTime?: number;
  tokenSymbol?: string;
  height?: number;
}

export default function VestingUnlockChart({
  totalAmount,
  startTime,
  cliffTime,
  endTime,
  releaseInterval,
  currentTime = Math.floor(Date.now() / 1000),
  tokenSymbol = "tokens",
  height = 400,
}: VestingUnlockChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoveredPoint, setHoveredPoint] = useState<{
    date: Date;
    amount: number;
    x: number;
    y: number;
  } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const canvasHeight = rect.height / dpr;

    // Padding
    const padding = { top: 20, right: 60, bottom: 40, left: 60 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = canvasHeight - padding.top - padding.bottom;

    // Clear canvas
    ctx.clearRect(0, 0, width, canvasHeight);

    // Calculate data points
    const dataPoints: { time: number; unlocked: number }[] = [];
    const duration = endTime - startTime;
    const numPoints = Math.min(100, Math.ceil(duration / releaseInterval) + 1);
    const timeStep = duration / (numPoints - 1);

    for (let i = 0; i < numPoints; i++) {
      const time = startTime + i * timeStep;
      let unlocked = 0;

      if (time >= cliffTime) {
        if (time >= endTime) {
          unlocked = totalAmount;
        } else {
          const elapsed = time - startTime;
          unlocked = (totalAmount * elapsed) / duration;
        }
      }

      dataPoints.push({ time, unlocked });
    }

    // Calculate scales
    const timeScale = (time: number) =>
      padding.left + ((time - startTime) / duration) * chartWidth;
    
    const maxAmount = totalAmount * 1.1; // Add 10% padding to top
    const amountScale = (amount: number) =>
      canvasHeight - padding.bottom - (amount / maxAmount) * chartHeight;

    // Draw grid lines
    ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
    ctx.lineWidth = 1;
    const gridLines = 5;
    for (let i = 0; i <= gridLines; i++) {
      const y = padding.top + (chartHeight / gridLines) * i;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();

      // Draw y-axis labels
      const amount = maxAmount * (1 - i / gridLines);
      ctx.fillStyle = "rgba(148, 163, 184, 0.8)";
      ctx.font = "11px sans-serif";
      ctx.textAlign = "right";
      ctx.fillText(formatAmount(amount), padding.left - 10, y + 4);
    }

    // Draw x-axis time labels
    const numTimeLabels = 6;
    for (let i = 0; i <= numTimeLabels; i++) {
      const time = startTime + (duration / numTimeLabels) * i;
      const x = timeScale(time);
      const date = new Date(time * 1000);
      const label = date.toLocaleDateString("en-US", { 
        month: "short", 
        year: i === 0 || i === numTimeLabels ? "numeric" : undefined 
      });

      ctx.fillStyle = "rgba(148, 163, 184, 0.8)";
      ctx.font = "11px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(label, x, canvasHeight - padding.bottom + 20);
    }

    // Draw the area chart (gradient fill)
    const gradient = ctx.createLinearGradient(0, padding.top, 0, canvasHeight - padding.bottom);
    gradient.addColorStop(0, "rgba(139, 92, 246, 0.6)"); // Purple top
    gradient.addColorStop(1, "rgba(139, 92, 246, 0.1)"); // Purple bottom

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(timeScale(startTime), amountScale(0));

    dataPoints.forEach((point, i) => {
      const x = timeScale(point.time);
      const y = amountScale(point.unlocked);
      if (i === 0) {
        ctx.lineTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.lineTo(timeScale(endTime), amountScale(0));
    ctx.closePath();
    ctx.fill();

    // Draw the line on top
    ctx.strokeStyle = "rgba(139, 92, 246, 1)";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    dataPoints.forEach((point, i) => {
      const x = timeScale(point.time);
      const y = amountScale(point.unlocked);
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();

    // Draw cliff marker
    if (cliffTime > startTime) {
      const cliffX = timeScale(cliffTime);
      
      // Dashed line
      ctx.strokeStyle = "rgba(239, 68, 68, 0.6)";
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(cliffX, padding.top);
      ctx.lineTo(cliffX, canvasHeight - padding.bottom);
      ctx.stroke();
      ctx.setLineDash([]);

      // Cliff label
      ctx.fillStyle = "rgba(239, 68, 68, 1)";
      ctx.font = "bold 11px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Cliff", cliffX, padding.top - 5);
    }

    // Draw "Today" marker
    if (currentTime >= startTime && currentTime <= endTime) {
      const todayX = timeScale(currentTime);
      
      // Dashed line
      ctx.strokeStyle = "rgba(34, 197, 94, 0.8)";
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(todayX, padding.top);
      ctx.lineTo(todayX, canvasHeight - padding.bottom);
      ctx.stroke();
      ctx.setLineDash([]);

      // Today label
      ctx.fillStyle = "rgba(34, 197, 94, 1)";
      ctx.font = "bold 12px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Today", todayX, padding.top - 5);
    }

    // Draw axes
    ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    // Y-axis
    ctx.moveTo(padding.left, padding.top);
    ctx.lineTo(padding.left, canvasHeight - padding.bottom);
    // X-axis
    ctx.lineTo(width - padding.right, canvasHeight - padding.bottom);
    ctx.stroke();

  }, [totalAmount, startTime, cliffTime, endTime, releaseInterval, currentTime]);

  const formatAmount = (amount: number): string => {
    if (amount >= 1_000_000_000) {
      return `${(amount / 1_000_000_000).toFixed(2)}B`;
    } else if (amount >= 1_000_000) {
      return `${(amount / 1_000_000).toFixed(1)}M`;
    } else if (amount >= 1_000) {
      return `${(amount / 1_000).toFixed(1)}K`;
    }
    return amount.toFixed(0);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const padding = { top: 20, right: 60, bottom: 40, left: 60 };
    const chartWidth = rect.width - padding.left - padding.right;

    // Check if mouse is in chart area
    if (x < padding.left || x > rect.width - padding.right) {
      setHoveredPoint(null);
      return;
    }

    // Calculate time and amount at mouse position
    const duration = endTime - startTime;
    const relativeX = (x - padding.left) / chartWidth;
    const time = startTime + duration * relativeX;

    let unlocked = 0;
    if (time >= cliffTime) {
      if (time >= endTime) {
        unlocked = totalAmount;
      } else {
        const elapsed = time - startTime;
        unlocked = (totalAmount * elapsed) / duration;
      }
    }

    setHoveredPoint({
      date: new Date(time * 1000),
      amount: unlocked,
      x: e.clientX,
      y: e.clientY,
    });
  };

  const handleMouseLeave = () => {
    setHoveredPoint(null);
  };

  return (
    <div className="relative">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Unlock Schedule</h3>
        <div className="flex items-center gap-2 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-purple-500"></div>
            <span className="text-slate-300">Unlocked {tokenSymbol}</span>
          </div>
          {cliffTime > startTime && (
            <div className="flex items-center gap-1">
              <div className="w-3 h-1 bg-red-500"></div>
              <span className="text-slate-300">Cliff</span>
            </div>
          )}
          <div className="flex items-center gap-1">
            <div className="w-3 h-1 bg-green-500"></div>
            <span className="text-slate-300">Today</span>
          </div>
        </div>
      </div>

      <div className="relative rounded-lg bg-slate-900/50 p-4">
        <canvas
          ref={canvasRef}
          width={800}
          height={height}
          className="w-full cursor-crosshair"
          style={{ height: `${height}px` }}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        />

        {/* Tooltip */}
        {hoveredPoint && (
          <div
            className="fixed z-50 pointer-events-none"
            style={{
              left: hoveredPoint.x + 10,
              top: hoveredPoint.y - 60,
            }}
          >
            <div className="rounded-lg border border-purple-500/50 bg-slate-900/95 px-3 py-2 shadow-xl backdrop-blur-sm">
              <div className="text-xs font-semibold text-purple-300">
                {hoveredPoint.date.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </div>
              <div className="text-sm font-bold text-white">
                {formatAmount(hoveredPoint.amount)} {tokenSymbol}
              </div>
              <div className="text-xs text-slate-400">
                {((hoveredPoint.amount / totalAmount) * 100).toFixed(1)}% unlocked
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Summary Stats */}
      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <div className="rounded-md bg-slate-800/50 p-2">
          <div className="text-slate-400">Total Amount</div>
          <div className="font-semibold text-white">{formatAmount(totalAmount)}</div>
        </div>
        <div className="rounded-md bg-slate-800/50 p-2">
          <div className="text-slate-400">Cliff Period</div>
          <div className="font-semibold text-white">
            {Math.floor((cliffTime - startTime) / (24 * 60 * 60))} days
          </div>
        </div>
        <div className="rounded-md bg-slate-800/50 p-2">
          <div className="text-slate-400">Total Duration</div>
          <div className="font-semibold text-white">
            {Math.floor((endTime - startTime) / (30 * 24 * 60 * 60))} months
          </div>
        </div>
      </div>
    </div>
  );
}

