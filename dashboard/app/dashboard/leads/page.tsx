import { Header } from "@/components/dashboard/header";
import { LeadsTableClient } from "@/components/dashboard/leads-table-client";

export const dynamic = "force-dynamic";

export default function LeadsPage() {
  return (
    <>
      <Header title="Leads" />
      <main className="p-6">
        <LeadsTableClient />
      </main>
    </>
  );
}
