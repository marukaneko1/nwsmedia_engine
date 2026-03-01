import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Turns a website string (e.g. "healingtooth.com") into an absolute URL so links open correctly. */
export function absoluteWebsiteUrl(website: string | null | undefined): string {
  if (!website?.trim()) return "#";
  const s = website.trim();
  if (/^https?:\/\//i.test(s)) return s;
  return `https://${s}`;
}

export function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatRelative(date: Date | string): string {
  const now = new Date();
  const d = new Date(date);
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(date);
}

export function tierColor(tier: string): string {
  switch (tier) {
    case "HOT": return "text-red-600 bg-red-50 border-red-200";
    case "WARM": return "text-orange-600 bg-orange-50 border-orange-200";
    case "COOL": return "text-blue-600 bg-blue-50 border-blue-200";
    case "COLD": return "text-slate-500 bg-slate-50 border-slate-200";
    default: return "text-slate-400 bg-slate-50 border-slate-200";
  }
}

export function segmentColor(segment: string): string {
  switch (segment) {
    case "ESTABLISHED": return "text-emerald-700 bg-emerald-50 border-emerald-200";
    case "NEW_SMALL": return "text-violet-700 bg-violet-50 border-violet-200";
    default: return "text-slate-500 bg-slate-50 border-slate-200";
  }
}

export function statusColor(status: string): string {
  switch (status) {
    case "lead": return "text-slate-600 bg-slate-50";
    case "contacted": return "text-blue-600 bg-blue-50";
    case "replied": return "text-cyan-600 bg-cyan-50";
    case "meeting": return "text-amber-600 bg-amber-50";
    case "proposal": return "text-purple-600 bg-purple-50";
    case "won": return "text-emerald-600 bg-emerald-50";
    case "lost": return "text-red-600 bg-red-50";
    default: return "text-slate-500 bg-slate-50";
  }
}

export function triageColor(status: string): string {
  switch (status) {
    case "HAS_WEBSITE": return "text-emerald-600 bg-emerald-50 border-emerald-200";
    case "NO_WEBSITE": return "text-red-600 bg-red-50 border-red-200";
    case "DEAD_WEBSITE": return "text-amber-600 bg-amber-50 border-amber-200";
    case "FREE_SUBDOMAIN": return "text-orange-600 bg-orange-50 border-orange-200";
    case "PAGE_BUILDER": return "text-violet-600 bg-violet-50 border-violet-200";
    default: return "text-slate-500 bg-slate-50 border-slate-200";
  }
}
