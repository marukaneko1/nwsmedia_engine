import { Header } from "@/components/dashboard/header";
import { CraigslistPanel } from "@/components/dashboard/craigslist-panel";

export default function CraigslistPage() {
  return (
    <>
      <Header title="Craigslist Scraper" />
      <div className="w-full space-y-6 p-6">
        <CraigslistPanel />
      </div>
    </>
  );
}
