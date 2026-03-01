import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { formatRelative } from "@/lib/utils";
import type { ActivityItem } from "@/types/database";
import { cn } from "@/lib/utils";

interface RecentActivityProps {
  activities: ActivityItem[];
}

const activityDotColor: Record<ActivityItem["type"], string> = {
  scraped: "bg-blue-500",
  enriched: "bg-green-500",
  outreach: "bg-purple-500",
  status_change: "bg-amber-500",
};

export function RecentActivity({ activities }: RecentActivityProps) {
  return (
    <Card>
      <CardHeader>
        <h3 className="text-sm font-medium text-foreground">Recent Activity</h3>
      </CardHeader>
      <CardContent className="space-y-0 divide-y divide-border max-h-[320px] overflow-y-auto">
        {activities.map((activity) => (
          <div
            key={`${activity.type}-${activity.id}`}
            className="flex items-start gap-3 py-3 first:pt-0 last:pb-0"
          >
            <div
              className={cn(
                "mt-1.5 size-2 shrink-0 rounded-full",
                activityDotColor[activity.type]
              )}
            />
            <div className="min-w-0 flex-1">
              <p className="font-medium">{activity.business_name}</p>
              <p className="text-xs text-muted-foreground">{activity.detail}</p>
            </div>
            <span className="shrink-0 text-xs text-muted-foreground">
              {formatRelative(activity.timestamp)}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
