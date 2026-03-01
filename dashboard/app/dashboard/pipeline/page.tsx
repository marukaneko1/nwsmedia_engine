import { Header } from "@/components/dashboard/header";
import { PipelineBoard } from "@/components/dashboard/pipeline-board";
import { getPipelineLeads } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PipelinePage() {
  const pipelineData = await getPipelineLeads();

  return (
    <>
      <Header title="Pipeline" />
      <main className="p-6">
        <PipelineBoard initialData={pipelineData} />
      </main>
    </>
  );
}
