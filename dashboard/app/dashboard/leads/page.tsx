import { Suspense } from "react";
import { Header } from "@/components/dashboard/header";
import { LeadsTableClient } from "@/components/dashboard/leads-table-client";
import { getLeads, getCities, getAuditPdfSet, businessHasAuditPdf } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  let leads: Awaited<ReturnType<typeof getLeads>>["leads"] = [];
  let total = 0;
  let cities: string[] = [];
  let pdfSet = new Set<string>();
  let dataError: string | null = null;

  try {
    const [leadsResult, citiesList, pdfSetResult] = await Promise.all([
      getLeads(),
      getCities(),
      getAuditPdfSet(),
    ]);
    leads = leadsResult.leads;
    total = leadsResult.total;
    cities = citiesList;
    pdfSet = pdfSetResult;
  } catch (err) {
    dataError = err instanceof Error ? err.message : "Failed to load leads";
  }

  const auditPdfIds = new Set(
    leads.filter((l) => businessHasAuditPdf(l.name, pdfSet)).map((l) => l.id)
  );

  return (
    <>
      <Header title="Leads" />
      {dataError && (
        <div className="mx-6 mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          {dataError}
        </div>
      )}
      <main className="p-6">
        <Suspense>
          <LeadsTableClient
            initialLeads={leads}
            initialTotal={total}
            cities={cities}
            auditPdfIds={[...auditPdfIds]}
          />
        </Suspense>
      </main>
    </>
  );
}
