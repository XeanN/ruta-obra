// Bitácora de obra (F6): entradas fechadas del día a día y sus totales. Puro: "ahora" entra
// como parámetro; las fotos son ids de archivos (el almacenamiento vive fuera del dominio).
import type { EntradaBitacora, ExpedienteRegistro } from "./types";

export type TipoEntrada = EntradaBitacora["tipo"];

export const ETIQUETA_TIPO_ENTRADA: Record<TipoEntrada, string> = {
  avance: "Avance",
  compra: "Compra",
  pago: "Pago",
  visita_municipal: "Visita municipal",
  reunion: "Reunión",
  incidencia: "Incidencia",
  cambio_de_obra: "Cambio de obra",
  otro: "Otro",
};

const conBitacora = (r: ExpedienteRegistro, bitacora: EntradaBitacora[], ahora: string): ExpedienteRegistro => ({
  ...r,
  expediente: { ...r.expediente, bitacora, actualizado_en: ahora },
});

export function agregarEntrada(r: ExpedienteRegistro, entrada: EntradaBitacora, ahora: string): ExpedienteRegistro {
  const actuales = r.expediente.bitacora ?? [];
  if (actuales.some((e) => e.id === entrada.id)) throw new Error(`Ya existe la entrada ${entrada.id}`);
  return conBitacora(r, [...actuales, entrada], ahora);
}

export function actualizarEntrada(r: ExpedienteRegistro, entrada: EntradaBitacora, ahora: string): ExpedienteRegistro {
  const actuales = r.expediente.bitacora ?? [];
  if (!actuales.some((e) => e.id === entrada.id)) throw new Error(`No existe la entrada ${entrada.id}`);
  return conBitacora(r, actuales.map((e) => (e.id === entrada.id ? entrada : e)), ahora);
}

/** Devuelve el registro sin la entrada y las fotos que quedaron huérfanas (para borrarlas). */
export function eliminarEntrada(
  r: ExpedienteRegistro,
  id: string,
  ahora: string,
): { registro: ExpedienteRegistro; fotosEliminadas: string[] } {
  const actuales = r.expediente.bitacora ?? [];
  const entrada = actuales.find((e) => e.id === id);
  if (!entrada) throw new Error(`No existe la entrada ${id}`);
  return {
    registro: conBitacora(r, actuales.filter((e) => e.id !== id), ahora),
    fotosEliminadas: entrada.fotos ?? [],
  };
}

/** Fotos que estaban en la entrada anterior y ya no están en la nueva (al editar). */
export function fotosQuitadas(antes: EntradaBitacora, despues: EntradaBitacora): string[] {
  const quedan = new Set(despues.fotos ?? []);
  return (antes.fotos ?? []).filter((f) => !quedan.has(f));
}

// ---------------------------------------------------------------------------
// Vista: orden, filtros y agrupación
// ---------------------------------------------------------------------------

/** Más reciente primero; a igual fecha, la registrada después primero. */
export function ordenarEntradas(entradas: readonly EntradaBitacora[]): EntradaBitacora[] {
  return entradas
    .map((e, i) => ({ e, i }))
    .sort((a, b) => b.e.fecha.localeCompare(a.e.fecha) || b.i - a.i)
    .map(({ e }) => e);
}

export interface FiltroBitacora {
  tipo?: TipoEntrada;
  actorId?: string;
}

export function filtrarEntradas(entradas: readonly EntradaBitacora[], f: FiltroBitacora): EntradaBitacora[] {
  return entradas.filter((e) => (!f.tipo || e.tipo === f.tipo) && (!f.actorId || e.actor_id === f.actorId));
}

/** Mes de una fecha yyyy-mm-dd como "yyyy-mm". */
export const mesDe = (fecha: string) => fecha.slice(0, 7);

export function agruparPorMes(entradas: readonly EntradaBitacora[]): { mes: string; entradas: EntradaBitacora[] }[] {
  const grupos: { mes: string; entradas: EntradaBitacora[] }[] = [];
  for (const e of ordenarEntradas(entradas)) {
    const mes = mesDe(e.fecha);
    const ultimo = grupos.at(-1);
    if (ultimo?.mes === mes) ultimo.entradas.push(e);
    else grupos.push({ mes, entradas: [e] });
  }
  return grupos;
}

// ---------------------------------------------------------------------------
// Totales
// ---------------------------------------------------------------------------

const centavos = (n: number) => Math.round(n * 100) / 100;

export interface TotalesBitacora {
  /** Suma de todos los montos. */
  total: number;
  /** Suma por tipo, solo los tipos con monto, de mayor a menor. */
  porTipo: { tipo: TipoEntrada; total: number }[];
  /** Suma por mes, del más reciente al más antiguo. */
  porMes: { mes: string; total: number }[];
  /** Último % de avance registrado (por fecha). */
  ultimoAvance: { pct: number; fecha: string } | null;
  entradas: number;
  entradasConMonto: number;
}

export function totalesBitacora(entradas: readonly EntradaBitacora[]): TotalesBitacora {
  const porTipo = new Map<TipoEntrada, number>();
  const porMes = new Map<string, number>();
  let total = 0;
  let conMonto = 0;
  for (const e of entradas) {
    if (e.monto === undefined) continue;
    conMonto++;
    total += e.monto;
    porTipo.set(e.tipo, (porTipo.get(e.tipo) ?? 0) + e.monto);
    porMes.set(mesDe(e.fecha), (porMes.get(mesDe(e.fecha)) ?? 0) + e.monto);
  }
  const conAvance = ordenarEntradas(entradas).find((e) => e.avance_pct !== undefined);
  return {
    total: centavos(total),
    porTipo: [...porTipo]
      .map(([tipo, t]) => ({ tipo, total: centavos(t) }))
      .sort((a, b) => b.total - a.total),
    porMes: [...porMes].map(([mes, t]) => ({ mes, total: centavos(t) })).sort((a, b) => b.mes.localeCompare(a.mes)),
    ultimoAvance:
      conAvance?.avance_pct !== undefined ? { pct: conAvance.avance_pct, fecha: conAvance.fecha } : null,
    entradas: entradas.length,
    entradasConMonto: conMonto,
  };
}
