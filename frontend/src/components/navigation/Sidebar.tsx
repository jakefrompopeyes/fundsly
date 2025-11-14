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
      className={`flex h-full flex-col border-r border-white/20 bg-white/10 backdrop-blur-xl shadow-[4px_0_24px_-2px_rgba(0,0,0,0.12),4px_0_16px_-4px_rgba(0,0,0,0.08)] ${
        collapsed ? "w-16" : "w-64"
      } transition-[width] duration-200`}
      style={{
        background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.05))',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
      }}
    >
      <div className="flex items-center justify-between px-3 py-3">
        <Link href="/dashboard" className="group flex items-center gap-3">
          <Image
            src="/Logo maker project(5).png"
            alt="Fundsly logo"
            width={160}
            height={48}
            className={`transition-transform group-hover:scale-[1.03] ${
              collapsed ? "h-14 w-auto" : "h-14 w-auto"
            }`}
            priority
          />
          {!collapsed && (
            <span className="text-[8px] font-semibold tracking-wide text-white align-bottom">
              
            </span>
          )}
        </Link>
        <button
          aria-label="Toggle sidebar"
          onClick={() => setCollapsed((v) => !v)}
          className="rounded-md border border-white/30 bg-white/10 px-2 py-1 text-xs text-slate-200 hover:bg-white/20 transition-all backdrop-blur-md shadow-sm"
        >
          {collapsed ? ">>" : "<<"}
        </button>
      </div>

      <nav className="mt-2 flex flex-1 flex-col gap-1 px-2">
        {navItems.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-lg px-3 py-2 text-sm transition-all ${
                active 
                  ? "glass-button glass-button-primary text-white" 
                  : "text-slate-300 hover:bg-white/10 hover:text-white"
              }`}
            >
              {collapsed ? item.label.charAt(0) : item.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 pb-4 pt-2 text-[10px] text-purple-300/70">
        {!collapsed && <p>Build. Fund. Launch.     v0.1.0 beta</p>}
      </div>
    </aside>
  );
}


