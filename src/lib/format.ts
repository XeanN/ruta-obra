import { format, parseISO } from "date-fns";

/** Fecha ISO (yyyy-mm-dd) → dd/mm/aaaa. */
export function formatFecha(iso: string): string {
  return format(parseISO(iso), "dd/MM/yyyy");
}

const VARIANTES_ESPECIALES: Record<string, string> = {
  general: "General",
  rango_min: "Mínimo",
  rango_max: "Máximo",
};

/** "C" → "Modalidad C"; "BCD" → "Modalidad B, C o D". */
function textoModalidad(m: string): string {
  const letras = m.split("");
  return letras.length === 1
    ? `Modalidad ${m}`
    : `Modalidad ${letras.slice(0, -1).join(", ")} o ${letras.at(-1)}`;
}

const MODIFICACIONES: Record<string, string> = {
  antes_licencia: "Antes de emitida la licencia",
  no_sustancial: "No sustancial",
  sustancial: "Sustancial",
};

/**
 * Nombre legible de una variante de tarifa (los ids no llevan tildes):
 * "demolicion_3_pisos" → "Demolición 3 pisos"; "comercio_30000m2" → "Comercio 30,000 m²";
 * "BCD" → "Modalidad B, C o D"; "C_con_variaciones" → "Modalidad C, con variaciones";
 * "no_sustancial_B_ru" → "No sustancial, modalidad B (revisores urbanos)".
 */
export function textoVariante(v: string): string {
  const especial = VARIANTES_ESPECIALES[v];
  if (especial) return especial;
  if (/^[A-D]+$/.test(v)) return textoModalidad(v);
  const conVariaciones = /^([A-D]+)_con_variaciones$/.exec(v);
  if (conVariaciones?.[1]) return `${textoModalidad(conVariaciones[1])}, con variaciones`;
  const modificacion = /^(antes_licencia|no_sustancial|sustancial)_([A-D]+)(_ru)?$/.exec(v);
  if (modificacion?.[1] && modificacion[2]) {
    const ru = modificacion[3] ? " (revisores urbanos)" : "";
    return `${MODIFICACIONES[modificacion[1]]}, ${textoModalidad(modificacion[2]).toLowerCase().replace(/ ([a-d])\b/g, (l) => l.toUpperCase())}${ru}`;
  }
  const t = v
    .replace(/_/g, " ")
    .replace(/cion\b/g, "ción")
    .replace(/\bdemas\b/g, "demás")
    .replace(/\bmas\b/g, "más de")
    .replace(/\bespectaculos\b/g, "espectáculos")
    .replace(/(\d+)m2\b/g, "$1 m²")
    .replace(/\b(\d{1,3})(\d{3}) m²/g, "$1,$2 m²");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** "arquitecto_colegiado" → "Arquitecto colegiado". */
export function textoProfesional(p: string): string {
  const t = p.replace(/_/g, " ");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Monto → S/ 1,234.50 */
export function formatSoles(monto: number): string {
  return `S/ ${new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(monto)}`;
}
