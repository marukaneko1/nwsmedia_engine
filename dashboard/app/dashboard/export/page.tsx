import { Suspense } from "react";
import { Header } from "@/components/dashboard/header";
import { ExportPanel } from "@/components/dashboard/export-panel";
import { getLeads } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function ExportPage() {
  let leads: Awaited<ReturnType<typeof getLeads>>["leads"] = [];
  let total = 0;
  let dataError: string | null = null;

  try {
    const result = await getLeads();
    leads = result.leads;
    total = result.total;
  } catch (err) {
    dataError = err instanceof Error ? err.message : "Failed to load data";
  }

  return (
    <>
      <Header title="Export Data" />
      {dataError && (
        <div className="mx-6 mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          {dataError}
        </div>
      )}
      <main className="p-6">
        <Suspense
          fallback={
            <div className="py-8 text-center text-muted-foreground">
              Loading export data...
            </div>
          }
        >
          <ExportPanel leads={leads} total={total} />
        </Suspense>
      </main>
    </>
  );
}
