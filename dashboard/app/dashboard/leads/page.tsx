import { Header } from "@/components/dashboard/header";
import { LeadsTableClient } from "@/components/dashboard/leads-table-client";
import { getLeads, getCities, getAuditPdfSet, businessHasAuditPdf } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  const [{ leads, total }, cities, pdfSet] = await Promise.all([
    getLeads(),
    getCities(),
    getAuditPdfSet(),
  ]);

  const auditPdfIds = new Set(
    leads.filter((l) => businessHasAuditPdf(l.name, pdfSet)).map((l) => l.id)
  );

  return (
    <>
      <Header title="Leads" />
      <main className="p-6">
        <LeadsTableClient
          initialLeads={leads}
          initialTotal={total}
          cities={cities}
          auditPdfIds={[...auditPdfIds]}
        />
      </main>
    </>
  );
}
