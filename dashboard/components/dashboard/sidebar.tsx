"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Kanban,
  Users,
  Settings,
  BarChart3,
  DollarSign,
  Mail,
  Send,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems: { name: string; href: string; icon: LucideIcon }[] = [
  { name: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { name: "Pipeline", href: "/dashboard/pipeline", icon: Kanban },
  { name: "Leads", href: "/dashboard/leads", icon: Users },
  { name: "Emails Found", href: "/dashboard/emails", icon: Mail },
  { name: "Outreach Sent", href: "/dashboard/outreach", icon: Send },
  { name: "Analytics", href: "/dashboard/analytics", icon: BarChart3 },
  { name: "Pricing", href: "/dashboard/pricing", icon: DollarSign },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="fixed left-0 top-0 z-50 flex h-screen w-16 flex-col items-center border-r border-border bg-sidebar py-4"
      role="navigation"
      aria-label="Main navigation"
    >
      {/* Logo */}
      <div className="mb-4 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">
        N
      </div>

      {/* Nav items */}
      <nav className="flex flex-1 flex-col gap-1">
        {navItems.map(({ name, href, icon: Icon }) => {
          const isActive =
            href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              title={name}
              aria-label={name}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "group relative flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors",
                isActive
                  ? "bg-sidebar-active text-sidebar-active-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-active/50",
              )}
            >
              <Icon className="size-5" aria-hidden />
              <span
                className="pointer-events-none absolute left-full z-50 ml-2 hidden whitespace-nowrap rounded-md border border-border bg-card px-2.5 py-1.5 text-sm font-medium text-card-foreground shadow-lg group-hover:block"
                role="tooltip"
              >
                {name}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Settings */}
      <Link
        href="/dashboard/settings"
        title="Settings"
        aria-label="Settings"
        className="group relative flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sidebar-foreground transition-colors hover:bg-sidebar-active/50"
      >
        <Settings className="size-5" aria-hidden />
        <span
          className="pointer-events-none absolute left-full z-50 ml-2 hidden whitespace-nowrap rounded-md border border-border bg-card px-2.5 py-1.5 text-sm font-medium text-card-foreground shadow-lg group-hover:block"
          role="tooltip"
        >
          Settings
        </span>
      </Link>
    </aside>
  );
}
