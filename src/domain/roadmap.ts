// Hoja de ruta (F2): convierte el diagnóstico en pasos enriquecidos por etapa, con el
// costo del distrito, plazos, requisitos y fuentes, más los totales.
//
// Regla de montos (CLAUDE.md, regla 5): tarifa del distrito (ubigeo) > costo_referencial
// del procedimiento > "Consultar TUPA". Nunca se inventa un monto, y un monto sin fuente
// no se muestra como monto.
//
// Antigüedad (Fase 9): cada monto y cada procedimiento llevan su estado efectivo; un dato
// verificado cuya fuente se consultó hace más de `vigenciaMeses` se muestra como
// "desactualizado". Por eso la hoja depende de "hoy", que entra como parámetro.
import { conEstadoEfectivo, type Antiguedad, type Vigencia } from "./freshness";
import type { Diagnostico } from "./rules-engine";
import type {
  Distrito,
  Documento,
  Etapa,
  EstadoVerificacion,
  Fuente,
  Institucion,
  Norma,
  Procedimiento,
  Tarifa,
} from "./types";

export interface BaseHojaDeRuta {
  procedimientos: readonly Procedimiento[];
  etapas: readonly Etapa[];
  instituciones: readonly Institucion[];
  documentos: readonly Documento[];
  normas: readonly Norma[];
  fuentes: readonly Fuente[];
  tarifas: readonly Tarifa[];
  distritos: readonly Distrito[];
  /** meta.vigencia_verificacion_meses: antigüedad máxima de un dato verificado. */
  vigenciaMeses: number;
}

/** Dónde se tramita: la institución, o la municipalidad concreta si es de nivel distrital. */
export interface EntidadPaso {
  nombre: string;
  siglas: string;
  canal: string | null;
}

export interface VarianteTarifa extends Antiguedad {
  variante: string;
  codigo_tupa: string | null;
  monto: number | null;
  estado_verificacion: EstadoVerificacion;
  fuente: Fuente;
  nota: string | null;
}

export interface Rango {
  minimo: number;
  maximo: number;
}

export type CostoPaso =
  | {
      /** Tarifa del TUPA del distrito; el rango sale de las variantes con monto. */
      tipo: "tarifa_distrital";
      variantes: VarianteTarifa[];
      rango: Rango | null;
      /** true si algún monto del rango no está verificado. */
      incluyeNoVerificados: boolean;
    }
  | {
      tipo: "referencial";
      clase: "fijo" | "gratuito";
      monto: number;
      nota: string | null;
      estado_verificacion: EstadoVerificacion;
      antiguedad_meses: number | null;
      fuentes: Fuente[];
    }
  | {
      tipo: "formula";
      formula: string;
      nota: string | null;
      estado_verificacion: EstadoVerificacion;
      antiguedad_meses: number | null;
      fuentes: Fuente[];
    }
  | { tipo: "honorarios_libres"; nota: string | null }
  | { tipo: "consultar_tupa"; nota: string | null };

/** Procedimiento con su estado efectivo según la antigüedad de sus fuentes. */
export type ProcedimientoRuta = Procedimiento & Antiguedad;

export interface AlternativaPaso {
  procedimiento: ProcedimientoRuta;
  costo: CostoPaso;
}

export interface PasoRuta {
  procedimiento: ProcedimientoRuta;
  institucion: Institucion | undefined;
  entidad: EntidadPaso | undefined;
  opcional: boolean;
  regla_id: string;
  plazo: { dias: number | null; nota: string | null };
  costo: CostoPaso;
  requisitos: Documento[];
  resultados: Documento[];
  normas: Norma[];
  fuentes: Fuente[];
  alternativas: AlternativaPaso[];
}

export interface EtapaRuta {
  etapa: Etapa;
  pasos: PasoRuta[];
}

export interface TotalesRuta {
  /** Suma de los montos conocidos de los pasos obligatorios (rango por variantes). */
  costo: Rango;
  pasosConMonto: number;
  /** Pasos obligatorios sin monto conocido (fórmula, honorarios, TUPA por consultar). */
  montosFaltantes: number;
  /** Pasos sumados cuyo monto no está verificado. */
  montosNoVerificados: number;
  /** Suma de plazos conocidos de los pasos obligatorios. */
  diasHabiles: number;
  plazosFaltantes: number;
  pasosObligatorios: number;
  pasosOpcionales: number;
}

export interface HojaDeRuta {
  modalidad: Diagnostico["modalidad"];
  ubigeo: string | null;
  etapas: EtapaRuta[];
  totales: TotalesRuta;
}

