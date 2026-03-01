"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calculator, RotateCcw } from "lucide-react";

const PAGE_COUNT_OPTIONS = [
  { id: "5", label: "5 pages", min: 3500, max: 4500 },
  { id: "6-8", label: "6–8 pages", min: 4500, max: 6000 },
  { id: "9-12", label: "9–12 pages", min: 5500, max: 8000 },
  { id: "13-18", label: "13–18 pages", min: 7500, max: 10000 },
  { id: "19-25", label: "19–25 pages", min: 9500, max: 14000 },
  { id: "25+", label: "25+ pages", min: 12000, max: 20000 },
];

const BASE_TIERS = [
  { id: "floor", label: "Floor", min: 3500, max: 4000 },
  { id: "target", label: "Target", min: 5500, max: 8000 },
  { id: "high", label: "High End", min: 9000, max: 12000 },
];

const DESIGN_ADDONS = [
  { id: "micro-anim", item: "Micro animations", min: 300, max: 600 },
  { id: "scroll-anim", item: "Scroll animations", min: 500, max: 1200 },
  { id: "full-anim", item: "Full page animations", min: 800, max: 2000 },
  { id: "apple", item: "Apple effect", min: 1000, max: 2500 },
  { id: "intro-anim", item: "Intro animation", min: 400, max: 900 },
  { id: "video-bg", item: "Video background", min: 500, max: 1500 },
  { id: "illustrations", item: "Custom illustrations", min: 600, max: 2000 },
  { id: "photography", item: "Premium photography", min: 400, max: 1500 },
];

const FUNCTIONALITY_ADDONS = [
  { id: "booking", item: "Booking integration", min: 400, max: 1200 },
  { id: "forms", item: "Advanced contact forms", min: 200, max: 600 },
  { id: "multi-loc", item: "Multi-location", min: 800, max: 2000 },
  { id: "blog", item: "Blog setup", min: 500, max: 1000 },
  { id: "testimonials", item: "Testimonials widget", min: 300, max: 600 },
  { id: "payment", item: "Online payment", min: 600, max: 1500 },
];

function fmt(n: number) {
  return n >= 1000 ? `$${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k` : `$${n}`;
}

