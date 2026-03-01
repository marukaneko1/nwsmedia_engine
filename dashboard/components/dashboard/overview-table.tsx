import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn, segmentColor, tierColor, triageColor } from "@/lib/utils";
import type { LeadWithDetails } from "@/types/database";
import Link from "next/link";

interface OverviewTableProps {
  leads: LeadWithDetails[];
}

export function OverviewTable({ leads }: OverviewTableProps) {
  return (
    <Card>
      <CardHeader>
        <h3 className="text-sm font-medium text-foreground">Recent Leads</h3>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>City</TableHead>
              <TableHead>Score</TableHead>
              <TableHead>Tier</TableHead>
              <TableHead>Segment</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Triage</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leads.map((lead) => (
              <TableRow key={lead.id}>
                <TableCell>
                  <Link
                    href={`/dashboard/leads/${lead.id}`}
                    className="font-medium hover:underline"
                  >
                    {lead.name}
                  </Link>
                  {lead.category && (
                    <p className="text-xs text-muted-foreground">{lead.category}</p>
                  )}
                </TableCell>
                <TableCell>{lead.city ?? "—"}</TableCell>
                <TableCell>
                  <span className="font-semibold">
                    {lead.score ?? "—"}
                  </span>
                </TableCell>
                <TableCell>
                  {lead.tier ? (
                    <Badge
                      variant="outline"
                      className={cn("border", tierColor(lead.tier))}
                    >
                      {lead.tier}
                    </Badge>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell>
                  {lead.segment ? (
                    <Badge
                      variant="outline"
                      className={cn("border", segmentColor(lead.segment))}
                    >
                      {lead.segment.replace("_", " ")}
                    </Badge>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell className="max-w-[180px] truncate">
                  {lead.best_email ?? "—"}
                </TableCell>
                <TableCell>
                  {lead.triage_status ? (
                    <Badge
                      variant="outline"
                      className={cn("border", triageColor(lead.triage_status))}
                    >
                      {lead.triage_status.replace("_", " ")}
                    </Badge>
                  ) : (
                    "—"
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
