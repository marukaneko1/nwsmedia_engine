import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowDown, ArrowUp } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  delta?: number;
  deltaLabel?: string;
  icon: React.ReactNode;
  href?: string;
}

export function StatCard({ title, value, delta, deltaLabel, icon, href }: StatCardProps) {
  const showDelta = delta !== undefined && delta !== null;
  const isPositive = showDelta && delta > 0;
  const isNegative = showDelta && delta < 0;

  const content = (
    <CardContent className="p-5">
      <div className="flex items-center gap-2">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
          {icon}
        </div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          {title}
        </p>
      </div>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
      {showDelta && (
        <div className="mt-1 flex items-center gap-1 text-xs">
          {isPositive && (
            <span className="flex items-center gap-0.5 text-green-600">
              <ArrowUp className="size-3" />
              {delta}
            </span>
          )}
          {isNegative && (
            <span className="flex items-center gap-0.5 text-red-600">
              <ArrowDown className="size-3" />
              {Math.abs(delta)}
            </span>
          )}
          {deltaLabel && (
            <span className="text-muted-foreground">{deltaLabel}</span>
          )}
        </div>
      )}
    </CardContent>
  );

  if (href) {
    return (
      <Link href={href} className="block">
        <Card className="transition-shadow hover:shadow-md hover:border-primary/30 cursor-pointer">
          {content}
        </Card>
      </Link>
    );
  }

  return <Card>{content}</Card>;
}
