import { Header } from "@/components/dashboard/header";
import { ClientPriceCalculator } from "@/components/dashboard/client-price-calculator";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function PricingPage() {
  return (
    <>
      <Header title="Pricing Reference" />
      <main className="p-6 max-w-[1400px] space-y-8">

        {/* Client Price Calculator */}
        <ClientPriceCalculator />

        {/* Your Pricing — hero section */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Your Pricing</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <PriceCard
              label="Floor"
              subtitle="Simple 5-page brochure, SEO, mobile-friendly"
              min={3500} max={4000}
              note="Keeps you out of race-to-the-bottom"
              accent="border-l-amber-500"
            />
            <PriceCard
              label="Target"
              subtitle="8–12 pages, local SEO built in"
              min={5500} max={8000}
              note="Audit data as proof and positioning"
              accent="border-l-emerald-500"
              highlight
            />
            <PriceCard
              label="High End"
              subtitle="Booking forms, multi-location, integrations"
              min={9000} max={12000}
              note="More hand-holding"
              accent="border-l-blue-500"
            />
            <PriceCard
              label="Ongoing"
              subtitle="Hosting, updates, backups, small edits"
              min={50} max={150}
              note="per month"
              accent="border-l-violet-500"
              monthly
            />
          </div>
        </div>

        {/* Page Count Pricing */}
        <Card>
          <CardHeader>
            <CardTitle>By Page Count</CardTitle>
            <CardDescription>Scale pricing based on project scope</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[140px]">Pages</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Min</TableHead>
                  <TableHead className="text-right">Max</TableHead>
                  <TableHead>Note</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageCountData.map((r) => (
                  <TableRow key={r.pages}>
                    <TableCell className="font-semibold">{r.pages}</TableCell>
                    <TableCell className="text-sm">{r.description}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{fmt(r.min)}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{fmt(r.max)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.note}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Add-ons */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Add-ons &amp; Extras</h2>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Design</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {designAddons.map((r) => (
                      <TableRow key={r.item}>
                        <TableCell className="font-medium text-sm">{r.item}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{r.description}</TableCell>
                        <TableCell className="text-right font-mono text-sm whitespace-nowrap">{fmt(r.min)}–{fmt(r.max)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Functionality</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {functionalityAddons.map((r) => (
                      <TableRow key={r.item}>
                        <TableCell className="font-medium text-sm">{r.item}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{r.description}</TableCell>
                        <TableCell className="text-right font-mono text-sm whitespace-nowrap">{fmt(r.min)}–{fmt(r.max)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Industry Pricing Comparison */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Industry Pricing (Comparison)</h2>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>By Tier</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {industryTiers.map((r) => (
                  <div key={r.tier} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{r.tier}</p>
                      <p className="text-xs text-muted-foreground">{r.description}</p>
                    </div>
                    <div className="text-right">
                      <span className="font-mono text-sm">{fmt(r.min)}–{fmt(r.max)}</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>By Vertical</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {industryVerticals.map((r) => (
                  <div key={r.vertical} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{r.vertical}</p>
                      <p className="text-xs text-muted-foreground">{r.note}</p>
                    </div>
                    <div className="text-right">
                      <span className="font-mono text-sm">{fmt(r.min)}–{fmt(r.max)}</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Your Moat */}
        <Card>
          <CardHeader>
            <CardTitle>Your Moat — Why Clients Choose You</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              {moatItems.map((m) => (
                <div key={m.advantage} className="flex gap-3 rounded-lg border border-border p-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary text-xs font-bold">
                    {m.advantage.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{m.advantage}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{m.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* One-line Pitches */}
        <Card>
          <CardHeader>
            <CardTitle>One-line Pitches</CardTitle>
            <CardDescription>Quick openers for calls, emails, and conversations</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {pitches.map((p, i) => (
              <div key={i} className="rounded-lg border border-border p-3">
                <p className="text-sm italic text-foreground">&ldquo;{p}&rdquo;</p>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* ROI Quick Ref */}
        <Card>
          <CardHeader>
            <CardTitle>ROI Quick Reference</CardTitle>
            <CardDescription>Use these numbers on discovery calls</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vertical</TableHead>
                  <TableHead className="text-right">Avg Job Value</TableHead>
                  <TableHead className="text-right">Leads/mo from site</TableHead>
                  <TableHead className="text-right">Monthly Revenue</TableHead>
                  <TableHead className="text-right">Break-even</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-medium">Contractors (HVAC, plumbing)</TableCell>
                  <TableCell className="text-right font-mono">$2,000</TableCell>
                  <TableCell className="text-right">3–5</TableCell>
                  <TableCell className="text-right font-mono text-emerald-600">$6,000–$10,000</TableCell>
                  <TableCell className="text-right">1 month</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Dentists</TableCell>
                  <TableCell className="text-right font-mono">$5,000 LTV</TableCell>
                  <TableCell className="text-right">5–10</TableCell>
                  <TableCell className="text-right font-mono text-emerald-600">$25,000–$50,000</TableCell>
                  <TableCell className="text-right">&lt;1 month</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Med Spas</TableCell>
                  <TableCell className="text-right font-mono">$500–$2,000</TableCell>
                  <TableCell className="text-right">8–15</TableCell>
                  <TableCell className="text-right font-mono text-emerald-600">$4,000–$30,000</TableCell>
                  <TableCell className="text-right">1–2 months</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>

      </main>
    </>
  );
}

function fmt(n: number) {
  return n >= 1000 ? `$${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k` : `$${n}`;
}

function PriceCard({ label, subtitle, min, max, note, accent, highlight, monthly }: {
  label: string; subtitle: string; min: number; max: number; note: string; accent: string; highlight?: boolean; monthly?: boolean;
}) {
  return (
    <Card className={`border-l-4 ${accent} ${highlight ? "ring-1 ring-emerald-200" : ""}`}>
      <CardContent className="p-5">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
          {highlight && <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">recommended</Badge>}
        </div>
        <p className="text-2xl font-semibold">
          {fmt(min)}–{fmt(max)}
          {monthly && <span className="text-sm font-normal text-muted-foreground">/mo</span>}
        </p>
        <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
        <p className="text-xs text-muted-foreground mt-2 italic">{note}</p>
      </CardContent>
    </Card>
  );
}

const pageCountData = [
  { pages: "5 pages", description: "Basic brochure (Home, Services, About, Contact, CTA)", min: 3500, max: 4500, note: "Floor package" },
  { pages: "6–8 pages", description: "Add Team, Testimonials, FAQ, or 1–2 service pages", min: 4500, max: 6000, note: "" },
  { pages: "9–12 pages", description: "Full service lineup, locations, blog stub", min: 5500, max: 8000, note: "Target package" },
  { pages: "13–18 pages", description: "Extended services, multiple locations, case studies", min: 7500, max: 10000, note: "" },
  { pages: "19–25 pages", description: "Large site, many services, locations, resources", min: 9500, max: 14000, note: "" },
  { pages: "25+ pages", description: "Enterprise-style, many sections, sub-pages", min: 12000, max: 20000, note: "Quote per scope" },
];

const designAddons = [
  { item: "Micro animations", description: "Button hover, link hover, subtle transitions", min: 300, max: 600 },
  { item: "Scroll animations", description: "Scroll-triggered reveals, fade-in on scroll", min: 500, max: 1200 },
  { item: "Full page animations", description: "Parallax, scroll-triggered sections, multiple motion", min: 800, max: 2000 },
  { item: "Apple effect", description: "Premium minimal, high whitespace, subtle motion, typography-first", min: 1000, max: 2500 },
  { item: "Intro animation", description: "Hero load-in, logo reveal, first-screen animation", min: 400, max: 900 },
  { item: "Video background", description: "Hero or section background video (muted loop)", min: 500, max: 1500 },
  { item: "Custom illustrations", description: "Icons, illustrations, mascot", min: 600, max: 2000 },
  { item: "Premium photography", description: "Stock upgrade or custom shoot", min: 400, max: 1500 },
];

const functionalityAddons = [
  { item: "Booking integration", description: "Calendly, Acuity, or custom booking", min: 400, max: 1200 },
  { item: "Advanced contact forms", description: "Multi-step, conditional fields, file upload", min: 200, max: 600 },
  { item: "Multi-location", description: "Location pages, schema per location", min: 800, max: 2000 },
  { item: "Blog setup", description: "5–10 posts, CMS ready", min: 500, max: 1000 },
  { item: "Testimonials widget", description: "Auto-pull Google reviews, display", min: 300, max: 600 },
  { item: "Online payment", description: "Stripe or similar for deposits", min: 600, max: 1500 },
];

const industryTiers = [
  { tier: "DIY / Template", description: "Wix, Squarespace, Fiverr", min: 0, max: 2000 },
  { tier: "Freelancer", description: "Solo designer/dev, 5–10 pages", min: 3000, max: 8000 },
  { tier: "Boutique agency", description: "1–5 person shop (your competitor set)", min: 5000, max: 15000 },
  { tier: "Full-service agency", description: "10+ people, enterprise", min: 15000, max: 50000 },
];

const industryVerticals = [
  { vertical: "Contractors (HVAC, plumbing)", note: "$6k–$8k common for strong local", min: 3000, max: 12000 },
  { vertical: "Dentists", note: "ADA cites ~$10k–$12k", min: 6000, max: 25000 },
  { vertical: "Med spas / healthcare", note: "$2.5k–$5k typical sweet spot", min: 2500, max: 10000 },
];

const moatItems = [
  { advantage: "Audit-first selling", description: "Pre-audit PageSpeed, SEO, SSL before call. Show specific issues; 78% complaints are service, not tech." },
  { advantage: "Vertical specialization", description: "Contractors, dentists, med spas in Houston, Dallas, Austin. 2x growth, 61%+ gross vs generalists." },
  { advantage: "Lead engine", description: "Pre-qualified pipeline — only talk to repliers. Triage, audit, enrichment data before call." },
  { advantage: "Built to rank", description: "Local SEO from day one. 19.9x ROAS SEO vs 4.4x ads; $126 vs $553 cost per customer." },
  { advantage: "Performance focus", description: "PageSpeed, Core Web Vitals. 1s delay = ~7% conversion loss; 53% abandon after 3s." },
  { advantage: "Boutique positioning", description: "Direct contact, no disappearing vs freelancer; no overhead vs big agency." },
  { advantage: "Thumbtack alternative", description: "Site = no per-lead fee. $6k site at $100/lead = 60 leads to break even." },
  { advantage: "ROI by vertical", description: "Contractors $2k job × 3 leads = $6k/mo; Dentists $5k LTV; Med spa $500–$2k procedure." },
  { advantage: "Niche market focus", description: "Large metros, name competitors in city." },
  { advantage: "Segment-aware messaging", description: "ESTABLISHED vs NEW_SMALL — different angles for different businesses." },
];

const pitches = [
  "We build websites that rank. I've already audited yours — I can show you exactly where you're losing customers.",
  "Contractors in Houston are paying $50–200 per Thumbtack lead. A site that ranks brings leads without per-lead fees.",
  "We only work with contractors / dentists / med spas in markets like yours. I know what works.",
  "Your reviews are solid — the site isn't. I'll show you the data, then we build something that matches your reputation.",
];
