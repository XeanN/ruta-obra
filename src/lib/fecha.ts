/** Fecha de hoy en Lima (yyyy-mm-dd), para el servidor: en Vercel el reloj está en UTC. */
export function hoyEnLima(ahora: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(ahora);
}
