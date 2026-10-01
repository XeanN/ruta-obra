import type { Metadata } from "next";
import { knowledgeRepo } from "@/data/knowledge-repo";
import { respuestasDesdeParams } from "@/domain/diagnostico";
import { DiagnosticoWizard } from "@/features/diagnostico/diagnostico-wizard";

export const metadata: Metadata = {
  title: "Diagnóstico del predio",
  description:
    "Responde unas preguntas sobre tu predio y conoce la modalidad de licencia, las alertas y los programas que aplican.",
};

export default async function DiagnosticoPage({ searchParams }: PageProps<"/diagnostico">) {
  const params = await searchParams;
  const preguntas = knowledgeRepo.getPreguntas();
  const paso = typeof params.paso === "string" ? params.paso : undefined;

  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-4 py-8 sm:py-12">
      <h1 className="text-muted-foreground mb-6 text-sm font-medium tracking-wide uppercase">
        Diagnóstico del predio
      </h1>
      <DiagnosticoWizard
        preguntas={preguntas}
        respuestasIniciales={respuestasDesdeParams(preguntas, params)}
        pasoInicial={paso}
      />
    </main>
  );
}
