"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

/**
 * Plain-language overview:
 * This is a collapsible navigation bar on the left. It tucks away to give more space
 * when needed and highlights the active section so users know where they are.
 */
export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  const navItems = [
    { href: "/dashboard", label: "Overview" },
    { href: "/dashboard/create-startup", label: "Create Startup" },
    { href: "/dashboard/my-startups", label: "My Startups" },
    { href: "/dashboard/market", label: "Startup Market" },
    { href: "/dashboard/holdings", label: "Current Holdings" },
    { href: "/dashboard/support", label: "Support" },
  ];

  return (
    <aside
      className={`flex min-h-screen flex-col relative overflow-hidden border-r border-white/20 ${
        collapsed ? "w-20" : "w-72"
      } transition-all duration-300 ease-in-out`}
      style={{
        background: 'linear-gradient(180deg, rgba(139, 92, 246, 0.15) 0%, rgba(59, 130, 246, 0.08) 50%, rgba(16, 185, 129, 0.05) 100%)',
        backdropFilter: 'blur(24px) saturate(180%)',
        WebkitBackdropFilter: 'blur(24px) saturate(180%)',
        boxShadow: '0 20px 50px -12px rgba(0, 0, 0, 0.25)',
      }}
    >
      {/* Decorative gradient orb */}
      <div className="absolute -top-24 -right-24 w-64 h-64 bg-gradient-to-br from-purple-500/20 to-blue-500/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-gradient-to-tr from-emerald-500/15 to-cyan-500/15 rounded-full blur-3xl pointer-events-none" />
      
      {/* Content wrapper with relative positioning */}
      <div className="relative z-10 flex h-full flex-col">
        {/* Header section */}
        <div className="flex items-center justify-between px-4 py-5 border-b border-white/10">
          <Link href="/dashboard" className="group flex items-center gap-3 flex-1 min-w-0">
            <Image
              src="/Logo maker project(5).png"
              alt="Fundsly logo"
              width={160}
              height={48}
              className={`transition-all duration-300 group-hover:scale-105 ${
                collapsed ? "h-12 w-auto" : "h-12 w-auto"
              }`}
              priority
            />
          </Link>
          <button
            aria-label="Toggle sidebar"
            onClick={() => setCollapsed((v) => !v)}
            className="flex items-center justify-center w-8 h-8 rounded-2xl border border-white/20 bg-white/5 text-white/80 hover:bg-white/15 hover:border-white/30 transition-all duration-200 shadow-sm hover:shadow-md backdrop-blur-sm"
          >
            <svg 
              className={`w-4 h-4 transition-transform duration-300 ${collapsed ? 'rotate-180' : ''}`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex flex-col gap-1.5 px-3 py-4 pb-8 overflow-y-auto min-h-0 flex-1">
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group relative rounded-2xl px-4 py-3 text-sm font-medium transition-all duration-200 ${
                  active 
                    ? "bg-gradient-to-r from-purple-500/30 to-blue-500/30 text-white shadow-lg shadow-purple-500/20 border border-white/20" 
                    : "text-slate-200 hover:bg-white/10 hover:text-white hover:shadow-md border border-transparent"
                }`}
                title={collapsed ? item.label : undefined}
              >
                {/* Active indicator */}
                {active && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-gradient-to-b from-purple-400 to-blue-400 rounded-r-full" />
                )}
                <span className={`block ${collapsed ? 'text-center text-base' : ''}`}>
                  {collapsed ? item.label.split(' ').map(word => word.charAt(0)).join('') : item.label}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* Footer section */}
        <div className="px-4 pb-5 pt-3 border-t border-white/10">
          {!collapsed ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-transparent bg-clip-text bg-gradient-to-r from-purple-300 to-blue-300">
                Build. Fund. Launch.
              </p>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-purple-500/20 text-purple-200 border border-purple-400/30">
                  v0.1.0 beta
                </span>
              </div>
            </div>
          ) : (
            <div className="flex justify-center">
              <div className="w-2 h-2 rounded-full bg-purple-400/50 animate-pulse" />
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}


