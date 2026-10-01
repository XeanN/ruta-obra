import { ArrowRight, FolderPlus, Map as MapIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { knowledgeRepo } from "@/data/knowledge-repo";
import {
  preguntasFaltantes,
  respuestasAParams,
  respuestasDesdeParams,
  resumirDiagnostico,
} from "@/domain/diagnostico";
import {
  AlertasCard,
  ModalidadCard,
  ProgramasCard,
  RespuestasCard,
} from "@/features/diagnostico/resultado";
import { formatFecha } from "@/lib/format";

export const metadata: Metadata = {
  title: "Resultado del diagnóstico",
  robots: { index: false },
};

export default async function ResultadoPage({
  searchParams,
}: PageProps<"/diagnostico/resultado">) {
  const preguntas = knowledgeRepo.getPreguntas();
  const respuestas = respuestasDesdeParams(preguntas, await searchParams);
  const faltantes = preguntasFaltantes(preguntas, respuestas);
  const params = respuestasAParams(preguntas, respuestas);

  if (faltantes.length > 0) {
    const primera = faltantes[0];
    if (primera) params.set("paso", primera.id);
    return (
      <main className="mx-auto w-full max-w-xl flex-1 px-4 py-8 sm:py-12">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Faltan respuestas</CardTitle>
            <CardDescription>
              Para darte un diagnóstico necesitamos {faltantes.length}{" "}
              {faltantes.length === 1 ? "respuesta más" : "respuestas más"}.
            </CardDescription>
          </CardHeader>
          <div className="px-4">
            <Link href={`/diagnostico?${params}`} className={buttonVariants()}>
              Continuar el diagnóstico
              <ArrowRight data-icon="inline-end" />
            </Link>
          </div>
        </Card>
      </main>
    );
  }

  const resumen = resumirDiagnostico(respuestas, {
    ...knowledgeRepo.baseReglas,
    programas: knowledgeRepo.getProgramas(),
  });
  const { meta } = knowledgeRepo;

  return (
    <main className="mx-auto w-full max-w-xl flex-1 space-y-6 px-4 py-8 sm:py-12">
      <div className="space-y-1">
        <p className="text-muted-foreground text-sm font-medium tracking-wide uppercase">
          Resultado del diagnóstico
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Así se ve tu trámite</h1>
      </div>

      <ModalidadCard modalidad={resumen.modalidad} repo={knowledgeRepo} />
      <AlertasCard grupos={resumen.alertasPorNivel} />
      <ProgramasCard programas={resumen.programas} repo={knowledgeRepo} />

      <div className="flex flex-col gap-3 sm:flex-row">
        <Link
          href={`/diagnostico/hoja-de-ruta?${params}`}
          className={buttonVariants({ size: "lg", className: "h-11 flex-1" })}
        >
          <MapIcon data-icon="inline-start" />
          Ver mi hoja de ruta
        </Link>
        <Link
          href={`/expedientes/nuevo?${params}`}
          className={buttonVariants({ size: "lg", variant: "outline", className: "h-11 flex-1" })}
        >
          <FolderPlus data-icon="inline-start" />
          Guardar como expediente
        </Link>
      </div>

      <RespuestasCard preguntas={preguntas} respuestas={respuestas} />

      <footer className="text-muted-foreground space-y-1 border-t pt-4 text-xs">
        <p>{meta.aviso_legal}</p>
        <p>
          Datos al {formatFecha(meta.fecha_corte)} ·{" "}
          <Link href="/fuentes" className="underline underline-offset-2">
            Cómo sabemos esto
          </Link>
        </p>
      </footer>
    </main>
  );
}
