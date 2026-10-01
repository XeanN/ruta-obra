// Expedientes (F5): creación, cambios de pasos y documentos, migración cuando cambian los
// datos, y el resumen que muestra el tablero. Puro: ids, "hoy" y "ahora" entran como parámetros.
import type { AlertaExpediente } from "./alerts";
import type { Diagnostico } from "./rules-engine";
import type {
  Actor,
  DocumentoCargado,
  Etapa,
  EstadoPaso,
  ExpedienteRegistro,
  Modalidad,
  Paso,
  Predio,
  Respuestas,
} from "./types";

/** Un paso cerrado ya no requiere acción. */
export const ESTADOS_CERRADOS: readonly EstadoPaso[] = ["aprobado", "no_aplica"];

export const ETIQUETA_ESTADO_PASO: Record<EstadoPaso, string> = {
  pendiente: "Pendiente",
  en_preparacion: "En preparación",
  presentado: "Presentado",
  observado: "Observado",
  subsanado: "Subsanado",
  aprobado: "Aprobado",
  denegado: "Denegado",
  no_aplica: "No aplica",
};

export const pasoCerrado = (p: Pick<Paso, "estado">) => ESTADOS_CERRADOS.includes(p.estado);

export interface NuevoExpediente {
  id: string;
  predioId: string;
  nombre: string;
  respuestas: Respuestas;
  predio: Omit<Predio, "id">;
  actores: Actor[];
  diagnostico: Diagnostico;
  versionDatos: string;
  /** Fecha y hora ISO con zona (creado_en). */
  ahora: string;
}

function pasosDesdeDiagnostico(diagnostico: Diagnostico): Paso[] {
  return diagnostico.pasos.map((p) => ({
    procedimiento_id: p.procedimiento_id,
    etapa_id: p.etapa_id,
    estado: "pendiente",
  }));
}

export function crearRegistro(n: NuevoExpediente): ExpedienteRegistro {
  return {
    predio: { id: n.predioId, ...n.predio },
    expediente: {
      id: n.id,
      predio_id: n.predioId,
      nombre: n.nombre,
      respuestas_diagnostico: n.respuestas,
      modalidad: n.diagnostico.modalidad,
      version_datos: n.versionDatos,
      actores: n.actores,
      pasos: pasosDesdeDiagnostico(n.diagnostico),
      documentos: [],
      bitacora: [],
      creado_en: n.ahora,
      actualizado_en: n.ahora,
    },
  };
}

/**
 * Si el expediente se generó con otra versión de los datos, recalcula los pasos con el
 * diagnóstico actual y conserva el avance de los pasos que siguen existiendo. Un paso que ya
 * no aplica se conserva solo si tenía avance (no se pierde información); si estaba pendiente,
 * se quita.
 */
export function migrarRegistro(
  registro: ExpedienteRegistro,
  diagnostico: Diagnostico,
  versionDatos: string,
  ahora: string,
): ExpedienteRegistro {
  const e = registro.expediente;
  if (e.version_datos === versionDatos) return registro;

  const anteriores = new Map(e.pasos.map((p) => [p.procedimiento_id, p]));
  const nuevos = pasosDesdeDiagnostico(diagnostico).map((p) => {
    const previo = anteriores.get(p.procedimiento_id);
    return previo ? { ...previo, etapa_id: p.etapa_id } : p;
  });
  const vigentes = new Set(nuevos.map((p) => p.procedimiento_id));
  const conAvance = e.pasos.filter(
    (p) => !vigentes.has(p.procedimiento_id) && p.estado !== "pendiente",
  );

  return {
    ...registro,
    expediente: {
      ...e,
      modalidad: diagnostico.modalidad,
      version_datos: versionDatos,
      pasos: [...nuevos, ...conAvance],
      actualizado_en: ahora,
    },
  };
}

export type CambiosPaso = Partial<Omit<Paso, "procedimiento_id" | "etapa_id">>;

/**
 * Aplica cambios a un paso. Si el estado pasa a presentado, observado o a un resultado y no se
 * indicó la fecha correspondiente, usa "hoy" (así la alerta de subsanación siempre tiene base).
 */
