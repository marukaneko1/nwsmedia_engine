import { Header } from "@/components/dashboard/header";
import { PipelineBoard } from "@/components/dashboard/pipeline-board";
import { getPipelineLeads } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const emptyPipeline = {
  lead: [],
  contacted: [],
  replied: [],
  meeting: [],
  proposal: [],
  won: [],
  lost: [],
};

export default async function PipelinePage() {
  let pipelineData = emptyPipeline;
  let dataError: string | null = null;

  try {
    pipelineData = await getPipelineLeads();
  } catch (err) {
    dataError = err instanceof Error ? err.message : "Failed to load pipeline";
  }

  return (
    <>
      <Header title="Pipeline" />
      {dataError && (
        <div className="mx-6 mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          {dataError}
        </div>
      )}
      <main className="p-6">
        <PipelineBoard initialData={pipelineData} />
      </main>
    </>
  );
}
