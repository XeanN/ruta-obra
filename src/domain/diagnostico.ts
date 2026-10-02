// Lógica del asistente de diagnóstico (F1): qué preguntas se muestran, cómo se validan
// las respuestas, cómo viajan en la URL y cómo se resume el resultado del motor.
import { z } from "zod";
import { conEstadoEfectivo, type Antiguedad, type Vigencia } from "./freshness";
import {
  cumple,
  diagnosticar,
  type AlertaDiagnostico,
  type BaseReglas,
  type Diagnostico,
  type RespuestasDiagnostico,
} from "./rules-engine";
import type {
  EstadoVerificacion,
  Fuente,
  Modalidad,
  Pregunta,
  Procedimiento,
  Programa,
  Regla,
  Respuestas,
  Valor,
} from "./types";

// ---------------------------------------------------------------------------
// Preguntas visibles
// ---------------------------------------------------------------------------

export function preguntaVisible(p: Pregunta, r: RespuestasDiagnostico): boolean {
  const m = p.mostrar_si;
  if (!m) return true;
  return "igual" in m
    ? cumple({ campo: m.pregunta, igual: m.igual }, r)
    : cumple({ campo: m.pregunta, en: m.en }, r);
}

export function preguntasVisibles(
  preguntas: readonly Pregunta[],
  r: RespuestasDiagnostico,
): Pregunta[] {
  return preguntas.filter((p) => preguntaVisible(p, r));
}

/**
 * Deja solo respuestas de preguntas conocidas y visibles. Repite hasta estabilizar,
 * porque ocultar una pregunta puede ocultar otra que dependía de ella.
 */
export function limpiarRespuestas(
  preguntas: readonly Pregunta[],
  r: RespuestasDiagnostico,
): Respuestas {
  let actual: Respuestas = {};
  for (const p of preguntas) {
    const v = r[p.id];
    if (v !== undefined && v !== null) actual[p.id] = v;
  }
  for (;;) {
    const visibles = new Set(preguntasVisibles(preguntas, actual).map((p) => p.id));
    const siguiente = Object.fromEntries(
      Object.entries(actual).filter(([id]) => visibles.has(id)),
    );
    if (Object.keys(siguiente).length === Object.keys(actual).length) return actual;
    actual = siguiente;
  }
}

/** Preguntas visibles y obligatorias que todavía no tienen respuesta válida. */
export function preguntasFaltantes(
  preguntas: readonly Pregunta[],
  r: RespuestasDiagnostico,
): Pregunta[] {
  return preguntasVisibles(preguntas, r).filter(
    (p) => p.obligatoria && !validarRespuesta(p, r[p.id]).ok,
  );
}

// ---------------------------------------------------------------------------
// Validación
// ---------------------------------------------------------------------------

type ValorRespuesta = string | number | undefined;

export function esquemaRespuesta(p: Pregunta): z.ZodType<ValorRespuesta, ValorRespuesta> {
  if (p.tipo === "opcion") {
    const valores = p.opciones.map((o) => o.valor);
    const base = z
      .string({ error: "Elige una opción" })
      .refine((v) => valores.includes(v), "Elige una opción de la lista");
    return p.obligatoria ? base : base.optional();
  }
  let base = z.number({ error: "Ingresa un número" });
  if (p.min !== undefined) base = base.min(p.min, `Debe ser al menos ${p.min}`);
  if (p.max !== undefined) base = base.max(p.max, `Debe ser como máximo ${p.max}`);
  return p.obligatoria ? base : base.optional();
}

export type ResultadoValidacion =
  | { ok: true; valor: string | number | undefined }
  | { ok: false; error: string };

export function validarRespuesta(
  p: Pregunta,
  valor: Valor | undefined,
): ResultadoValidacion {
  const res = esquemaRespuesta(p).safeParse(valor ?? undefined);
  if (res.success) return { ok: true, valor: res.data };
  return { ok: false, error: res.error.issues[0]?.message ?? "Respuesta inválida" };
}

// ---------------------------------------------------------------------------
// URL: las respuestas viajan como query string para no perderlas al recargar
// y para poder compartir el resultado.
// ---------------------------------------------------------------------------

export type ParamsUrl = Readonly<Record<string, string | string[] | undefined>>;

/** Lee y valida respuestas desde la URL. Descarta valores inválidos u ocultos. */
export function respuestasDesdeParams(
  preguntas: readonly Pregunta[],
  params: ParamsUrl,
): Respuestas {
  const r: Respuestas = {};
  for (const p of preguntas) {
    const crudo = params[p.id];
    const texto = Array.isArray(crudo) ? crudo[0] : crudo;
    if (texto === undefined || texto === "") continue;
    const valor = p.tipo === "numero" ? Number(texto) : texto;
    const v = validarRespuesta(p, valor);
    if (v.ok && v.valor !== undefined) r[p.id] = v.valor;
  }
  return limpiarRespuestas(preguntas, r);
}

