// Checklist de documentos (F3): une los requisitos de los pasos del expediente, sin duplicados,
// y calcula vencimientos a partir de la fecha de emisión. Puro: "hoy" entra como parámetro.
import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";
import type {
  Documento,
  DocumentoCargado,
  ExpedienteRegistro,
  Institucion,
  Procedimiento,
  Vencimiento,
} from "./types";

export interface BaseChecklist {
  procedimientos: readonly Procedimiento[];
  documentos: readonly Documento[];
  instituciones: readonly Institucion[];
  vencimientos: readonly Vencimiento[];
}

export type EstadoDocumento = DocumentoCargado["estado"];

export const ETIQUETA_ESTADO_DOCUMENTO: Record<EstadoDocumento, string> = {
  falta: "Falta",
  en_tramite: "En trámite",
  obtenido: "Obtenido",
  vencido: "Vencido",
};

export interface ItemChecklist {
  documento: Documento;
  emisor: Institucion | undefined;
  /** Pasos del expediente que lo piden como requisito. */
  requeridoPor: Procedimiento[];
  /** Pasos del expediente que lo producen (se obtiene al completarlos). */
  seObtieneEn: Procedimiento[];
  /** Días de vigencia (documento o regla de vencimientos.json). */
  vigenciaDias: number | null;
  cargado: DocumentoCargado | undefined;
  /** Estado efectivo: "obtenido" pasa a "vencido" si ya venció. */
  estado: EstadoDocumento;
  fechaEmision: string | null;
  fechaVencimiento: string | null;
  /** Días calendario hasta el vencimiento (negativo si ya venció). */
  diasParaVencer: number | null;
}

/** Vigencia en días calendario de un documento: la del documento o la de su regla de vencimiento. */
export function vigenciaDeDocumento(
  documento: Documento,
  vencimientos: readonly Vencimiento[],
): number | null {
  if (documento.vigencia_dias != null) return documento.vigencia_dias;
  return vencimientos.find((v) => v.documento_id === documento.id)?.vigencia_dias ?? null;
}

export function fechaVencimiento(fechaEmision: string, vigenciaDias: number): string {
  return format(addDays(parseISO(fechaEmision), vigenciaDias), "yyyy-MM-dd");
}

export function diasEntre(desde: string, hasta: string): number {
  return differenceInCalendarDays(parseISO(hasta), parseISO(desde));
}

/**
 * @param opcionales procedimientos opcionales: sus requisitos no entran al checklist.
 */
export function armarChecklist(
  registro: ExpedienteRegistro,
  opcionales: ReadonlySet<string>,
  base: BaseChecklist,
  hoy: string,
): ItemChecklist[] {
  const procs = new Map(base.procedimientos.map((p) => [p.id, p]));
  const docs = new Map(base.documentos.map((d) => [d.id, d]));
  const instituciones = new Map(base.instituciones.map((i) => [i.id, i]));
  const cargados = new Map((registro.expediente.documentos ?? []).map((d) => [d.documento_id, d]));

  const activos = registro.expediente.pasos
    .filter((p) => !opcionales.has(p.procedimiento_id) && p.estado !== "no_aplica")
    .map((p) => procs.get(p.procedimiento_id))
    .filter((p): p is Procedimiento => p !== undefined);

  const orden: string[] = [];
  const requeridoPor = new Map<string, Procedimiento[]>();
  for (const proc of activos) {
    for (const docId of proc.requisitos) {
      if (!requeridoPor.has(docId)) {
        orden.push(docId);
        requeridoPor.set(docId, []);
      }
      requeridoPor.get(docId)?.push(proc);
    }
  }

  return orden.flatMap((docId): ItemChecklist[] => {
    const documento = docs.get(docId);
    if (!documento) return [];
    const cargado = cargados.get(docId);
    const vigenciaDias = vigenciaDeDocumento(documento, base.vencimientos);
    const fechaEmision = cargado?.fecha_emision ?? null;
    const vence =
      fechaEmision && vigenciaDias != null ? fechaVencimiento(fechaEmision, vigenciaDias) : null;
    const diasParaVencer = vence ? diasEntre(hoy, vence) : null;
    let estado: EstadoDocumento = cargado?.estado ?? "falta";
    if (estado === "obtenido" && diasParaVencer !== null && diasParaVencer < 0) estado = "vencido";

    return [
      {
        documento,
        emisor: documento.emisor_id ? instituciones.get(documento.emisor_id) : undefined,
        requeridoPor: requeridoPor.get(docId) ?? [],
        seObtieneEn: activos.filter((p) => p.documentos_resultado.includes(docId)),
        vigenciaDias,
        cargado,
        estado,
        fechaEmision,
        fechaVencimiento: vence,
        diasParaVencer,
      },
    ];
  });
}

export function resumenChecklist(items: readonly ItemChecklist[]): Record<EstadoDocumento, number> {
  const r: Record<EstadoDocumento, number> = { falta: 0, en_tramite: 0, obtenido: 0, vencido: 0 };
  for (const i of items) r[i.estado]++;
  return r;
}
