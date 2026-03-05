import { Header } from "@/components/dashboard/header";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  return (
    <>
      <Header title="Settings" />
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="text-center space-y-2">
          <h2 className="text-lg font-semibold text-foreground">
            Settings coming soon
          </h2>
          <p className="text-sm text-muted-foreground max-w-md">
            Configuration for API keys, email accounts, scraping preferences,
            and notification settings will be available here.
          </p>
        </div>
      </div>
    </>
  );
}
