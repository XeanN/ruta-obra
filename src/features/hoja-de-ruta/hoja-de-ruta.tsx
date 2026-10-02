import { ChevronDown, Clock, Coins, Info } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Distrito, Documento, Fuente } from "@/domain/types";
import type { Antiguedad } from "@/domain/freshness";
import type { EtapaRuta, HojaDeRuta, PasoRuta, TotalesRuta } from "@/domain/roadmap";
import { EstadoVerificacionBadge } from "@/features/fuentes/estado-verificacion-badge";
import { FuentesLinks } from "@/features/fuentes/fuentes-links";
import { ReportarDato, type ContextoReporte } from "@/features/fuentes/reportar-dato";
import { textoProfesional } from "@/lib/format";
import { CostoBadge, CostoDetalle, textoCosto, textoRango } from "./costo";

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

export function DistritoAviso({
  distrito,
  fuente,
}: {
  /** Distrito con su estado efectivo según la antigüedad de su TUPA. */
  distrito: (Distrito & Antiguedad) | undefined;
  fuente: Fuente | undefined;
}) {
  if (!distrito) {
    return (
      <p className="text-muted-foreground flex gap-2 text-sm">
        <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
        Tu distrito aún no tiene tasas cargadas: los montos son referenciales nacionales o hay que
        consultarlos en su TUPA.
      </p>
    );
  }
  return (
    <div className="space-y-1 text-sm">
      <p className="flex flex-wrap items-center gap-2">
        <span>
          Tasas de <span className="font-medium">{distrito.nombre}</span>
          {distrito.tupa.anio ? ` (TUPA ${distrito.tupa.anio})` : ""}
        </span>
        <EstadoVerificacionBadge
          estado={distrito.estado_verificacion}
          antiguedadMeses={distrito.antiguedad_meses}
          ocultarSiVerificado
        />
      </p>
      {distrito.tupa.nota && <p className="text-muted-foreground">{distrito.tupa.nota}</p>}
      {fuente && <FuentesLinks fuentes={[fuente]} />}
    </div>
  );
}

