import type { Metadata } from "next";
import { knowledgeRepo } from "@/data/knowledge-repo";
import { ExpedienteDetalle } from "@/features/expedientes/expediente-detalle";

export const metadata: Metadata = { title: "Expediente", robots: { index: false } };

export default async function ExpedientePage({ params }: PageProps<"/expedientes/[id]">) {
  const { id } = await params;
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:py-12">
      <ExpedienteDetalle id={id} base={knowledgeRepo.baseExpedientes} />
    </main>
  );
}
