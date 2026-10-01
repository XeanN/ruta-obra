// Modo demo: arma expedientes de ejemplo (fixtures/demo.json) con fechas relativas a "hoy",
// para que las alertas y plazos se vean igual el día que se cargue la demo. Puro.
import { format, parseISO, subDays } from "date-fns";
import { z } from "zod";
import { crearRegistro } from "./expediente";
import { diagnosticar, type BaseReglas } from "./rules-engine";
import { ActorSchema, EntradaBitacoraSchema, EstadoPasoSchema, PredioSchema, RespuestasSchema } from "./schemas";
import type { EntradaBitacora, ExpedienteRegistro, Paso } from "./types";

/** Los ids de la demo empiezan así: permite reconocerlos, reemplazarlos y borrarlos. */
export const PREFIJO_DEMO = "demo-";
export const esDemo = (id: string) => id.startsWith(PREFIJO_DEMO);

const Dias = z.number().int().nonnegative();

const PasoDemoSchema = z.strictObject({
  procedimiento_id: z.string(),
  estado: EstadoPasoSchema,
  presentado_hace_dias: Dias.optional(),
  observado_hace_dias: Dias.optional(),
  resultado_hace_dias: Dias.optional(),
  numero_expediente_entidad: z.string().optional(),
  monto_pagado: z.number().nonnegative().optional(),
  notas: z.string().optional(),
});

const EntradaDemoSchema = EntradaBitacoraSchema.pick({
  tipo: true,
  descripcion: true,
  monto: true,
  avance_pct: true,
}).extend({ hace_dias: Dias });

export const ExpedienteDemoSchema = z.strictObject({
  clave: z.string().regex(/^[a-z0-9-]+$/),
  caso: z.string(),
  nombre: z.string(),
  creado_hace_dias: Dias,
  predio: PredioSchema.omit({ id: true, ubigeo: true }),
  actores: z.array(ActorSchema),
  pasos: z.array(PasoDemoSchema),
  bitacora: z.array(EntradaDemoSchema),
});

export const DemoSchema = z.object({ expedientes: z.array(ExpedienteDemoSchema) });

/** Quita las claves con undefined (el registro se guarda tal cual en JSON). */
const sinIndefinidos = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

export type ExpedienteDemo = z.infer<typeof ExpedienteDemoSchema>;

/** Definición de la demo con las respuestas del caso ya resueltas. */
export interface DefinicionDemo extends ExpedienteDemo {
  respuestas: z.infer<typeof RespuestasSchema>;
}

/** Une cada expediente de la demo con las respuestas de su caso en fixtures/casos.json. */
export function resolverDemo(
  demo: unknown,
  casos: readonly { id: string; respuestas: unknown }[],
): DefinicionDemo[] {
  return DemoSchema.parse(demo).expedientes.map((d) => {
    const caso = casos.find((c) => c.id === d.caso);
    if (!caso) throw new Error(`Demo ${d.clave}: no existe el caso ${d.caso}`);
    return { ...d, respuestas: RespuestasSchema.parse(caso.respuestas) };
  });
}

/**
 * Arma los registros de la demo. `hoy` es yyyy-mm-dd (fecha local). Falla si un paso de la demo
 * ya no sale en el diagnóstico de su caso: así un cambio en data/ que rompa la demo se ve en CI.
 */
export function armarExpedientesDemo(
  definiciones: readonly DefinicionDemo[],
  base: BaseReglas & { versionDatos: string },
  hoy: string,
): ExpedienteRegistro[] {
  const fecha = (dias: number) => format(subDays(parseISO(hoy), dias), "yyyy-MM-dd");
  const fechaHora = (dias: number) => `${fecha(dias)}T09:00:00-05:00`;
  const opc = (dias: number | undefined) => (dias === undefined ? undefined : fecha(dias));

  return definiciones.map((d) => {
    const id = `${PREFIJO_DEMO}${d.clave}`;
    const registro = crearRegistro({
      id,
      predioId: `${PREFIJO_DEMO}predio-${d.clave}`,
      nombre: d.nombre,
      respuestas: d.respuestas,
      predio: { ...d.predio, ubigeo: String(d.respuestas.distrito ?? "") },
      actores: d.actores,
      diagnostico: diagnosticar(d.respuestas, base),
      versionDatos: base.versionDatos,
      ahora: fechaHora(d.creado_hace_dias),
    });

    const pasos = new Map(registro.expediente.pasos.map((p) => [p.procedimiento_id, p]));
    for (const p of d.pasos) {
      const actual = pasos.get(p.procedimiento_id);
      if (!actual) throw new Error(`Demo ${d.clave}: ${p.procedimiento_id} no está en el diagnóstico de ${d.caso}`);
      const paso: Paso = {
        ...actual,
        estado: p.estado,
        numero_expediente_entidad: p.numero_expediente_entidad,
        fecha_presentacion: opc(p.presentado_hace_dias),
        fecha_observacion: opc(p.observado_hace_dias),
        fecha_resultado: opc(p.resultado_hace_dias),
        monto_pagado: p.monto_pagado,
        notas: p.notas,
      };
      pasos.set(p.procedimiento_id, sinIndefinidos(paso));
    }

    const bitacora = d.bitacora.map(({ hace_dias, ...e }, i): EntradaBitacora =>
      sinIndefinidos({ id: `${id}-b${i + 1}`, fecha: fecha(hace_dias), ...e }),
    );

    // Última actividad: lo más reciente entre pasos y bitácora (ordena el tablero).
    const hace = [
      d.creado_hace_dias,
      ...d.pasos.flatMap((p) => [p.presentado_hace_dias, p.observado_hace_dias, p.resultado_hace_dias]),
      ...d.bitacora.map((e) => e.hace_dias),
    ].filter((n): n is number => n !== undefined);

    return {
      ...registro,
      expediente: {
        ...registro.expediente,
        pasos: [...pasos.values()],
        bitacora,
        actualizado_en: fechaHora(Math.min(...hace)),
      },
    };
  });
}
