import { describe, expect, it } from "vitest";
import casos from "../../fixtures/casos.json";
import { knowledgeRepo } from "@/data/knowledge-repo";
import {
  armarHojaDeRuta,
  costoDePaso,
  estadoDeCosto,
  rangoDeCosto,
  ubigeoDeRespuestas,
  type BaseHojaDeRuta,
  type CostoPaso,
  type HojaDeRuta,
  type PasoRuta,
} from "./roadmap";
import { diagnosticar, type Diagnostico } from "./rules-engine";
import { RespuestasSchema } from "./schemas";
import type { EstadoVerificacion, Procedimiento, Tarifa } from "./types";

const base = knowledgeRepo.baseHojaDeRuta;
/** Fecha fija: las fuentes de data/ se consultaron en 2026-09, dentro del umbral de 12 meses. */
const HOY = "2026-10-01";
const caso = (id: string) => {
  const c = casos.find((x) => x.id === id);
  if (!c) throw new Error(id);
  return RespuestasSchema.parse(c.respuestas);
};
const ruta = (id: string, ubigeo?: string | null): HojaDeRuta => {
  const r = caso(id);
  const u = ubigeo === undefined ? ubigeoDeRespuestas(r.distrito) : ubigeo;
  return armarHojaDeRuta(diagnosticar(r, knowledgeRepo.baseReglas), u, base, HOY);
};
const paso = (h: HojaDeRuta, pid: string): PasoRuta => {
  const p = h.etapas.flatMap((e) => e.pasos).find((x) => x.procedimiento.id === pid);
  if (!p) throw new Error(`sin paso ${pid}`);
  return p;
};

describe("ubigeoDeRespuestas", () => {
  it("acepta solo ubigeos de 6 dígitos", () => {
    expect(ubigeoDeRespuestas("150108")).toBe("150108");
    expect(ubigeoDeRespuestas("otro")).toBeNull();
    expect(ubigeoDeRespuestas(undefined)).toBeNull();
    expect(ubigeoDeRespuestas(150108)).toBeNull();
  });
});

describe("armarHojaDeRuta: estructura", () => {
  it.each(casos.map((c) => c.id))("%s: conserva todos los pasos, agrupados y ordenados por etapa", (id) => {
    const r = caso(id);
    const diag = diagnosticar(r, knowledgeRepo.baseReglas);
    const h = armarHojaDeRuta(diag, ubigeoDeRespuestas(r.distrito), base, HOY);
    expect(h.modalidad).toBe(diag.modalidad);
    expect(h.etapas.flatMap((e) => e.pasos.map((p) => p.procedimiento.id))).toEqual(
      diag.pasos.map((p) => p.procedimiento_id),
    );
    const ordenes = h.etapas.map((e) => e.etapa.orden);
    expect(ordenes).toEqual([...ordenes].sort((a, b) => a - b));
    for (const e of h.etapas) {
      expect(e.pasos.length).toBeGreaterThan(0);
      for (const p of e.pasos) expect(p.procedimiento.etapa_id).toBe(e.etapa.id);
    }
  });

  it("resuelve institución, requisitos, resultados, normas, fuentes y alternativas", () => {
    const h = ruta("caso-angel");
    const lic = paso(h, "P-MUN-LIC-B");
    expect(lic.institucion?.id).toBe(lic.procedimiento.institucion_id);
    expect(lic.requisitos.map((d) => d.id)).toEqual(lic.procedimiento.requisitos);
    expect(lic.resultados.map((d) => d.id)).toEqual(lic.procedimiento.documentos_resultado);
    expect(lic.normas.map((n) => n.id)).toEqual(lic.procedimiento.normas);
    expect(lic.fuentes.map((f) => f.id)).toEqual(lic.procedimiento.fuentes);
    expect(lic.alternativas.map((a) => a.procedimiento.id)).toEqual(["P-MUN-LIC-B-RU"]);
    expect(lic.plazo).toEqual({ dias: 15, nota: lic.procedimiento.plazo_nota });
  });

  it("una entidad distrital se resuelve a la municipalidad y canal del distrito", () => {
    const lic = paso(ruta("caso-angel"), "P-MUN-LIC-B");
    expect(lic.institucion?.nivel).toBe("distrital");
    expect(lic.entidad).toEqual({
      nombre: "Municipalidad Distrital de Chorrillos",
      siglas: lic.institucion?.siglas,
      canal: knowledgeRepo.getDistrito("150108")?.canal,
    });
    const sinDistrito = paso(ruta("caso-angel", null), "P-MUN-LIC-B");
    expect(sinDistrito.entidad?.nombre).toBe(sinDistrito.institucion?.nombre);
    const sunarp = paso(ruta("caso-angel"), "P-SUN-COPIA");
    expect(sunarp.entidad?.nombre).toBe(sunarp.institucion?.nombre);
  });

  it("lanza error si el diagnóstico trae un procedimiento inexistente", () => {
    const diag: Diagnostico = {
      modalidad: null,
      pasos: [{ procedimiento_id: "P-NO-EXISTE", opcional: false, regla_id: "R", etapa_id: "E1", alternativas: [] }],
      alertas: [],
      programas: [],
    };
    expect(() => armarHojaDeRuta(diag, null, base, HOY)).toThrow(/Procedimiento inexistente/);
  });
});

