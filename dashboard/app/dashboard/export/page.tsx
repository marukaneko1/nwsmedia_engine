import { Header } from "@/components/dashboard/header";
import { ExportPanelLoader } from "@/components/dashboard/export-panel-loader";
import { FileDown, Megaphone } from "lucide-react";

export const dynamic = "force-dynamic";

export default function ExportPage() {
  return (
    <>
      <Header title="Export Data" />
      <main className="p-6 space-y-10">
        {/* Google Maps / main leads export */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <FileDown className="size-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold text-foreground">Google Maps Leads</h2>
          </div>
          <ExportPanelLoader />
        </section>

        {/* Craigslist leads export */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Megaphone className="size-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold text-foreground">Craigslist Leads</h2>
          </div>
          <ExportPanelLoader source="craigslist" />
        </section>
      </main>
    </>
  );
}
