import { notFound } from "next/navigation";
import { Header } from "@/components/dashboard/header";
import {
  LeadDetailView,
  type LeadDetailViewProps,
} from "@/components/dashboard/lead-detail-view";
import { getLeadById } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const numericId = parseInt(id, 10);
  if (Number.isNaN(numericId)) notFound();

  let data;
  try {
    data = await getLeadById(numericId);
  } catch {
    notFound();
  }
  if (!data || !data.lead) notFound();

  return (
    <>
      <Header title={String(data.lead.name ?? "Lead")} />
      <main className="p-6">
        <LeadDetailView
          data={data as unknown as LeadDetailViewProps["data"]}
        />
      </main>
    </>
  );
}
