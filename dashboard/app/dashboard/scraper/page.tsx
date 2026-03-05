import { Header } from "@/components/dashboard/header";
import { ScraperPanel } from "@/components/dashboard/scraper-panel";

export default function ScraperPage() {
  return (
    <>
      <Header title="Scraper" />
      <div className="w-full space-y-6 p-6">
        <ScraperPanel />
      </div>
    </>
  );
}
