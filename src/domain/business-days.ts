// Días hábiles: lunes a viernes, menos los feriados que se pasen (fechas ISO yyyy-MM-dd).
// Los feriados nacionales se cargarán en una fase posterior; por ahora la lista es opcional.
import { addDays, format, isValid, isWeekend, parseISO } from "date-fns";

const FORMATO_ISO = "yyyy-MM-dd";

function parseFecha(fecha: string): Date {
  const d = parseISO(fecha);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !isValid(d)) {
    throw new Error(`Fecha inválida (se espera yyyy-mm-dd): ${fecha}`);
  }
  return d;
}

export function esDiaHabil(
  fecha: string,
  feriados: readonly string[] = [],
): boolean {
  return !isWeekend(parseFecha(fecha)) && !feriados.includes(fecha);
}

/**
 * Suma `dias` hábiles a `fecha` (pueden ser negativos). Con 0 devuelve la misma fecha.
 * Ej.: observación recibida el viernes 02/10/2026 + 5 hábiles = viernes 09/10/2026.
 */
export function sumarDiasHabiles(
  fecha: string,
  dias: number,
  feriados: readonly string[] = [],
): string {
  if (!Number.isInteger(dias)) {
    throw new Error(`Los días hábiles deben ser un entero: ${dias}`);
  }
  let actual = parseFecha(fecha);
  const paso = dias < 0 ? -1 : 1;
  let restantes = Math.abs(dias);
  while (restantes > 0) {
    actual = addDays(actual, paso);
    if (esDiaHabil(format(actual, FORMATO_ISO), feriados)) restantes--;
  }
  return format(actual, FORMATO_ISO);
}

/**
 * Días hábiles entre `desde` (excluido) y `hasta` (incluido).
 * Negativo si `hasta` es anterior a `desde` (p. ej. un plazo ya vencido).
 */
export function diasHabilesEntre(
  desde: string,
  hasta: string,
  feriados: readonly string[] = [],
): number {
  const inicio = parseFecha(desde);
  const fin = parseFecha(hasta);
  const paso = fin < inicio ? -1 : 1;
  let actual = inicio;
  let total = 0;
  while (format(actual, FORMATO_ISO) !== format(fin, FORMATO_ISO)) {
    actual = addDays(actual, paso);
    // Hacia atrás se cuenta el día de partida, no el de llegada, para ser simétrico.
    const contado = paso === 1 ? actual : addDays(actual, 1);
    if (esDiaHabil(format(contado, FORMATO_ISO), feriados)) total += paso;
  }
  return total;
}
