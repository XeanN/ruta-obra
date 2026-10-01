"use client";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  ETIQUETA_ESTADO_DOCUMENTO,
  resumenChecklist,
  type EstadoDocumento,
  type ItemChecklist,
} from "@/domain/checklist";
import type { CambiosDocumento } from "@/domain/expediente";
import { EstadoVerificacionBadge } from "@/features/fuentes/estado-verificacion-badge";
import { formatFecha } from "@/lib/format";
import { cn } from "@/lib/utils";

export const claseSelect =
  "h-10 w-full rounded-lg border border-input bg-transparent px-2.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30";

const ESTILO_ESTADO: Record<EstadoDocumento, string> = {
  falta: "bg-muted text-foreground",
  en_tramite: "bg-sky-500/15 text-sky-800 dark:text-sky-300",
  obtenido: "bg-green-500/15 text-green-800 dark:text-green-300",
  vencido: "bg-red-500/15 text-red-800 dark:text-red-300",
};

export function EstadoDocumentoBadge({ estado }: { estado: EstadoDocumento }) {
  return (
    <Badge variant="outline" className={cn("border-transparent", ESTILO_ESTADO[estado])}>
      {ETIQUETA_ESTADO_DOCUMENTO[estado]}
    </Badge>
  );
}

function textoVencimiento(item: ItemChecklist): string | null {
  if (!item.fechaVencimiento || item.diasParaVencer === null) return null;
  const fecha = formatFecha(item.fechaVencimiento);
  if (item.diasParaVencer < 0) return `Venció el ${fecha}`;
  if (item.diasParaVencer === 0) return `Vence hoy (${fecha})`;
  return `Vence el ${fecha} (en ${item.diasParaVencer} ${item.diasParaVencer === 1 ? "día" : "días"})`;
}

function ItemDocumento({
  item,
  onCambiar,
}: {
  item: ItemChecklist;
  onCambiar: (documentoId: string, cambios: CambiosDocumento) => void;
}) {
  const id = `doc-${item.documento.id}`;
  // El selector muestra lo que eligió el usuario; "vencido" se calcula solo a partir de la fecha.
  const elegido = item.cargado?.estado ?? "falta";
  const vence = textoVencimiento(item);
  return (
    <li className="bg-card space-y-3 rounded-lg border p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <p className="font-medium leading-snug">{item.documento.nombre}</p>
          <div className="text-muted-foreground space-y-0.5 text-xs">
            {item.emisor && <p>Lo emite: {item.emisor.nombre}</p>}
            {item.seObtieneEn.length > 0 ? (
              <p>Lo obtienes en: {item.seObtieneEn.map((p) => p.nombre).join("; ")}</p>
            ) : null}
            <p>Lo piden: {item.requeridoPor.map((p) => p.nombre).join("; ")}</p>
            {item.vigenciaDias != null && <p>Vigencia: {item.vigenciaDias} días desde su emisión</p>}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <EstadoDocumentoBadge estado={item.estado} />
          <EstadoVerificacionBadge estado={item.documento.estado_verificacion} ocultarSiVerificado />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor={`${id}-estado`} className="text-xs font-medium">
            Estado
          </label>
          <select
            id={`${id}-estado`}
            className={claseSelect}
            value={elegido}
            onChange={(e) => onCambiar(item.documento.id, { estado: e.target.value as EstadoDocumento })}
          >
            {(["falta", "en_tramite", "obtenido"] as const).map((e) => (
              <option key={e} value={e}>
                {ETIQUETA_ESTADO_DOCUMENTO[e]}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor={`${id}-emision`} className="text-xs font-medium">
            Fecha de emisión
          </label>
          <Input
            id={`${id}-emision`}
            type="date"
            className="h-10"
            value={item.fechaEmision ?? ""}
            onChange={(e) =>
              onCambiar(item.documento.id, { fecha_emision: e.target.value === "" ? undefined : e.target.value })
            }
          />
        </div>
      </div>
      {vence && (
        <p className={cn("text-sm font-medium", item.estado === "vencido" && "text-red-700 dark:text-red-400")}>
          {vence}
        </p>
      )}
    </li>
  );
}

export function Checklist({
  items,
  onCambiar,
}: {
  items: readonly ItemChecklist[];
  onCambiar: (documentoId: string, cambios: CambiosDocumento) => void;
}) {
  if (items.length === 0) {
    return <p className="text-muted-foreground text-sm">Este expediente no tiene documentos requeridos.</p>;
  }
  const r = resumenChecklist(items);
  return (
    <div className="space-y-4">
      <p className="text-sm" aria-live="polite">
        <span className="font-medium">{r.obtenido}</span> de {items.length} documentos obtenidos
        {r.en_tramite > 0 && ` · ${r.en_tramite} en trámite`}
        {r.vencido > 0 && (
          <span className="font-medium text-red-700 dark:text-red-400"> · {r.vencido} vencidos</span>
        )}
      </p>
      <ul className="space-y-3">
        {items.map((i) => (
          <ItemDocumento key={i.documento.id} item={i} onCambiar={onCambiar} />
        ))}
      </ul>
    </div>
  );
}