function porId<T extends { id: string }>(lista: readonly T[]): Map<string, T> {
  return new Map(lista.map((x) => [x.id, x]));
}

function resolver<T>(ids: readonly string[], mapa: Map<string, T>): T[] {
  return ids.map((id) => mapa.get(id)).filter((x): x is T => x !== undefined);
}

export function costoDePaso(
  proc: Procedimiento,
  ubigeo: string | null,
  base: Pick<BaseHojaDeRuta, "tarifas" | "fuentes" | "vigenciaMeses">,
  hoy: string,
): CostoPaso {
  const fuentes = porId(base.fuentes);
  const vigencia: Vigencia = { hoy, meses: base.vigenciaMeses };

  if (ubigeo) {
    const variantes: VarianteTarifa[] = base.tarifas
      .filter((t) => t.ubigeo === ubigeo && t.procedimiento_id === proc.id)
      .flatMap((t) => {
        const fuente = fuentes.get(t.fuente_id);
        if (!fuente) return []; // sin fuente no se muestra
        const { estado_verificacion, antiguedad_meses } = conEstadoEfectivo(t, [fuente], vigencia);
        return [
          {
            variante: t.variante,
            codigo_tupa: t.codigo_tupa ?? null,
            monto: t.derecho_soles ?? null,
            estado_verificacion,
            antiguedad_meses,
            fuente,
            nota: t.nota ?? null,
          },
        ];
      });
    if (variantes.length > 0) {
      const conMonto = variantes.filter((v) => v.monto !== null);
      const montos = conMonto.map((v) => v.monto as number);
      return {
        tipo: "tarifa_distrital",
        variantes,
        rango: montos.length > 0 ? { minimo: Math.min(...montos), maximo: Math.max(...montos) } : null,
        incluyeNoVerificados: conMonto.some((v) => v.estado_verificacion !== "verificado"),
      };
    }
  }

  const c = proc.costo_referencial;
  const nota = c.nota ?? null;
  const fuentesProc = resolver(proc.fuentes, fuentes);
  const { estado_verificacion, antiguedad_meses } = conEstadoEfectivo(proc, fuentesProc, vigencia);
  switch (c.tipo) {
    case "fijo":
    case "gratuito": {
      const monto = c.tipo === "gratuito" ? 0 : c.monto;
      if (monto == null || fuentesProc.length === 0) return { tipo: "consultar_tupa", nota };
      return {
        tipo: "referencial",
        clase: c.tipo,
        monto,
        nota,
        estado_verificacion,
        antiguedad_meses,
        fuentes: fuentesProc,
      };
    }
    case "formula":
      if (!c.formula || fuentesProc.length === 0) return { tipo: "consultar_tupa", nota };
      return {
        tipo: "formula",
        formula: c.formula,
        nota,
        estado_verificacion,
        antiguedad_meses,
        fuentes: fuentesProc,
      };
    case "honorarios_libres":
      return { tipo: "honorarios_libres", nota };
    case "tupa_distrital":
      // El procedimiento remite al TUPA del distrito, pero no hay tarifa cargada.
      return { tipo: "consultar_tupa", nota: null };
    case "por_verificar":
      return { tipo: "consultar_tupa", nota };
  }
}

/** Monto (o rango) conocido de un costo, para sumarlo a los totales. */
export function rangoDeCosto(costo: CostoPaso): Rango | null {
  if (costo.tipo === "tarifa_distrital") return costo.rango;
  if (costo.tipo === "referencial") return { minimo: costo.monto, maximo: costo.monto };
  return null;
}

const GRAVEDAD: Record<EstadoVerificacion, number> = {
  verificado: 0,
  fuente_secundaria: 1,
  desactualizado: 2,
  por_verificar: 3,
};

/**
 * Estado de verificación con el que se muestra un costo: el más débil de los montos que
 * lo componen. null si el costo no tiene un dato que verificar (honorarios, consultar TUPA).
 */
export function estadoDeCosto(costo: CostoPaso): EstadoVerificacion | null {
  if (costo.tipo === "referencial" || costo.tipo === "formula") return costo.estado_verificacion;
  if (costo.tipo !== "tarifa_distrital") return null;
  const conMonto = costo.variantes.filter((v) => v.monto !== null);
  const consideradas = conMonto.length > 0 ? conMonto : costo.variantes;
  return consideradas.reduce<EstadoVerificacion>(
    (peor, v) => (GRAVEDAD[v.estado_verificacion] > GRAVEDAD[peor] ? v.estado_verificacion : peor),
    "verificado",
  );
}