/** Query string con las respuestas, en el orden de las preguntas. */
export function respuestasAParams(
  preguntas: readonly Pregunta[],
  r: RespuestasDiagnostico,
): URLSearchParams {
  const params = new URLSearchParams();
  for (const p of preguntas) {
    const v = r[p.id];
    if (v !== undefined && v !== null) params.set(p.id, String(v));
  }
  return params;
}

// ---------------------------------------------------------------------------
// Resultado
// ---------------------------------------------------------------------------

export const NIVELES_ALERTA = ["critica", "alta", "media", "baja"] as const;
export type NivelAlerta = (typeof NIVELES_ALERTA)[number];

export const ETIQUETA_NIVEL: Record<NivelAlerta, string> = {
  critica: "Crítica",
  alta: "Alta",
  media: "Media",
  baja: "Baja",
};

/** Etiqueta que acompaña a todo dato mostrado (regla 4 de CLAUDE.md). */
export const ETIQUETA_VERIFICACION: Record<EstadoVerificacion, string> = {
  verificado: "Verificado",
  fuente_secundaria: "Referencial",
  desactualizado: "Versión anterior",
  por_verificar: "Por confirmar",
};

export interface BaseResumen extends BaseReglas {
  programas: readonly Programa[];
  fuentes: readonly Fuente[];
  /** meta.vigencia_verificacion_meses (antigüedad máxima de un dato verificado). */
  vigenciaMeses: number;
}

export interface ModalidadExplicada {
  modalidad: Modalidad;
  /** Regla de reglas.json que decidió la modalidad. */
  regla: Extract<Regla, { tipo: "modalidad" }>;
  /** Procedimiento de licencia de esa modalidad (alcance, plazo, fuentes), con su estado efectivo. */
  licencia: (Procedimiento & Antiguedad) | undefined;
  /** Fuentes de la regla y de la licencia, sin duplicados. */
  fuentes: string[];
}

export interface ResumenDiagnostico {
  diagnostico: Diagnostico;
  modalidad: ModalidadExplicada | null;
  alertasPorNivel: { nivel: NivelAlerta; alertas: AlertaDiagnostico[] }[];
  /** Programas que aplican, con su estado efectivo según la antigüedad de sus fuentes. */
  programas: (Programa & Antiguedad)[];
}

function reglaDeModalidad(
  reglas: readonly Regla[],
  r: RespuestasDiagnostico,
): Extract<Regla, { tipo: "modalidad" }> | undefined {
  return reglas
    .filter((x): x is Extract<Regla, { tipo: "modalidad" }> => x.tipo === "modalidad")
    .sort((a, b) => a.orden - b.orden)
    .find((x) => cumple(x.si, r));
}

export function resumirDiagnostico(
  respuestas: RespuestasDiagnostico,
  base: BaseResumen,
  hoy: string,
): ResumenDiagnostico {
  const diagnostico = diagnosticar(respuestas, base);
  const vigencia: Vigencia = { hoy, meses: base.vigenciaMeses };
  const fuentesDe = (ids: readonly string[]) =>
    ids.map((id) => base.fuentes.find((f) => f.id === id)).filter((f): f is Fuente => f !== undefined);
  const conEstado = <T extends Procedimiento | Programa>(dato: T) =>
    conEstadoEfectivo(dato, fuentesDe(dato.fuentes), vigencia);

  let modalidad: ModalidadExplicada | null = null;
  const regla = reglaDeModalidad(base.reglas, respuestas);
  if (diagnostico.modalidad && regla) {
    const licencia = base.procedimientos.find(
      (p) => p.id === `P-MUN-LIC-${diagnostico.modalidad}`,
    );
    modalidad = {
      modalidad: diagnostico.modalidad,
      regla,
      licencia: licencia && conEstado(licencia),
      fuentes: [...new Set([...(regla.fuentes ?? []), ...(licencia?.fuentes ?? [])])],
    };
  }

  const alertasPorNivel = NIVELES_ALERTA.map((nivel) => ({
    nivel,
    alertas: diagnostico.alertas.filter((a) => a.nivel === nivel),
  })).filter((g) => g.alertas.length > 0);

  const programas = diagnostico.programas
    .map((id) => base.programas.find((p) => p.id === id))
    .filter((p): p is Programa => p !== undefined)
    .map(conEstado);

  return { diagnostico, modalidad, alertasPorNivel, programas };
}

/** Texto legible de una respuesta (etiqueta de la opción o número con miles). */
export function textoRespuesta(p: Pregunta, valor: Valor | undefined): string {
  if (valor === undefined || valor === null) return "Sin respuesta";
  if (p.tipo === "opcion") {
    return p.opciones.find((o) => o.valor === valor)?.etiqueta ?? String(valor);
  }
  return typeof valor === "number"
    ? new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(valor)
    : String(valor);
}
