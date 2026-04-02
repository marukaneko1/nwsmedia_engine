"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const tabs = [
  { name: "Overview", href: "/dashboard/voice-agent" },
  { name: "Businesses", href: "/dashboard/voice-agent/businesses" },
  { name: "Assistants", href: "/dashboard/voice-agent/assistants" },
  { name: "Dialer", href: "/dashboard/voice-agent/dialer" },
  { name: "Calls", href: "/dashboard/voice-agent/calls" },
  { name: "Analytics", href: "/dashboard/voice-agent/analytics" },
  { name: "Settings", href: "/dashboard/voice-agent/settings" },
];

export default function VoiceAgentLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div>
      <nav className="border-b border-border px-6">
        <div className="flex gap-1 overflow-x-auto">
          {tabs.map((tab) => {
            const isActive = tab.href === "/dashboard/voice-agent"
              ? pathname === "/dashboard/voice-agent"
              : pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  "whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors",
                  isActive
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                {tab.name}
              </Link>
            );
          })}
        </div>
      </nav>
      <div className="p-6">{children}</div>
    </div>
  );
}
