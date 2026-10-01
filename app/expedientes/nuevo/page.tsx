import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { knowledgeRepo } from "@/data/knowledge-repo";
import {
  preguntasFaltantes,
  respuestasAParams,
  respuestasDesdeParams,
} from "@/domain/diagnostico";
import { diagnosticar } from "@/domain/rules-engine";
import { NuevoExpediente } from "@/features/expedientes/nuevo-expediente";

export const metadata: Metadata = { title: "Nuevo expediente · RutaObra" };

export default async function NuevoExpedientePage({ searchParams }: PageProps<"/expedientes/nuevo">) {
  const preguntas = knowledgeRepo.getPreguntas();
  const respuestas = respuestasDesdeParams(preguntas, await searchParams);
  const params = respuestasAParams(preguntas, respuestas);
  if (Object.keys(respuestas).length === 0) redirect("/diagnostico");
  if (preguntasFaltantes(preguntas, respuestas).length > 0) redirect(`/diagnostico/resultado?${params}`);

  const ubigeo = String(respuestas.distrito ?? "");
  const distrito = knowledgeRepo.getDistrito(ubigeo)?.nombre ?? "Otro distrito";
  const { modalidad } = diagnosticar(respuestas, knowledgeRepo.baseReglas);

  return (
    <main className="mx-auto w-full max-w-xl flex-1 space-y-6 px-4 py-8 sm:py-12">
      <Link
        href={`/diagnostico/resultado?${params}`}
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft aria-hidden className="size-4" /> Volver al resultado
      </Link>
      <div className="space-y-1">
        <p className="text-muted-foreground text-sm font-medium tracking-wide uppercase">
          Nuevo expediente{modalidad ? ` · Modalidad ${modalidad}` : ""}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Guarda este caso para seguirlo</h1>
        <p className="text-muted-foreground text-sm">
          Se guarda en este navegador con su hoja de ruta, checklist de documentos y alertas.
        </p>
      </div>
      <NuevoExpediente respuestas={respuestas} distrito={distrito} base={knowledgeRepo.baseExpedientes} />
    </main>
  );
}