describe("costos por distrito (regla 5)", () => {
  it("La Molina: tarifa verificada del TUPA con código", () => {
    const h = ruta("comercio-grande");
    const costo = paso(h, "P-MUN-LIC-D").costo;
    expect(costo.tipo).toBe("tarifa_distrital");
    if (costo.tipo !== "tarifa_distrital") return;
    expect(costo.rango).toEqual({ minimo: 585.3, maximo: 585.3 });
    expect(costo.incluyeNoVerificados).toBe(false);
    expect(costo.variantes.every((v) => v.codigo_tupa)).toBe(true);
  });

  it("rango cuando las variantes tienen montos distintos", () => {
    const h = ruta("caso-angel", "150114");
    const costo = paso(h, "P-MUN-LIC-B").costo;
    expect(rangoDeCosto(costo)).toEqual({ minimo: 1463.4, maximo: 2509.8 });
  });

  it("Surco: montos extraídos del TUPA 2024 entran por confirmar; los ya verificados se conservan", () => {
    const h = ruta("unifamiliar-simple");
    const lic = paso(h, "P-MUN-LIC-A").costo;
    expect(lic.tipo === "tarifa_distrital" && lic.incluyeNoVerificados).toBe(true);
    expect(rangoDeCosto(lic)).toEqual({ minimo: 117.6, maximo: 117.6 });
    expect(estadoDeCosto(lic)).toBe("por_verificar");
    const param = paso(h, "P-MUN-PARAM").costo;
    expect(param.tipo === "tarifa_distrital" && param.incluyeNoVerificados).toBe(false);
    expect(h.totales.montosNoVerificados).toBeGreaterThanOrEqual(1);
  });

  it("Villa El Salvador: fila sin monto no suma y cuenta como faltante", () => {
    const h = ruta("caso-angel", "150142");
    const costo = paso(h, "P-MUN-LIC-B").costo;
    expect(costo.tipo).toBe("tarifa_distrital");
    if (costo.tipo !== "tarifa_distrital") return;
    expect(costo.rango).toBeNull();
    expect(costo.variantes.map((v) => v.variante)).toEqual(["general"]);
    expect(costo.variantes.every((v) => v.estado_verificacion === "por_verificar")).toBe(true);
    expect(h.totales.montosFaltantes).toBeGreaterThanOrEqual(1);
  });

  it("Chorrillos: TUPA 2024 con montos por variante, también para revisores urbanos", () => {
    const h = ruta("caso-angel");
    const costo = paso(h, "P-MUN-LIC-B").costo;
    expect(rangoDeCosto(costo)).toEqual({ minimo: 1059.2, maximo: 1815.6 });
    expect(estadoDeCosto(costo)).toBe("por_verificar");
    expect(rangoDeCosto(paso(h, "P-MUN-LIC-B").alternativas[0]!.costo)).toEqual({ minimo: 59.5, maximo: 59.5 });
  });

  it("sin tarifa del distrito usa el costo referencial; si tampoco hay, Consultar TUPA", () => {
    const h = ruta("caso-angel");
    expect(paso(h, "P-SUN-INSC-CV").costo).toMatchObject({ tipo: "referencial", clase: "fijo", monto: 41.7 });
    expect(paso(h, "P-SUN-ALERTA").costo).toMatchObject({ tipo: "referencial", clase: "gratuito", monto: 0 });
    expect(paso(h, "P-NOT-ESCRITURA").costo.tipo).toBe("honorarios_libres");
    expect(paso(h, "P-SUN-FAB27157").costo.tipo).toBe("formula");
    expect(paso(h, "P-PROH-OPINION").costo.tipo).toBe("consultar_tupa");
    // La alternativa por revisores urbanos no tiene tarifa en Villa El Salvador.
    const ves = ruta("caso-angel", "150142");
    expect(paso(ves, "P-MUN-LIC-B").alternativas[0]?.costo).toEqual({ tipo: "consultar_tupa", nota: null });
  });

  it("distrito 'otro': nunca usa tarifas distritales", () => {
    const h = ruta("post-2018-techo-propio");
    expect(h.ubigeo).toBeNull();
    for (const p of h.etapas.flatMap((e) => e.pasos)) expect(p.costo.tipo).not.toBe("tarifa_distrital");
  });
});

