"use client";

import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  actualizarEntrada,
  agregarEntrada,
  agruparPorMes,
  eliminarEntrada,
  ETIQUETA_TIPO_ENTRADA,
  filtrarEntradas,
  fotosQuitadas,
  totalesBitacora,
  type TipoEntrada,
} from "@/domain/bitacora";
import type { EntradaBitacora, ExpedienteRegistro } from "@/domain/types";
import { claseSelect } from "@/features/checklist/checklist";
import { formatFecha, formatSoles } from "@/lib/format";
import { eliminarArchivos } from "../../../app/expedientes/acciones-archivos";
import { FormularioEntrada } from "./formulario-entrada";
import { useUrlsFotos } from "./fotos";

const nombreMes = (mes: string) => {
  const t = format(parseISO(`${mes}-01`), "MMMM 'de' yyyy", { locale: es });
  return t.charAt(0).toUpperCase() + t.slice(1);
};

function Totales({ entradas }: { entradas: readonly EntradaBitacora[] }) {
  const t = totalesBitacora(entradas);
  if (t.entradas === 0) return null;
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>Resumen de obra</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 text-sm sm:grid-cols-3">
        <div>
          <p className="text-muted-foreground text-xs">Gasto registrado</p>
          <p className="text-xl font-semibold tabular-nums">{formatSoles(t.total)}</p>
          <p className="text-muted-foreground text-xs">
            {t.entradasConMonto} de {t.entradas} entradas con monto
          </p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs">Avance de obra</p>
          <p className="text-xl font-semibold tabular-nums">{t.ultimoAvance ? `${t.ultimoAvance.pct}%` : "—"}</p>
          {t.ultimoAvance && <p className="text-muted-foreground text-xs">al {formatFecha(t.ultimoAvance.fecha)}</p>}
        </div>
        {t.porTipo.length > 0 && (
          <div className="space-y-1 sm:col-span-1">
            <p className="text-muted-foreground text-xs">Por tipo</p>
            <ul className="space-y-0.5">
              {t.porTipo.map((x) => (
                <li key={x.tipo} className="flex justify-between gap-2">
                  <span>{ETIQUETA_TIPO_ENTRADA[x.tipo]}</span>
                  <span className="tabular-nums">{formatSoles(x.total)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {t.porMes.length > 0 && (
          <div className="space-y-1 sm:col-span-3">
            <p className="text-muted-foreground text-xs">Por mes</p>
            <ul className="grid gap-x-6 gap-y-0.5 sm:grid-cols-2">
              {t.porMes.map((x) => (
                <li key={x.mes} className="flex justify-between gap-2">
                  <span>{nombreMes(x.mes)}</span>
                  <span className="tabular-nums">{formatSoles(x.total)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Fotos({ ids, urls }: { ids: readonly string[]; urls: Record<string, string> }) {
  return (
    <ul className="flex flex-wrap gap-2">
      {ids.map((id, i) => (
        <li key={id}>
          {urls[id] ? (
            <a href={urls[id]} target="_blank" rel="noopener noreferrer" aria-label={`Ver foto ${i + 1} en grande`}>
              {/* eslint-disable-next-line @next/next/no-img-element -- URL firmada temporal de R2 */}
              <img src={urls[id]} alt={`Foto ${i + 1} de la entrada`} className="size-20 rounded-md border object-cover" />
            </a>
          ) : (
            <span className="bg-muted text-muted-foreground flex size-20 items-center justify-center rounded-md text-center text-[10px]">
              Foto no disponible
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

export function Bitacora({
  registro,
  hoy,
  ahora,
  conFotos,
  generarId,
  onGuardar,
}: {
  registro: ExpedienteRegistro;
  hoy: string;
  ahora: () => string;
  conFotos: boolean;
  generarId: () => string;
  /** Guarda el registro; true si se guardó. */
  onGuardar: (nuevo: ExpedienteRegistro, mensaje: string) => Promise<boolean>;
}) {
  const e = registro.expediente;
  const entradas = e.bitacora ?? [];
  const actores = e.actores ?? [];
  const [editando, setEditando] = useState<string | "nueva" | null>(null);
  const [aEliminar, setAEliminar] = useState<EntradaBitacora | null>(null);
  const [tipo, setTipo] = useState<TipoEntrada | "">("");
  const [actorId, setActorId] = useState("");

  const visibles = filtrarEntradas(entradas, { tipo: tipo || undefined, actorId: actorId || undefined });
  const grupos = agruparPorMes(visibles);
  const urls = useUrlsFotos(e.id, entradas.flatMap((x) => x.fotos ?? []), conFotos);
  const nombreActor = (id?: string) => actores.find((a) => a.id === id)?.nombre;

  async function borrarFotos(ids: readonly string[]) {
    if (conFotos && ids.length > 0) await eliminarArchivos(e.id, [...ids]).catch(() => undefined);
  }

  const formulario = (inicial?: EntradaBitacora) => (
    <FormularioEntrada
      expedienteId={e.id}
      inicial={inicial}
      hoy={hoy}
      actores={actores}
      conFotos={conFotos}
      generarId={generarId}
      onCancelar={() => setEditando(null)}
      onGuardar={async (entrada) => {
        const nuevo = inicial
          ? actualizarEntrada(registro, entrada, ahora())
          : agregarEntrada(registro, entrada, ahora());
        const ok = await onGuardar(nuevo, inicial ? "Entrada actualizada" : "Entrada agregada");
        if (ok) {
          setEditando(null);
          if (inicial) await borrarFotos(fotosQuitadas(inicial, entrada));
        }
        return ok;
      }}
    />
  );

  return (
    <div className="space-y-5">
      <Totales entradas={entradas} />

      {editando === "nueva" ? (
        formulario()
      ) : (
        <Button size="lg" className="h-11 w-full sm:w-auto" onClick={() => setEditando("nueva")}>
          <Plus data-icon="inline-start" />
          Nueva entrada
        </Button>
      )}

      {entradas.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label htmlFor="filtro-tipo" className="text-xs font-medium">
              Tipo
            </label>
            <select id="filtro-tipo" className={claseSelect} value={tipo} onChange={(ev) => setTipo(ev.target.value as TipoEntrada | "")}>
              <option value="">Todos</option>
              {Object.entries(ETIQUETA_TIPO_ENTRADA).map(([v, t]) => (
                <option key={v} value={v}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="filtro-responsable" className="text-xs font-medium">
              Responsable
            </label>
            <select id="filtro-responsable" className={claseSelect} value={actorId} onChange={(ev) => setActorId(ev.target.value)}>
              <option value="">Todos</option>
              {actores.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nombre}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {entradas.length === 0 && editando !== "nueva" && (
        <p className="text-muted-foreground text-sm">
          Registra aquí el día a día de la obra: avances, compras, pagos, visitas e incidencias.
        </p>
      )}
      {entradas.length > 0 && visibles.length === 0 && (
        <p className="text-muted-foreground text-sm">Ninguna entrada coincide con los filtros.</p>
      )}

      {grupos.map((g) => (
        <section key={g.mes} className="space-y-2" aria-labelledby={`mes-${g.mes}`}>
          <h2 id={`mes-${g.mes}`} className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
            {nombreMes(g.mes)}
          </h2>
          <ul className="space-y-2">
            {g.entradas.map((x) =>
              editando === x.id ? (
                <li key={x.id}>{formulario(x)}</li>
              ) : (
                <li key={x.id} className="bg-card space-y-2 rounded-lg border p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium tabular-nums">{formatFecha(x.fecha)}</span>
                    <Badge variant="secondary">{ETIQUETA_TIPO_ENTRADA[x.tipo]}</Badge>
                    {x.monto !== undefined && <span className="ml-auto font-medium tabular-nums">{formatSoles(x.monto)}</span>}
                  </div>
                  <p className="whitespace-pre-line">{x.descripcion}</p>
                  {(x.avance_pct !== undefined || x.actor_id) && (
                    <p className="text-muted-foreground text-xs">
                      {[
                        x.avance_pct !== undefined ? `Avance ${x.avance_pct}%` : null,
                        nombreActor(x.actor_id) ? `Responsable: ${nombreActor(x.actor_id)}` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  )}
                  {x.fotos && x.fotos.length > 0 && <Fotos ids={x.fotos} urls={urls} />}
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => setEditando(x.id)}>
                      <Pencil data-icon="inline-start" />
                      Editar
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setAEliminar(x)}>
                      <Trash2 data-icon="inline-start" />
                      Eliminar
                    </Button>
                  </div>
                </li>
              ),
            )}
          </ul>
        </section>
      ))}

      <Dialog open={aEliminar !== null} onOpenChange={(abierto) => !abierto && setAEliminar(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Eliminar esta entrada?</DialogTitle>
            <DialogDescription>También se borran sus fotos. No se puede deshacer.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancelar</DialogClose>
            <Button
              variant="destructive"
              onClick={async () => {
                if (!aEliminar) return;
                const { registro: nuevo, fotosEliminadas } = eliminarEntrada(registro, aEliminar.id, ahora());
                setAEliminar(null);
                if (await onGuardar(nuevo, "Entrada eliminada")) await borrarFotos(fotosEliminadas);
              }}
            >
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