export function actualizarPaso(
  registro: ExpedienteRegistro,
  procedimientoId: string,
  cambios: CambiosPaso,
  hoy: string,
  ahora: string,
): ExpedienteRegistro {
  const e = registro.expediente;
  if (!e.pasos.some((p) => p.procedimiento_id === procedimientoId)) {
    throw new Error(`El expediente no tiene el paso ${procedimientoId}`);
  }
  const pasos = e.pasos.map((p) => {
    if (p.procedimiento_id !== procedimientoId) return p;
    const nuevo: Paso = { ...p, ...cambios };
    if (cambios.estado && cambios.estado !== p.estado) {
      if (nuevo.estado === "presentado") nuevo.fecha_presentacion ??= hoy;
      if (nuevo.estado === "observado") nuevo.fecha_observacion ??= hoy;
      if (nuevo.estado === "aprobado" || nuevo.estado === "denegado") nuevo.fecha_resultado ??= hoy;
    }
    return nuevo;
  });
  return { ...registro, expediente: { ...e, pasos, actualizado_en: ahora } };
}

export type CambiosDocumento = Partial<Omit<DocumentoCargado, "id" | "documento_id">>;

/** Crea o actualiza el estado de un documento del checklist. */
export function actualizarDocumento(
  registro: ExpedienteRegistro,
  documentoId: string,
  cambios: CambiosDocumento,
  ahora: string,
): ExpedienteRegistro {
  const e = registro.expediente;
  const documentos = e.documentos ?? [];
  const existente = documentos.find((d) => d.documento_id === documentoId);
  const actualizado: DocumentoCargado = {
    ...(existente ?? { id: `doc-${documentoId}`, documento_id: documentoId, estado: "falta" }),
    ...cambios,
  };
  return {
    ...registro,
    expediente: {
      ...e,
      documentos: existente
        ? documentos.map((d) => (d.documento_id === documentoId ? actualizado : d))
        : [...documentos, actualizado],
      actualizado_en: ahora,
    },
  };
}

export interface DatosExpediente {
  nombre: string;
  predio: Omit<Predio, "id">;
  actores: Actor[];
}

export function actualizarDatos(
  registro: ExpedienteRegistro,
  datos: DatosExpediente,
  ahora: string,
): ExpedienteRegistro {
  return {
    predio: { ...datos.predio, id: registro.predio.id },
    expediente: {
      ...registro.expediente,
      nombre: datos.nombre,
      actores: datos.actores,
      actualizado_en: ahora,
    },
  };
}

// ---------------------------------------------------------------------------
// Resumen para el tablero
// ---------------------------------------------------------------------------

export type EstadoExpediente = "en_curso" | "con_alertas" | "terminado";

export const ETIQUETA_ESTADO_EXPEDIENTE: Record<EstadoExpediente, string> = {
  en_curso: "En curso",
  con_alertas: "Con alertas",
  terminado: "Terminado",
};

export interface ResumenExpediente {
  modalidad: Modalidad | null;
  avance: { cerrados: number; total: number; porcentaje: number };
  etapaActual: Etapa | null;
  proximoPaso: Paso | null;
  proximasAlertas: AlertaExpediente[];
  estado: EstadoExpediente;
}

/**
 * @param opcionales ids de procedimientos opcionales (no cuentan para el avance).
 * @param alertas ya ordenadas por prioridad (ver ordenarAlertas en alerts.ts).
 */
export function resumirExpediente(
  registro: ExpedienteRegistro,
  opcionales: ReadonlySet<string>,
  etapas: readonly Etapa[],
  alertas: readonly AlertaExpediente[],
): ResumenExpediente {
  const e = registro.expediente;
  const obligatorios = e.pasos.filter((p) => !opcionales.has(p.procedimiento_id));
  const cerrados = obligatorios.filter(pasoCerrado).length;
  const total = obligatorios.length;
  const proximoPaso = obligatorios.find((p) => !pasoCerrado(p)) ?? null;
  const etapaActual = proximoPaso
    ? (etapas.find((et) => et.id === proximoPaso.etapa_id) ?? null)
    : null;
  const terminado = total > 0 && cerrados === total;
  // Solo las alertas con plazo cambian el estado; las advertencias del diagnóstico son fijas.
  const urgentes = alertas.some(
    (a) => a.tipo !== "regla" && (a.nivel === "critica" || a.nivel === "alta"),
  );

  return {
    modalidad: e.modalidad,
    avance: { cerrados, total, porcentaje: total === 0 ? 0 : Math.round((cerrados / total) * 100) },
    etapaActual,
    proximoPaso,
    proximasAlertas: alertas.slice(0, 3),
    estado: terminado ? "terminado" : urgentes ? "con_alertas" : "en_curso",
  };
}