function fmtFull(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

export function ClientPriceCalculator() {
  const [baseType, setBaseType] = useState<"floor" | "target" | "high" | "pages" | "custom">("pages");
  const [pageCountId, setPageCountId] = useState("9-12");
  const [customMin, setCustomMin] = useState(6000);
  const [customMax, setCustomMax] = useState(8000);
  const [designSelected, setDesignSelected] = useState<Set<string>>(new Set());
  const [functionalitySelected, setFunctionalitySelected] = useState<Set<string>>(new Set());
  const [includeOngoing, setIncludeOngoing] = useState(false);
  const [ongoingMin, setOngoingMin] = useState(50);
  const [ongoingMax, setOngoingMax] = useState(150);

  const { oneTimeMin, oneTimeMax, recommended, monthlyMin, monthlyMax } = useMemo(() => {
    let baseMin = 0, baseMax = 0;
    if (baseType === "custom") {
      baseMin = customMin;
      baseMax = customMax;
    } else if (baseType === "pages") {
      const opt = PAGE_COUNT_OPTIONS.find((o) => o.id === pageCountId) ?? PAGE_COUNT_OPTIONS[2];
      baseMin = opt.min;
      baseMax = opt.max;
    } else {
      const tier = BASE_TIERS.find((t) => t.id === baseType) ?? BASE_TIERS[1];
      baseMin = tier.min;
      baseMax = tier.max;
    }

    let addonMin = 0, addonMax = 0;
    designSelected.forEach((id) => {
      const a = DESIGN_ADDONS.find((x) => x.id === id);
      if (a) {
        addonMin += a.min;
        addonMax += a.max;
      }
    });
    functionalitySelected.forEach((id) => {
      const a = FUNCTIONALITY_ADDONS.find((x) => x.id === id);
      if (a) {
        addonMin += a.min;
        addonMax += a.max;
      }
    });

    const oneTimeMin = baseMin + addonMin;
    const oneTimeMax = baseMax + addonMax;
    const recommended = Math.round((oneTimeMin + oneTimeMax) / 2);

    return {
      oneTimeMin,
      oneTimeMax,
      recommended,
      monthlyMin: includeOngoing ? ongoingMin : 0,
      monthlyMax: includeOngoing ? ongoingMax : 0,
    };
  }, [
    baseType,
    pageCountId,
    customMin,
    customMax,
    designSelected,
    functionalitySelected,
    includeOngoing,
    ongoingMin,
    ongoingMax,
  ]);

  const toggleDesign = (id: string) => {
    setDesignSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleFunctionality = (id: string) => {
    setFunctionalitySelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const reset = () => {
    setBaseType("pages");
    setPageCountId("9-12");
    setCustomMin(6000);
    setCustomMax(8000);
    setDesignSelected(new Set());
    setFunctionalitySelected(new Set());
    setIncludeOngoing(false);
    setOngoingMin(50);
    setOngoingMax(150);
  };

  return (
    <Card className="border-2 border-primary/20 bg-gradient-to-br from-background to-muted/30">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-primary" />
            <CardTitle>Client Price Calculator</CardTitle>
          </div>
          <Button variant="ghost" size="sm" onClick={reset} className="text-muted-foreground">
            <RotateCcw className="h-4 w-4 mr-1" />
            Reset
          </Button>
        </div>
        <CardDescription>
          Enter what the client wants — pages, base package, add-ons, and optional ongoing — to get a one-time and monthly price range.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Pages — always visible, used when base is "pages" */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Pages</label>
          <select
            className="h-9 rounded-lg border border-input bg-background px-3 text-sm w-full max-w-xs"
            value={pageCountId}
            onChange={(e) => setPageCountId(e.target.value)}
          >
            {PAGE_COUNT_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label} — {fmt(o.min)}–{fmt(o.max)}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            {baseType === "pages"
              ? "Base price is set from this page count."
              : "Select “By page count” below to use this in the calculation."}
          </p>
        </div>

        {/* Base package */}
        <div className="space-y-3">
          <label className="text-sm font-medium">Base price from</label>
          <div className="flex flex-wrap gap-2">
            {(["floor", "target", "high", "pages", "custom"] as const).map((t) => (
              <Button
                key={t}
                variant={baseType === t ? "default" : "secondary"}
                size="sm"
                onClick={() => setBaseType(t)}
              >
                {t === "floor" && "Floor"}
                {t === "target" && "Target"}
                {t === "high" && "High End"}
                {t === "pages" && "By page count"}
                {t === "custom" && "Custom"}
              </Button>
            ))}
          </div>
          {baseType === "custom" && (
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">Min</span>
                <Input
                  type="number"
                  min={0}
                  step={500}
                  value={customMin}
                  onChange={(e) => setCustomMin(Number(e.target.value) || 0)}
                  className="w-28"
                />
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">Max</span>
                <Input
                  type="number"
                  min={0}
                  step={500}
                  value={customMax}
                  onChange={(e) => setCustomMax(Number(e.target.value) || 0)}
                  className="w-28"
                />
              </div>
            </div>
          )}
        </div>

        {/* Design add-ons */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Design add-ons</label>
          <div className="flex flex-wrap gap-2">
            {DESIGN_ADDONS.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => toggleDesign(a.id)}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                  designSelected.has(a.id)
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-muted/50 text-muted-foreground hover:bg-muted"
                }`}
              >
                {a.item}
                <span className="text-[10px] opacity-80">{fmt(a.min)}–{fmt(a.max)}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Functionality add-ons */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Functionality add-ons</label>
          <div className="flex flex-wrap gap-2">
            {FUNCTIONALITY_ADDONS.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => toggleFunctionality(a.id)}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                  functionalitySelected.has(a.id)
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-muted/50 text-muted-foreground hover:bg-muted"
                }`}
              >
                {a.item}
                <span className="text-[10px] opacity-80">{fmt(a.min)}–{fmt(a.max)}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Ongoing */}
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={includeOngoing}
              onChange={(e) => setIncludeOngoing(e.target.checked)}
              className="rounded border-input"
            />
            <span className="text-sm font-medium">Include ongoing (hosting, updates, edits)</span>
          </label>
          {includeOngoing && (
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                value={ongoingMin}
                onChange={(e) => setOngoingMin(Number(e.target.value) || 0)}
                className="w-20"
              />
              <span className="text-muted-foreground">–</span>
              <Input
                type="number"
                min={0}
                value={ongoingMax}
                onChange={(e) => setOngoingMax(Number(e.target.value) || 0)}
                className="w-20"
              />
              <span className="text-sm text-muted-foreground">/mo</span>
            </div>
          )}
        </div>

        {/* Result */}
        {(() => {
          const pageOpt = PAGE_COUNT_OPTIONS.find((o) => o.id === pageCountId);
          const addonCount = designSelected.size + functionalitySelected.size;
          return (
            <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-5 space-y-3">
              <p className="text-sm font-medium text-muted-foreground">Charge this client</p>
              <div className="flex flex-wrap items-baseline gap-3 gap-y-1">
                <span className="text-2xl font-bold">
                  {fmtFull(oneTimeMin)} – {fmtFull(oneTimeMax)}
                </span>
                <span className="text-muted-foreground">one-time</span>
                <Badge variant="secondary" className="text-xs">
                  Recommended: {fmtFull(recommended)}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Based on {baseType === "pages" && pageOpt
                  ? pageOpt.label
                  : baseType === "custom"
                    ? "custom range"
                    : baseType === "floor"
                      ? "Floor package"
                      : baseType === "target"
                        ? "Target package"
                        : "High End package"}
                {addonCount > 0 && ` + ${addonCount} add-on${addonCount === 1 ? "" : "s"}`}.
              </p>
              {includeOngoing && (monthlyMin > 0 || monthlyMax > 0) && (
                <p className="text-sm">
                  <span className="font-medium">{fmtFull(monthlyMin)}–{fmtFull(monthlyMax)}</span>
                  <span className="text-muted-foreground"> / month ongoing</span>
                </p>
              )}
            </div>
          );
        })()}
      </CardContent>
    </Card>
  );
}