export function ResumenTotales({ totales }: { totales: TotalesRuta }) {
  const t = totales;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Resumen</CardTitle>
        <CardDescription>
          {plural(t.pasosObligatorios, "trámite", "trámites")}
          {t.pasosOpcionales > 0 && ` y ${plural(t.pasosOpcionales, "opcional", "opcionales")} (no se suman)`}.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-1">
          <p className="text-muted-foreground flex items-center gap-1.5 text-sm">
            <Coins aria-hidden className="size-4" /> Costo estatal estimado
          </p>
          <p className="text-2xl font-semibold tabular-nums">
            {t.pasosConMonto > 0 ? textoRango(t.costo) : "Por confirmar"}
          </p>
          <ul className="text-muted-foreground space-y-0.5 text-xs">
            <li>Suma de {plural(t.pasosConMonto, "trámite", "trámites")} con monto conocido.</li>
            {t.montosFaltantes > 0 && (
              <li>
                {plural(t.montosFaltantes, "trámite", "trámites")} sin monto: honorarios, fórmulas o
                tasas por consultar en el TUPA.
              </li>
            )}
            {t.montosNoVerificados > 0 && (
              <li className="text-amber-800 dark:text-amber-300">
                Incluye {plural(t.montosNoVerificados, "monto no verificado", "montos no verificados")}.
              </li>
            )}
            <li>No incluye honorarios profesionales ni el costo de la obra.</li>
          </ul>
        </div>
        <div className="space-y-1">
          <p className="text-muted-foreground flex items-center gap-1.5 text-sm">
            <Clock aria-hidden className="size-4" /> Tiempo de trámites
          </p>
          <p className="text-2xl font-semibold tabular-nums">
            {t.diasHabiles > 0 ? `${t.diasHabiles} días hábiles` : "Por confirmar"}
          </p>
          <ul className="text-muted-foreground space-y-0.5 text-xs">
            <li>Suma de los plazos conocidos, uno tras otro; algunos pueden ir en paralelo.</li>
            {t.plazosFaltantes > 0 && (
              <li>{plural(t.plazosFaltantes, "trámite", "trámites")} sin plazo definido.</li>
            )}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

function ListaDocumentos({ docs }: { docs: Documento[] }) {
  return (
    <ul className="list-disc space-y-1 pl-5">
      {docs.map((d) => (
        <li key={d.id}>
          <span className="inline-flex flex-wrap items-center gap-x-2">
            {d.nombre}
            <EstadoVerificacionBadge estado={d.estado_verificacion} ocultarSiVerificado />
          </span>
        </li>
      ))}
    </ul>
  );
}

function Fila({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{titulo}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/** Lo que agrega el expediente a cada paso: su estado en el resumen y el formulario al abrirlo. */
export interface ExtraPaso {
  encabezado?: ReactNode;
  contenido?: ReactNode;
}

function PasoCard({ paso, extra, reporte }: { paso: PasoRuta; extra?: ExtraPaso; reporte?: ContextoReporte }) {
  const { procedimiento: p, entidad, costo, plazo } = paso;
  const plazoCorto =
    plazo.dias === null
      ? "Plazo por confirmar"
      : plazo.dias === 0
        ? "Inmediato"
        : `${plazo.dias} ${plazo.dias === 1 ? "día hábil" : "días hábiles"}`;
  return (
    <details className="group bg-card rounded-lg border open:shadow-sm">
      <summary className="flex cursor-pointer list-none gap-3 p-3 [&::-webkit-details-marker]:hidden">
        <div className="min-w-0 flex-1 space-y-1">
          <p className="font-medium leading-snug">{p.nombre}</p>
          <p className="text-muted-foreground text-sm">
            {[entidad?.siglas, textoCosto(costo), plazoCorto].filter(Boolean).join(" · ")}
          </p>
          <div className="flex flex-wrap gap-1.5 empty:hidden">
            {extra?.encabezado}
            {paso.opcional && <Badge variant="secondary">Opcional</Badge>}
            <CostoBadge costo={costo} />
            {paso.alternativas.length > 0 && <Badge variant="outline">Tiene alternativa</Badge>}
          </div>
        </div>
        <ChevronDown
          aria-hidden
          className="text-muted-foreground mt-0.5 size-5 shrink-0 transition-transform group-open:rotate-180"
        />
      </summary>
      {extra?.contenido && <div className="border-t p-3">{extra.contenido}</div>}
      <dl className="space-y-4 border-t p-3 text-sm">
        <div className="flex flex-wrap items-start gap-2">
          <p className="flex-1">{p.descripcion}</p>
          <EstadoVerificacionBadge
            estado={p.estado_verificacion}
            antiguedadMeses={p.antiguedad_meses}
            ocultarSiVerificado
          />
        </div>
        {entidad && (
          <Fila titulo="Dónde">
            <p>{entidad.nombre}</p>
            {entidad.canal && <p className="text-muted-foreground">{entidad.canal}</p>}
          </Fila>
        )}
        <Fila titulo="Plazo">{plazo.nota ?? plazoCorto}</Fila>
        <Fila titulo="Costo">
          <CostoDetalle costo={costo} procedimientoId={p.id} reporte={reporte} />
        </Fila>
        {paso.requisitos.length > 0 && (
          <Fila titulo="Requisitos">
            <ListaDocumentos docs={paso.requisitos} />
          </Fila>
        )}
        {paso.resultados.length > 0 && (
          <Fila titulo="Obtienes">
            <ListaDocumentos docs={paso.resultados} />
          </Fila>
        )}
        {p.profesionales.length > 0 && (
          <Fila titulo="Firman">{p.profesionales.map(textoProfesional).join(", ")}</Fila>
        )}
        {paso.normas.length > 0 && (
          <Fila titulo="Normas">
            <ul className="space-y-0.5">
              {paso.normas.map((n) => (
                <li key={n.id}>
                  {n.numero} — {n.nombre}
                </li>
              ))}
            </ul>
          </Fila>
        )}
        {paso.alternativas.length > 0 && (
          <Fila titulo="También puedes">
            <ul className="space-y-2">
              {paso.alternativas.map((a) => (
                <li key={a.procedimiento.id} className="bg-muted/50 space-y-1 rounded-md p-2">
                  <p className="font-medium">{a.procedimiento.nombre}</p>
                  <p className="text-muted-foreground">{a.procedimiento.descripcion}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <span>{textoCosto(a.costo)}</span>
                    <CostoBadge costo={a.costo} />
                  </div>
                </li>
              ))}
            </ul>
          </Fila>
        )}
        <FuentesLinks fuentes={paso.fuentes} />
        {reporte && (
          <ReportarDato
            dato={{
              procedimientoId: p.id,
              ubigeo: reporte.ubigeo,
              variante: null,
              montoMostrado: textoCosto(costo),
              pagina: reporte.pagina,
            }}
          />
        )}
      </dl>
    </details>
  );
}

function EtapaSeccion({
  etapa,
  ultima,
  extras,
  reporte,
}: {
  etapa: EtapaRuta;
  ultima: boolean;
  extras?: (paso: PasoRuta) => ExtraPaso;
  reporte?: ContextoReporte;
}) {
  return (
    <li className="relative flex gap-3">
      <div className="flex flex-col items-center">
        <span className="bg-primary text-primary-foreground flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold">
          {etapa.etapa.orden}
        </span>
        {!ultima && <span aria-hidden className="bg-border w-px flex-1" />}
      </div>
      <section className="min-w-0 flex-1 space-y-3 pb-8" aria-labelledby={`etapa-${etapa.etapa.id}`}>
        <div className="space-y-0.5 pt-0.5">
          <h2 id={`etapa-${etapa.etapa.id}`} className="font-semibold leading-snug">
            {etapa.etapa.nombre}
          </h2>
          <p className="text-muted-foreground text-sm">{etapa.etapa.descripcion}</p>
        </div>
        <ul className="space-y-2">
          {etapa.pasos.map((p) => (
            <li key={p.procedimiento.id}>
              <PasoCard paso={p} extra={extras?.(p)} reporte={reporte} />
            </li>
          ))}
        </ul>
      </section>
    </li>
  );
}

export function LineaDeTiempo({
  hoja,
  extras,
  paginaReporte,
}: {
  hoja: HojaDeRuta;
  /** Contenido adicional por paso (lo usa el expediente para el estado de cada trámite). */
  extras?: (paso: PasoRuta) => ExtraPaso;
  /** URL pública de esta hoja de ruta: activa "¿Este dato cambió? Repórtalo" en cada paso. */
  paginaReporte?: string;
}) {
  const reporte = paginaReporte ? { pagina: paginaReporte, ubigeo: hoja.ubigeo } : undefined;
  return (
    <ol aria-label="Etapas del trámite">
      {hoja.etapas.map((e, i) => (
        <EtapaSeccion
          key={e.etapa.id}
          etapa={e}
          ultima={i === hoja.etapas.length - 1}
          extras={extras}
          reporte={reporte}
        />
      ))}
    </ol>
  );
}
