import { Pencil } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { KnowledgeRepo } from "@/data/knowledge-repo";
import {
  ETIQUETA_NIVEL,
  respuestasAParams,
  textoRespuesta,
  type ResumenDiagnostico,
} from "@/domain/diagnostico";
import { ESTILO_NIVEL } from "@/features/alertas/estilos";
import type { Fuente, Pregunta, Respuestas } from "@/domain/types";
import { EstadoVerificacionBadge } from "@/features/fuentes/estado-verificacion-badge";
import { FuentesLinks } from "@/features/fuentes/fuentes-links";
import { cn } from "@/lib/utils";

function resolverFuentes(repo: KnowledgeRepo, ids: readonly string[]): Fuente[] {
  return ids.map((id) => repo.getFuente(id)).filter((f): f is Fuente => f !== undefined);
}

export function ModalidadCard({
  modalidad,
  repo,
}: {
  modalidad: ResumenDiagnostico["modalidad"];
  repo: KnowledgeRepo;
}) {
  if (!modalidad) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">No pudimos estimar la modalidad</CardTitle>
          <CardDescription>
            Con estas respuestas ninguna regla define la modalidad de licencia. Revisa tus
            respuestas o consulta con la municipalidad.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }
  const { licencia } = modalidad;
  return (
    <Card>
      <CardHeader>
        <CardDescription>Modalidad de licencia estimada</CardDescription>
        <CardTitle className="text-3xl font-semibold">Modalidad {modalidad.modalidad}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {licencia && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium">{licencia.nombre}</p>
              <EstadoVerificacionBadge
                estado={licencia.estado_verificacion}
                antiguedadMeses={licencia.antiguedad_meses}
              />
            </div>
            <dl className="grid gap-3 text-sm">
              <div>
                <dt className="text-muted-foreground">Qué obras entran en esta modalidad</dt>
                <dd>{licencia.descripcion}</dd>
              </div>
              {(licencia.plazo_dias_habiles != null || licencia.plazo_nota) && (
                <div>
                  <dt className="text-muted-foreground">Plazo</dt>
                  {/* plazo_nota ya incluye el plazo con su contexto; si no hay, el número. */}
                  <dd>{licencia.plazo_nota ?? `${licencia.plazo_dias_habiles} días hábiles`}</dd>
                </div>
              )}
            </dl>
          </div>
        )}
        {modalidad.regla.nota && <p className="text-sm">{modalidad.regla.nota}</p>}
        <p className="text-muted-foreground text-sm">
          Es una estimación según tus respuestas; la municipalidad la confirma al evaluar el
          expediente.
        </p>
        <FuentesLinks fuentes={resolverFuentes(repo, modalidad.fuentes)} />
      </CardContent>
    </Card>
  );
}

export function AlertasCard({ grupos }: { grupos: ResumenDiagnostico["alertasPorNivel"] }) {
  const total = grupos.reduce((n, g) => n + g.alertas.length, 0);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Alertas</CardTitle>
        <CardDescription>
          {total === 0
            ? "No encontramos alertas para tu caso."
            : `${total} ${total === 1 ? "punto" : "puntos"} a tener en cuenta antes de empezar.`}
        </CardDescription>
      </CardHeader>
      {total > 0 && (
        <CardContent>
          <ul className="space-y-3">
            {grupos.flatMap((g) =>
              g.alertas.map((a) => {
                const { icono: Icono, clase } = ESTILO_NIVEL[g.nivel];
                return (
                  <li key={a.id} className={cn("flex gap-3 rounded-lg border p-3", clase)}>
                    <Icono aria-hidden className="mt-0.5 size-5 shrink-0" />
                    <div className="space-y-1">
                      <p className="text-xs font-semibold tracking-wide uppercase">
                        Prioridad {ETIQUETA_NIVEL[g.nivel].toLowerCase()}
                      </p>
                      <p className="text-sm">{a.mensaje}</p>
                    </div>
                  </li>
                );
              }),
            )}
          </ul>
        </CardContent>
      )}
    </Card>
  );
}

export function ProgramasCard({
  programas,
  repo,
}: {
  programas: ResumenDiagnostico["programas"];
  repo: KnowledgeRepo;
}) {
  if (programas.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Programas que podrían aplicar</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-4">
          {programas.map((p) => (
            <li key={p.id} className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium">{p.nombre}</p>
                <EstadoVerificacionBadge estado={p.estado_verificacion} antiguedadMeses={p.antiguedad_meses} />
              </div>
              <p className="text-sm">{p.beneficio}</p>
              {p.requisitos.length > 0 && (
                <ul className="text-muted-foreground list-disc space-y-0.5 pl-5 text-sm">
                  {p.requisitos.map((req) => (
                    <li key={req}>{req}</li>
                  ))}
                </ul>
              )}
              <FuentesLinks fuentes={resolverFuentes(repo, p.fuentes)} />
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

export function RespuestasCard({
  preguntas,
  respuestas,
}: {
  preguntas: Pregunta[];
  respuestas: Respuestas;
}) {
  const respondidas = preguntas.filter((p) => respuestas[p.id] !== undefined);
  const editar = (paso: string) => {
    const params = respuestasAParams(preguntas, respuestas);
    params.set("paso", paso);
    return `/diagnostico?${params.toString()}`;
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Tus respuestas</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="divide-y">
          {respondidas.map((p) => (
            <div key={p.id} className="py-2.5 text-sm first:pt-0">
              <dt className="text-muted-foreground">{p.texto}</dt>
              {/* El enlace va dentro del dd: un dl solo admite dt y dd (accesibilidad). */}
              <dd className="flex items-start justify-between gap-3">
                <span className="min-w-0 font-medium">{textoRespuesta(p, respuestas[p.id])}</span>
                <Link
                  href={editar(p.id)}
                  className="text-muted-foreground hover:text-foreground -my-2 shrink-0 rounded-md p-2"
                >
                  <Pencil aria-hidden className="size-4" />
                  <span className="sr-only">Cambiar: {p.texto}</span>
                </Link>
              </dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}
