import { format, parseISO } from "date-fns";

/** Fecha ISO (yyyy-mm-dd) → dd/mm/aaaa. */
export function formatFecha(iso: string): string {
  return format(parseISO(iso), "dd/MM/yyyy");
}

/** Monto → S/ 1,234.50 */
export function formatSoles(monto: number): string {
  return `S/ ${new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(monto)}`;
}
