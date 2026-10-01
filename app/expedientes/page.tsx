import type { Metadata } from "next";
import { knowledgeRepo } from "@/data/knowledge-repo";
import { Tablero } from "@/features/expedientes/tablero";

export const metadata: Metadata = {
  title: "Mis expedientes · RutaObra",
  description: "Sigue tus expedientes de obra: etapa actual, avance, próximo paso y vencimientos.",
};

export default function ExpedientesPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 py-8 sm:py-12">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Mis expedientes</h1>
        <p className="text-muted-foreground text-sm">
          Se guardan en este navegador. Exporta un respaldo para pasarlos a otro equipo.
        </p>
      </div>
      <Tablero base={knowledgeRepo.baseExpedientes} />
    </main>
  );
}
