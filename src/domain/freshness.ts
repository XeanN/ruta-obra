// Antigüedad de los datos (Fase 9): un dato "verificado" cuya fuente se consultó hace más de
// N meses (meta.vigencia_verificacion_meses) se muestra como "desactualizado" ("Versión
// anterior"). Solo degrada, nunca mejora un estado. Puro: "hoy" entra como parámetro.
import { addMonths, isAfter, parseISO } from "date-fns";
import type { EstadoVerificacion, Fuente } from "./types";

/** Fecha de hoy (yyyy-mm-dd) y umbral en meses con los que se evalúa la antigüedad. */
export interface Vigencia {
  hoy: string;
  meses: number;
}

/** true si `fechaConsulta` + `meses` ya quedó antes de `hoy` (el día exacto del umbral aún vale). */
export function revisionVencida(fechaConsulta: string | null | undefined, hoy: string, meses: number): boolean {
  if (!fechaConsulta) return false;
  return isAfter(parseISO(hoy), addMonths(parseISO(fechaConsulta), meses));
}

export function estadoEfectivo(
  estado: EstadoVerificacion,
  fechaConsulta: string | null | undefined,
  hoy: string,
  meses: number,
): EstadoVerificacion {
  return estado === "verificado" && revisionVencida(fechaConsulta, hoy, meses) ? "desactualizado" : estado;
}

/**
 * Fecha de revisión de un dato con varias fuentes: la consulta más antigua (criterio
 * conservador: el dato vale lo que su fuente menos revisada). null si no hay fuentes.
 */
export function fechaRevision(fuentes: readonly Pick<Fuente, "fecha_consulta">[]): string | null {
  const fechas = fuentes.map((f) => f.fecha_consulta).filter(Boolean).sort();
  return fechas[0] ?? null;
}

/** Lo que se agrega a un dato mostrado: si se degradó por antigüedad, el umbral superado. */
export interface Antiguedad {
  /** Meses del umbral si el estado se degradó por antigüedad; null en otro caso. */
  antiguedad_meses: number | null;
}

/**
 * Copia del dato con su `estado_verificacion` efectivo según la antigüedad de sus fuentes,
 * y `antiguedad_meses` para explicar la degradación en la UI.
 */
export function conEstadoEfectivo<T extends { estado_verificacion: EstadoVerificacion }>(
  dato: T,
  fuentes: readonly Pick<Fuente, "fecha_consulta">[],
  v: Vigencia,
): T & Antiguedad {
  const estado = estadoEfectivo(dato.estado_verificacion, fechaRevision(fuentes), v.hoy, v.meses);
  const degradado = estado !== dato.estado_verificacion;
  return { ...dato, estado_verificacion: estado, antiguedad_meses: degradado ? v.meses : null };
}

/** Texto de ayuda de la etiqueta "Versión anterior" cuando la causa es la antigüedad. */
export function textoAntiguedad(meses: number): string {
  return `Sin revisar desde hace más de ${meses} meses`;
}

// ---------------------------------------------------------------------------
// Conteo por archivo de data/ (página /fuentes)
// ---------------------------------------------------------------------------

interface ConEstado {
  estado_verificacion: EstadoVerificacion;
}

export interface BaseAntiguedad {
  fuentes: readonly Fuente[];
  procedimientos: readonly (ConEstado & { fuentes: readonly string[] })[];
  tarifas: readonly (ConEstado & { fuente_id: string })[];
  programas: readonly (ConEstado & { fuentes: readonly string[] })[];
  zonas: readonly (ConEstado & { fuentes: readonly string[] })[];
  distritos: readonly (ConEstado & { tupa: { fuente_id?: string | null } })[];
}

export interface VencidosArchivo {
  archivo: string;
  /** Datos marcados como verificados en el archivo. */
  verificados: number;
  /** De ellos, los que ya superaron el umbral de antigüedad. */
  vencidos: number;
}

/** Por cada archivo de data/ con estado de verificación: cuántos verificados vencieron por antigüedad. */
export function vencidosPorArchivo(base: BaseAntiguedad, v: Vigencia): VencidosArchivo[] {
  const fuentes = new Map(base.fuentes.map((f) => [f.id, f]));
  const resolver = (ids: readonly (string | null | undefined)[]) =>
    ids.map((id) => (id ? fuentes.get(id) : undefined)).filter((f): f is Fuente => f !== undefined);

  const contar = <T extends ConEstado>(archivo: string, datos: readonly T[], ids: (d: T) => (string | null | undefined)[]) => {
    const verificados = datos.filter((d) => d.estado_verificacion === "verificado");
    const vencidos = verificados.filter(
      (d) => conEstadoEfectivo(d, resolver(ids(d)), v).antiguedad_meses !== null,
    ).length;
    return { archivo, verificados: verificados.length, vencidos };
  };

  return [
    contar("procedimientos.json", base.procedimientos, (d) => [...d.fuentes]),
    contar("tarifas_distritales.json", base.tarifas, (d) => [d.fuente_id]),
    contar("distritos.json", base.distritos, (d) => [d.tupa.fuente_id]),
    contar("programas.json", base.programas, (d) => [...d.fuentes]),
    contar("zonas_especiales.json", base.zonas, (d) => [...d.fuentes]),
  ];
}
