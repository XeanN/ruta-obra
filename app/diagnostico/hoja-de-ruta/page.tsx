import { ArrowLeft, FolderPlus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { knowledgeRepo } from "@/data/knowledge-repo";
import {
  preguntasFaltantes,
  respuestasAParams,
  respuestasDesdeParams,
} from "@/domain/diagnostico";
import { armarHojaDeRuta, ubigeoDeRespuestas } from "@/domain/roadmap";
import { diagnosticar } from "@/domain/rules-engine";
import { DistritoAviso, LineaDeTiempo, ResumenTotales } from "@/features/hoja-de-ruta/hoja-de-ruta";
import { formatFecha } from "@/lib/format";

export const metadata: Metadata = {
  title: "Hoja de ruta",
  robots: { index: false },
};

export default async function HojaDeRutaPage({
  searchParams,
}: PageProps<"/diagnostico/hoja-de-ruta">) {
  const preguntas = knowledgeRepo.getPreguntas();
  const respuestas = respuestasDesdeParams(preguntas, await searchParams);
  const params = respuestasAParams(preguntas, respuestas);
  if (preguntasFaltantes(preguntas, respuestas).length > 0) {
    redirect(`/diagnostico/resultado?${params}`);
  }

  const ubigeo = ubigeoDeRespuestas(respuestas.distrito);
  const hoja = armarHojaDeRuta(
    diagnosticar(respuestas, knowledgeRepo.baseReglas),
    ubigeo,
    knowledgeRepo.baseHojaDeRuta,
  );
  const distrito = ubigeo ? knowledgeRepo.getDistrito(ubigeo) : undefined;
  const fuenteTupa = distrito?.tupa.fuente_id ? knowledgeRepo.getFuente(distrito.tupa.fuente_id) : undefined;
  const { meta } = knowledgeRepo;

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 py-8 sm:py-12">
      <Link
        href={`/diagnostico/resultado?${params}`}
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft aria-hidden className="size-4" /> Volver al resultado
      </Link>

      <div className="space-y-2">
        <p className="text-muted-foreground text-sm font-medium tracking-wide uppercase">
          Hoja de ruta{hoja.modalidad ? ` · Modalidad ${hoja.modalidad}` : ""}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Tus trámites, en orden</h1>
        <DistritoAviso distrito={distrito} fuente={fuenteTupa} />
      </div>

      <ResumenTotales totales={hoja.totales} />

      <LineaDeTiempo hoja={hoja} />

      <div className="space-y-2">
        <Link
          href={`/expedientes/nuevo?${params}`}
          className={buttonVariants({ size: "lg", className: "h-11 w-full sm:w-auto" })}
        >
          <FolderPlus data-icon="inline-start" />
          Guardar como expediente
        </Link>
        <p className="text-muted-foreground text-xs">
          Para seguir el estado de cada trámite, tus documentos y sus vencimientos.
        </p>
      </div>

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
