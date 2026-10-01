import type { Metadata } from "next";
import { definicionesDemo } from "@/data/demo-definiciones";
import { knowledgeRepo } from "@/data/knowledge-repo";
import { CargarDemo } from "@/features/expedientes/demo";

export const metadata: Metadata = {
  title: "Demo",
  description: "Tres expedientes de ejemplo para probar RutaObra sin crear una cuenta.",
  robots: { index: false },
};

export default function DemoPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:py-12">
      <h1 className="sr-only">Demo de RutaObra</h1>
      <CargarDemo base={knowledgeRepo.baseExpedientes} definiciones={definicionesDemo} />
    </main>
  );
}