describe("ningún monto sin fuente (aceptación)", () => {
  const distritos = [...knowledgeRepo.getDistritos().map((d) => d.ubigeo), null];
  const costosConMonto = (c: CostoPaso) => {
    if (c.tipo === "tarifa_distrital") {
      for (const v of c.variantes) expect(v.fuente.url).toMatch(/^https?:\/\//);
    }
    if (c.tipo === "referencial" || c.tipo === "formula") expect(c.fuentes.length).toBeGreaterThan(0);
  };

  it.each(casos.flatMap((c) => distritos.map((u) => [c.id, u] as const)))("%s en %s", (id, ubigeo) => {
    const h = ruta(id, ubigeo);
    for (const p of h.etapas.flatMap((e) => e.pasos)) {
      costosConMonto(p.costo);
      for (const a of p.alternativas) costosConMonto(a.costo);
    }
  });
});

describe("costoDePaso: casos borde", () => {
  const proc = (costo: Procedimiento["costo_referencial"], fuentes = ["F-TUO-29090"]): Procedimiento => ({
    id: "P-X",
    etapa_id: "E1",
    nombre: "X",
    descripcion: "",
    costo_referencial: costo,
    requisitos: [],
    documentos_resultado: [],
    profesionales: [],
    depende_de: [],
    normas: [],
    fuentes,
    estado_verificacion: "por_verificar",
  });
  const b: Pick<BaseHojaDeRuta, "tarifas" | "fuentes" | "vigenciaMeses"> = {
    tarifas: [],
    fuentes: base.fuentes,
    vigenciaMeses: 12,
  };

  it("fijo sin monto o sin fuente → Consultar TUPA", () => {
    expect(costoDePaso(proc({ tipo: "fijo", monto: null }), null, b, HOY).tipo).toBe("consultar_tupa");
    expect(costoDePaso(proc({ tipo: "fijo", monto: 10 }, []), null, b, HOY).tipo).toBe("consultar_tupa");
    expect(costoDePaso(proc({ tipo: "formula", formula: null }), null, b, HOY).tipo).toBe("consultar_tupa");
  });

  it("un monto referencial no verificado conserva su estado", () => {
    const c = costoDePaso(proc({ tipo: "fijo", monto: 10 }), null, b, HOY);
    expect(c).toMatchObject({ tipo: "referencial", monto: 10, estado_verificacion: "por_verificar" });
  });

  it("descarta tarifas cuya fuente no existe", () => {
    const tarifa: Tarifa = {
      id: "T",
      ubigeo: "150114",
      procedimiento_id: "P-X",
      variante: "general",
      derecho_soles: 99,
      fuente_id: "F-NO-EXISTE",
      estado_verificacion: "verificado",
    };
    const c = costoDePaso(proc({ tipo: "por_verificar", nota: "Según TUPA" }), "150114", { ...b, tarifas: [tarifa] }, HOY);
    expect(c).toEqual({ tipo: "consultar_tupa", nota: "Según TUPA" });
  });
});

describe("estadoDeCosto", () => {
  it("toma el estado más débil de los montos que componen el costo", () => {
    expect(estadoDeCosto(paso(ruta("comercio-grande"), "P-MUN-LIC-D").costo)).toBe("verificado");
    expect(estadoDeCosto(paso(ruta("caso-angel"), "P-MUN-LIC-B").costo)).toBe("por_verificar");
    const fuente = base.fuentes[0]!;
    const variante = (estado: EstadoVerificacion, monto: number | null) => ({
      variante: estado, codigo_tupa: null, monto, estado_verificacion: estado, antiguedad_meses: null, fuente, nota: null,
    });
    const mezcla: CostoPaso = {
      tipo: "tarifa_distrital",
      variantes: [variante("verificado", 10), variante("desactualizado", 20), variante("por_verificar", null)],
      rango: { minimo: 10, maximo: 20 },
      incluyeNoVerificados: true,
    };
    // Solo cuentan las variantes con monto: la más débil es "desactualizado".
    expect(estadoDeCosto(mezcla)).toBe("desactualizado");
  });

  it("referencial y fórmula usan el estado del procedimiento; el resto no tiene estado", () => {
    const h = ruta("caso-angel");
    expect(estadoDeCosto(paso(h, "P-SUN-INSC-CV").costo)).toBe("fuente_secundaria");
    expect(estadoDeCosto(paso(h, "P-SUN-FAB27157").costo)).toBe("verificado");
    expect(estadoDeCosto(paso(h, "P-NOT-ESCRITURA").costo)).toBeNull();
    expect(estadoDeCosto(paso(h, "P-PROH-OPINION").costo)).toBeNull();
  });
});

describe("totales", () => {
  it("suman solo pasos obligatorios con monto; cuentan faltantes y plazos", () => {
    const h = ruta("comercio-grande");
    const obligatorios = h.etapas.flatMap((e) => e.pasos).filter((p) => !p.opcional);
    let min = 0;
    let max = 0;
    let conMonto = 0;
    let dias = 0;
    for (const p of obligatorios) {
      const r = rangoDeCosto(p.costo);
      if (r) {
        min += r.minimo;
        max += r.maximo;
        conMonto++;
      }
      dias += p.plazo.dias ?? 0;
    }
    expect(h.totales.costo.minimo).toBeCloseTo(min, 2);
    expect(h.totales.costo.maximo).toBeCloseTo(max, 2);
    expect(h.totales.pasosConMonto).toBe(conMonto);
    expect(h.totales.montosFaltantes).toBe(obligatorios.length - conMonto);
    expect(h.totales.diasHabiles).toBe(dias);
    expect(h.totales.pasosObligatorios).toBe(obligatorios.length);
    expect(h.totales.costo.minimo).toBeGreaterThan(0);
  });

  it("excluye los pasos opcionales", () => {
    const h = ruta("caso-angel", "150114");
    const anteproy = paso(h, "P-MUN-ANTEPROY");
    expect(anteproy.opcional).toBe(true);
    expect(h.totales.pasosOpcionales).toBe(1);
    const sinOpcional = h.etapas.flatMap((e) => e.pasos).filter((p) => !p.opcional).length;
    expect(h.totales.pasosObligatorios).toBe(sinOpcional);
  });
});

describe("antigüedad (Fase 9)", () => {
  // Las fuentes de La Molina y de SUNARP se consultaron el 2026-09-30 (data/fuentes.json).
  const en = (id: string, hoy: string, b: BaseHojaDeRuta = base) => {
    const r = caso(id);
    return armarHojaDeRuta(diagnosticar(r, knowledgeRepo.baseReglas), ubigeoDeRespuestas(r.distrito), b, hoy);
  };

  it("una tarifa verificada consultada hace 11 meses sigue verificada; a los 13, Versión anterior", () => {
    const antes = en("comercio-grande", "2027-08-30");
    expect(estadoDeCosto(paso(antes, "P-MUN-LIC-D").costo)).toBe("verificado");

    const despues = en("comercio-grande", "2027-10-30");
    const costo = paso(despues, "P-MUN-LIC-D").costo;
    expect(estadoDeCosto(costo)).toBe("desactualizado");
    if (costo.tipo !== "tarifa_distrital") throw new Error("se esperaba tarifa distrital");
    expect(costo.incluyeNoVerificados).toBe(true);
    expect(costo.variantes.every((v) => v.antiguedad_meses === 12)).toBe(true);
    expect(despues.totales.montosNoVerificados).toBeGreaterThan(antes.totales.montosNoVerificados);
  });

  it("degrada también los montos por fórmula y el propio procedimiento", () => {
    const p = paso(en("caso-angel", "2027-10-30"), "P-SUN-FAB27157");
    expect(p.costo).toMatchObject({ tipo: "formula", estado_verificacion: "desactualizado", antiguedad_meses: 12 });
    expect(p.procedimiento.estado_verificacion).toBe("desactualizado");
    expect(p.procedimiento.antiguedad_meses).toBe(12);
    expect(paso(ruta("caso-angel"), "P-SUN-FAB27157").procedimiento.antiguedad_meses).toBeNull();
  });

  it("el umbral se cambia solo con vigenciaMeses (meta.json)", () => {
    const h = en("comercio-grande", "2027-10-30", { ...base, vigenciaMeses: 24 });
    expect(estadoDeCosto(paso(h, "P-MUN-LIC-D").costo)).toBe("verificado");
  });

  it("los datos no verificados conservan su estado original", () => {
    expect(estadoDeCosto(paso(en("caso-angel", "2030-01-01"), "P-MUN-LIC-B").costo)).toBe("por_verificar");
  });
});
