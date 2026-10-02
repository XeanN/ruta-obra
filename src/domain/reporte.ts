// "¿Este dato cambió? Repórtalo" (Fase 9): arma el enlace a un formulario externo o a un
// correo con los datos del dato prellenados. Sin backend y sin datos personales: la app solo
// arma el enlace; el reporte pasa a un issue "vigilancia-datos" y luego a un PR data:.
import type { Respuestas } from "./types";

/** Lo que se envía de un dato mostrado. Todo es público (nada del usuario). */
export interface DatoReportado {
  procedimientoId: string;
  ubigeo: string | null;
  variante: string | null;
  /** Monto tal como se mostró ("S/ 1,234.50", "Consultar TUPA"). */
  montoMostrado: string | null;
  /** URL pública de la página donde se vio el dato. */
  pagina: string;
}

export interface DestinoReporte {
  /**
   * NEXT_PUBLIC_REPORTE_URL. Si trae marcadores ({procedimiento}, {ubigeo}, {variante},
   * {monto}, {pagina}) se reemplazan, lo que sirve para los campos prellenados de Google
   * Forms (entry.N={procedimiento}); si no, los datos se agregan como parámetros.
   */
  formularioUrl?: string | null;
  /** Correo de respaldo cuando no hay formulario. */
  correo: string;
}

const MARCADORES = ["procedimiento", "ubigeo", "variante", "monto", "pagina"] as const;

function valores(d: DatoReportado): Record<(typeof MARCADORES)[number], string> {
  return {
    procedimiento: d.procedimientoId,
    ubigeo: d.ubigeo ?? "",
    variante: d.variante ?? "",
    monto: d.montoMostrado ?? "",
    pagina: d.pagina,
  };
}

export function enlaceReporte(d: DatoReportado, destino: DestinoReporte): string {
  const v = valores(d);
  const formulario = destino.formularioUrl?.trim();
  if (formulario) {
    if (/\{(procedimiento|ubigeo|variante|monto|pagina)\}/.test(formulario)) {
      return formulario.replace(
        /\{(procedimiento|ubigeo|variante|monto|pagina)\}/g,
        (_, k: (typeof MARCADORES)[number]) => encodeURIComponent(v[k]),
      );
    }
    const url = new URL(formulario);
    for (const k of MARCADORES) if (v[k]) url.searchParams.set(k, v[k]);
    return url.toString();
  }

  const cuerpo = [
    "Hola, encontré un dato que parece desactualizado en RutaObra.",
    "",
    `Procedimiento: ${v.procedimiento}`,
    ...(v.ubigeo ? [`Distrito (ubigeo): ${v.ubigeo}`] : []),
    ...(v.variante ? [`Variante: ${v.variante}`] : []),
    ...(v.monto ? [`Monto mostrado: ${v.monto}`] : []),
    `Página: ${v.pagina}`,
    "",
    "¿Qué viste? (monto, requisito o plazo vigente y dónde lo viste):",
    "",
  ].join("\n");
  // encodeURIComponent y no URLSearchParams: los clientes de correo muestran "+" en vez de espacios.
  const asunto = `Dato desactualizado: ${v.procedimiento}${v.ubigeo ? ` (${v.ubigeo})` : ""}`;
  return `mailto:${destino.correo}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`;
}

/** URL pública de la hoja de ruta de unas respuestas (la que se cita al reportar un dato). */
export function urlHojaDeRuta(sitio: string, respuestas: Respuestas): string {
  const params = new URLSearchParams();
  for (const [k, valor] of Object.entries(respuestas)) {
    if (valor !== null && valor !== undefined) params.set(k, String(valor));
  }
  const q = params.toString();
  return `${sitio.replace(/\/$/, "")}/diagnostico/hoja-de-ruta${q ? `?${q}` : ""}`;
}