function costoNoVerificado(costo: CostoPaso): boolean {
  if (costo.tipo === "tarifa_distrital") return costo.incluyeNoVerificados;
  if (costo.tipo === "referencial") return costo.estado_verificacion !== "verificado";
  return false;
}

export function entidadDePaso(
  institucion: Institucion | undefined,
  distrito: Distrito | undefined,
): EntidadPaso | undefined {
  if (!institucion) return undefined;
  if (institucion.nivel === "distrital" && distrito) {
    return { nombre: distrito.institucion_local, siglas: institucion.siglas, canal: distrito.canal };
  }
  return { nombre: institucion.nombre, siglas: institucion.siglas, canal: institucion.canal ?? null };
}

export function armarHojaDeRuta(
  diagnostico: Diagnostico,
  ubigeo: string | null,
  base: BaseHojaDeRuta,
  hoy: string,
): HojaDeRuta {
  const procs = porId(base.procedimientos);
  const instituciones = porId(base.instituciones);
  const documentos = porId(base.documentos);
  const normas = porId(base.normas);
  const fuentes = porId(base.fuentes);
  const etapas = [...base.etapas].sort((a, b) => a.orden - b.orden);
  const distrito = ubigeo ? base.distritos.find((d) => d.ubigeo === ubigeo) : undefined;
  const vigencia: Vigencia = { hoy, meses: base.vigenciaMeses };
  const conEstado = (proc: Procedimiento): ProcedimientoRuta =>
    conEstadoEfectivo(proc, resolver(proc.fuentes, fuentes), vigencia);

  const etapaDePaso = new Map<PasoRuta, string>();
  const pasos = diagnostico.pasos.map((p): PasoRuta => {
    const proc = procs.get(p.procedimiento_id);
    if (!proc) throw new Error(`Procedimiento inexistente: ${p.procedimiento_id}`);
    const institucion = proc.institucion_id ? instituciones.get(proc.institucion_id) : undefined;
    const paso: PasoRuta = {
      procedimiento: conEstado(proc),
      institucion,
      entidad: entidadDePaso(institucion, distrito),
      opcional: p.opcional,
      regla_id: p.regla_id,
      plazo: { dias: proc.plazo_dias_habiles ?? null, nota: proc.plazo_nota ?? null },
      costo: costoDePaso(proc, ubigeo, base, hoy),
      requisitos: resolver(proc.requisitos, documentos),
      resultados: resolver(proc.documentos_resultado, documentos),
      normas: resolver(proc.normas, normas),
      fuentes: resolver(proc.fuentes, fuentes),
      alternativas: p.alternativas
        .map((id) => procs.get(id))
        .filter((x): x is Procedimiento => x !== undefined)
        .map((alt) => ({ procedimiento: conEstado(alt), costo: costoDePaso(alt, ubigeo, base, hoy) })),
    };
    etapaDePaso.set(paso, p.etapa_id);
    return paso;
  });

  const totales: TotalesRuta = {
    costo: { minimo: 0, maximo: 0 },
    pasosConMonto: 0,
    montosFaltantes: 0,
    montosNoVerificados: 0,
    diasHabiles: 0,
    plazosFaltantes: 0,
    pasosObligatorios: 0,
    pasosOpcionales: 0,
  };
  for (const p of pasos) {
    if (p.opcional) {
      totales.pasosOpcionales++;
      continue;
    }
    totales.pasosObligatorios++;
    const rango = rangoDeCosto(p.costo);
    if (rango) {
      totales.costo.minimo += rango.minimo;
      totales.costo.maximo += rango.maximo;
      totales.pasosConMonto++;
      if (costoNoVerificado(p.costo)) totales.montosNoVerificados++;
    } else {
      totales.montosFaltantes++;
    }
    if (p.plazo.dias !== null) totales.diasHabiles += p.plazo.dias;
    else totales.plazosFaltantes++;
  }
  // Evita arrastrar errores de coma flotante en la suma de soles.
  totales.costo.minimo = Math.round(totales.costo.minimo * 100) / 100;
  totales.costo.maximo = Math.round(totales.costo.maximo * 100) / 100;

  return {
    modalidad: diagnostico.modalidad,
    ubigeo,
    etapas: etapas
      .map((etapa) => ({
        etapa,
        pasos: pasos.filter((p) => etapaDePaso.get(p) === etapa.id),
      }))
      .filter((e) => e.pasos.length > 0),
    totales,
  };
}

/** Ubigeo del distrito elegido en el diagnóstico ("otro" o vacío → sin distrito). */
export function ubigeoDeRespuestas(distrito: unknown): string | null {
  return typeof distrito === "string" && /^[0-9]{6}$/.test(distrito) ? distrito : null;
}
