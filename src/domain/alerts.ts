// Alertas del expediente (F4): vencimientos de documentos y plazo de subsanación según
// data/vencimientos.json, más las alertas del diagnóstico. Puro: "hoy" entra como parámetro.
import { diasHabilesEntre, sumarDiasHabiles } from "./business-days";
import { diasEntre, fechaVencimiento, vigenciaDeDocumento, type ItemChecklist } from "./checklist";
import type { AlertaDiagnostico } from "./rules-engine";
import type { Alerta, Documento, ExpedienteRegistro, Procedimiento, Vencimiento } from "./types";

export interface BaseAlertas {
  procedimientos: readonly Procedimiento[];
  documentos: readonly Documento[];
  vencimientos: readonly Vencimiento[];
  /** Feriados (yyyy-mm-dd) para los días hábiles; opcional. */
  feriados?: readonly string[];
}

export interface AlertaExpediente extends Alerta {
  nivel: NonNullable<Alerta["nivel"]>;
  /** Días que faltan para la fecha de la alerta (negativo si ya pasó). */
  dias?: number;
  /** true si `dias` son días hábiles (plazo de subsanación). */
  habiles?: boolean;
}

const PESO_NIVEL = { critica: 0, alta: 1, media: 2, baja: 3 } as const;

/** Alertas con fecha (vencimientos y plazos): las que piden actuar antes de una fecha. */
export const esAlertaConPlazo = (a: Pick<Alerta, "tipo">) => a.tipo !== "regla";

/** Primero las alertas con plazo, luego las advertencias del diagnóstico; dentro, por nivel y fecha. */
export function ordenarAlertas<T extends AlertaExpediente>(alertas: readonly T[]): T[] {
  return [...alertas].sort(
    (a, b) =>
      Number(!esAlertaConPlazo(a)) - Number(!esAlertaConPlazo(b)) ||
      PESO_NIVEL[a.nivel] - PESO_NIVEL[b.nivel] ||
      a.fecha.localeCompare(b.fecha),
  );
}

function nivelPorDias(dias: number, avisos: readonly number[]): AlertaExpediente["nivel"] {
  if (dias < 0) return "critica";
  if (avisos.length > 0 && dias <= Math.min(...avisos)) return "alta";
  return "media";
}

/** Documentos con fecha desde la que corre su vigencia: lo anotado en el checklist o el resultado de un paso aprobado. */
function documentosConFecha(
  registro: ExpedienteRegistro,
  checklist: readonly ItemChecklist[],
  procedimientos: ReadonlyMap<string, Procedimiento>,
): Map<string, string> {
  const fechas = new Map<string, string>();
  for (const p of registro.expediente.pasos) {
    if (p.estado !== "aprobado" || !p.fecha_resultado) continue;
    for (const docId of procedimientos.get(p.procedimiento_id)?.documentos_resultado ?? []) {
      const actual = fechas.get(docId);
      // Si varios pasos producen el mismo documento (p. ej. licencia y prórroga), vale el más reciente.
      if (!actual || p.fecha_resultado > actual) fechas.set(docId, p.fecha_resultado);
    }
  }
  // Lo anotado a mano en el checklist manda sobre lo deducido de los pasos.
  for (const item of checklist) {
    if (item.fechaEmision && (item.estado === "obtenido" || item.estado === "vencido")) {
      fechas.set(item.documento.id, item.fechaEmision);
    }
  }
  for (const d of registro.expediente.documentos ?? []) {
    if (d.fecha_emision && d.estado === "obtenido") fechas.set(d.documento_id, d.fecha_emision);
  }
  return fechas;
}

export function generarAlertas(
  registro: ExpedienteRegistro,
  checklist: readonly ItemChecklist[],
  alertasDiagnostico: readonly AlertaDiagnostico[],
  base: BaseAlertas,
  hoy: string,
): AlertaExpediente[] {
  const expedienteId = registro.expediente.id;
  const procs = new Map(base.procedimientos.map((p) => [p.id, p]));
  const docs = new Map(base.documentos.map((d) => [d.id, d]));
  const alertas: AlertaExpediente[] = [];

  // 1. Vencimiento de documentos (solo los que tienen regla en vencimientos.json).
  for (const [docId, desde] of documentosConFecha(registro, checklist, procs)) {
    const regla = base.vencimientos.find((v) => v.documento_id === docId);
    const documento = docs.get(docId);
    if (!regla || !documento) continue;
    const vigencia = vigenciaDeDocumento(documento, base.vencimientos);
    if (vigencia == null) continue;
    const vence = fechaVencimiento(desde, vigencia);
    const dias = diasEntre(hoy, vence);
    if (dias > Math.max(0, ...regla.alertar_dias_antes)) continue; // todavía no toca avisar
    alertas.push({
      id: `vencimiento-${docId}`,
      expediente_id: expedienteId,
      tipo: "vencimiento",
      origen_id: regla.id,
      fecha: vence,
      mensaje: regla.mensaje,
      nivel: nivelPorDias(dias, regla.alertar_dias_antes),
      dias,
    });
  }

  // 2. Plazo para subsanar observaciones (regla con evento "observacion_recibida").
  const subsanar = base.vencimientos.find(
    (v) => v.evento === "observacion_recibida" && v.vigencia_dias_habiles != null,
  );
  if (subsanar?.vigencia_dias_habiles != null) {
    for (const p of registro.expediente.pasos) {
      if (p.estado !== "observado" || !p.fecha_observacion) continue;
      const limite = sumarDiasHabiles(p.fecha_observacion, subsanar.vigencia_dias_habiles, base.feriados);
      const dias = diasHabilesEntre(hoy, limite, base.feriados);
      const nombre = procs.get(p.procedimiento_id)?.nombre ?? p.procedimiento_id;
      alertas.push({
        id: `subsanar-${p.procedimiento_id}`,
        expediente_id: expedienteId,
        tipo: "plazo_subsanacion",
        origen_id: subsanar.id,
        fecha: limite,
        mensaje: `${nombre}: ${subsanar.mensaje}`,
        nivel: nivelPorDias(dias, subsanar.alertar_dias_antes),
        dias,
        habiles: true,
      });
    }
  }

  // 3. Alertas del diagnóstico (reglas.json), vigentes desde que se creó el expediente.
  const creado = registro.expediente.creado_en.slice(0, 10);
  for (const a of alertasDiagnostico) {
    alertas.push({
      id: `regla-${a.id}`,
      expediente_id: expedienteId,
      tipo: "regla",
      origen_id: a.id,
      fecha: creado,
      mensaje: a.mensaje,
      nivel: a.nivel,
    });
  }

  return ordenarAlertas(alertas);
}
