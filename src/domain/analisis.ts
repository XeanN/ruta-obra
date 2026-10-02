// Todo lo que se deriva de un expediente guardado, en un solo lugar: diagnóstico vigente,
// hoja de ruta, checklist, alertas y resumen. Lo usan el tablero y el detalle.
import { generarAlertas, type AlertaExpediente, type BaseAlertas } from "./alerts";
import { armarChecklist, type BaseChecklist, type ItemChecklist } from "./checklist";
import { migrarRegistro, resumirExpediente, type ResumenExpediente } from "./expediente";
import { armarHojaDeRuta, ubigeoDeRespuestas, type BaseHojaDeRuta, type HojaDeRuta } from "./roadmap";
import { diagnosticar, type BaseReglas, type Diagnostico } from "./rules-engine";
import type { ExpedienteRegistro } from "./types";

/** Base de conocimiento que necesitan los expedientes (serializable: viaja del servidor al cliente). */
export interface BaseExpedientes extends BaseReglas, BaseHojaDeRuta, BaseChecklist, BaseAlertas {
  versionDatos: string;
}

export interface AnalisisExpediente {
  registro: ExpedienteRegistro;
  /** true si el registro se migró a la versión actual de los datos y conviene guardarlo. */
  migrado: boolean;
  diagnostico: Diagnostico;
  hoja: HojaDeRuta;
  opcionales: Set<string>;
  checklist: ItemChecklist[];
  alertas: AlertaExpediente[];
  resumen: ResumenExpediente;
}

export function analizarExpediente(
  original: ExpedienteRegistro,
  base: BaseExpedientes,
  hoy: string,
  ahora: string,
): AnalisisExpediente {
  const respuestas = original.expediente.respuestas_diagnostico;
  const diagnostico = diagnosticar(respuestas, base);
  const registro = migrarRegistro(original, diagnostico, base.versionDatos, ahora);
  const opcionales = new Set(diagnostico.pasos.filter((p) => p.opcional).map((p) => p.procedimiento_id));
  const hoja = armarHojaDeRuta(diagnostico, ubigeoDeRespuestas(respuestas.distrito), base, hoy);
  const checklist = armarChecklist(registro, opcionales, base, hoy);
  const alertas = generarAlertas(registro, checklist, diagnostico.alertas, base, hoy);
  const resumen = resumirExpediente(registro, opcionales, base.etapas, alertas);
  return {
    registro,
    migrado: registro !== original,
    diagnostico,
    hoja,
    opcionales,
    checklist,
    alertas,
    resumen,
  };
}
