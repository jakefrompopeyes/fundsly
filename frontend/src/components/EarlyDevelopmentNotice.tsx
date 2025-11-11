"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/**
 * Plain-language overview:
 * This component displays a prominent notice banner informing users that this is an early
 * development product. It only shows on first visit and can be dismissed. The dismissal
 * state is stored in localStorage so it won't show again after being dismissed.
 */
export function EarlyDevelopmentNotice() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check if user has already dismissed the notice
    const dismissed = localStorage.getItem("early-dev-notice-dismissed");
    if (!dismissed) {
      setIsVisible(true);
    }
  }, []);

  const handleDismiss = () => {
    localStorage.setItem("early-dev-notice-dismissed", "true");
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 p-4 animate-in slide-in-from-top duration-300">
      <div className="max-w-7xl mx-auto">
        <div className="bg-gradient-to-r from-amber-500/20 via-orange-500/20 to-red-500/20 backdrop-blur-lg rounded-xl p-4 border border-amber-400/30 shadow-lg">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 mt-0.5">
              <span className="text-2xl">⚠️</span>
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-white mb-1">
                Early Development Product
              </h3>
              <p className="text-sm text-amber-100/90">
                This is an early in development product. Features may be incomplete, and you may encounter bugs or unexpected behavior. Please use with caution.{" "}
                <Link href="/dashboard/support" className="underline hover:text-white transition-colors">
                  Report an issue
                </Link>
              </p>
            </div>
            <button
              onClick={handleDismiss}
              className="flex-shrink-0 text-amber-200 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10"
              aria-label="Dismiss notice"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

