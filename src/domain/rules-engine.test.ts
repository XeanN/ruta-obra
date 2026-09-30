import { describe, expect, it } from "vitest";
import { cumple, diagnosticar, type BaseReglas } from "./rules-engine";
import type { Etapa, Procedimiento, Regla } from "./types";

describe("cumple", () => {
  const r = { uso: "comercio", pisos: 3, area: 120.5, flag: true, vacio: null };

  it("campo ausente o null → false", () => {
    expect(cumple({ campo: "nada", igual: "x" }, r)).toBe(false);
    expect(cumple({ campo: "vacio", igual: null }, r)).toBe(false);
    expect(cumple({ campo: "nada", existe: true }, r)).toBe(false);
  });

  it("campo ausente o null con existe: false → true", () => {
    expect(cumple({ campo: "nada", existe: false }, r)).toBe(true);
    expect(cumple({ campo: "vacio", existe: false }, r)).toBe(true);
  });

  it("existe con campo presente", () => {
    expect(cumple({ campo: "uso", existe: true }, r)).toBe(true);
    expect(cumple({ campo: "uso", existe: false }, r)).toBe(false);
  });

  it("igual / distinto", () => {
    expect(cumple({ campo: "uso", igual: "comercio" }, r)).toBe(true);
    expect(cumple({ campo: "uso", igual: "vivienda" }, r)).toBe(false);
    expect(cumple({ campo: "uso", distinto: "vivienda" }, r)).toBe(true);
    expect(cumple({ campo: "uso", distinto: "comercio" }, r)).toBe(false);
  });

  it("en / no_en", () => {
    expect(cumple({ campo: "uso", en: ["comercio", "mixto"] }, r)).toBe(true);
    expect(cumple({ campo: "uso", en: ["mixto"] }, r)).toBe(false);
    expect(cumple({ campo: "uso", no_en: ["mixto"] }, r)).toBe(true);
    expect(cumple({ campo: "uso", no_en: ["comercio"] }, r)).toBe(false);
  });

  it("mayor / menor_igual solo con números", () => {
    expect(cumple({ campo: "pisos", mayor: 2 }, r)).toBe(true);
    expect(cumple({ campo: "pisos", mayor: 3 }, r)).toBe(false);
    expect(cumple({ campo: "pisos", menor_igual: 3 }, r)).toBe(true);
    expect(cumple({ campo: "area", menor_igual: 120 }, r)).toBe(false);
    expect(cumple({ campo: "uso", mayor: 0 }, r)).toBe(false);
    expect(cumple({ campo: "uso", menor_igual: 0 }, r)).toBe(false);
  });

  it("replica Python: bool se compara como 0/1", () => {
    expect(cumple({ campo: "flag", igual: 1 }, r)).toBe(true);
    expect(cumple({ campo: "flag", en: [1] }, r)).toBe(true);
    expect(cumple({ campo: "flag", mayor: 0 }, r)).toBe(true);
    expect(cumple({ campo: "pisos", igual: "3" }, r)).toBe(false);
  });

  it("todas / alguna, anidables; todas: [] → true, alguna: [] → false", () => {
    expect(cumple({ todas: [] }, r)).toBe(true);
    expect(cumple({ alguna: [] }, r)).toBe(false);
    expect(
      cumple(
        {
          todas: [
            { campo: "uso", igual: "comercio" },
            { alguna: [{ campo: "pisos", mayor: 10 }, { campo: "area", mayor: 100 }] },
          ],
        },
        r,
      ),
    ).toBe(true);
    expect(
      cumple({ todas: [{ campo: "uso", igual: "comercio" }, { campo: "pisos", mayor: 10 }] }, r),
    ).toBe(false);
  });

  it("el primer operador presente gana (orden de Python)", () => {
    expect(cumple({ campo: "uso", igual: "comercio", distinto: "comercio" }, r)).toBe(true);
    expect(cumple({ todas: [], alguna: [] }, r)).toBe(true);
  });

  it("ignora propiedades heredadas en las respuestas", () => {
    const heredadas: Record<string, string> = Object.create({ uso: "comercio" });
    expect(cumple({ campo: "uso", existe: false }, heredadas)).toBe(true);
  });

  it("lanza error si la condición no tiene campo u operador", () => {
    expect(() => cumple({}, r)).toThrow(/sin campo/);
    expect(() => cumple({ campo: "uso" }, r)).toThrow(/sin operador/);
  });
});

describe("diagnosticar", () => {
  const etapas: Etapa[] = [
    { id: "E2", orden: 2, nombre: "Dos", descripcion: "", condicional: false },
    { id: "E1", orden: 1, nombre: "Uno", descripcion: "", condicional: false },
  ];
  const proc = (id: string, etapa_id: string): Procedimiento => ({
    id,
    etapa_id,
    nombre: id,
    descripcion: "",
    costo_referencial: { tipo: "por_verificar" },
    requisitos: [],
    documentos_resultado: [],
    profesionales: [],
    depende_de: [],
    normas: [],
    fuentes: [],
    estado_verificacion: "verificado",
  });
  const procedimientos = [
    proc("P-A2", "E2"),
    proc("P-B2", "E2"),
    proc("P-C1", "E1"),
    proc("P-ALT", "E2"),
  ];
  const siempre = { todas: [] };
  const reglas: Regla[] = [
    { id: "R-MOD-B", tipo: "modalidad", orden: 20, resultado: "B", si: siempre },
    {
      id: "R-MOD-A",
      tipo: "modalidad",
      orden: 10,
      resultado: "A",
      si: { campo: "pisos", menor_igual: 2 },
    },
    {
      id: "R-P1",
      tipo: "agregar_procedimientos",
      si: siempre,
      procedimientos: ["P-A2", "P-B2"],
      alternativas: ["P-ALT"],
    },
    {
      id: "R-P2",
      tipo: "agregar_procedimientos",
      si: { campo: "_modalidad", igual: "A" },
      procedimientos: ["P-C1", "P-A2", "P-C1"],
      opcional: true,
    },
    {
      id: "R-AL",
      tipo: "alerta",
      si: { campo: "_modalidad", igual: "B" },
      nivel: "alta",
      mensaje: "Modalidad B",
    },
    { id: "R-PR", tipo: "programa", si: siempre, programa_id: "PR-X" },
  ];
  const base: BaseReglas = { reglas, procedimientos, etapas };

  it("modalidad = primera regla por orden que cumple; _modalidad se inyecta antes", () => {
    const res = diagnosticar({ pisos: 2 }, base);
    expect(res.modalidad).toBe("A");
    expect(res.alertas).toEqual([]);
    expect(res.pasos.map((p) => p.procedimiento_id)).toEqual(["P-C1", "P-A2", "P-B2"]);
  });

  it("sin duplicados, ordenado por etapa, conserva aparición y datos del paso", () => {
    const res = diagnosticar({ pisos: 2 }, base);
    expect(res.pasos).toEqual([
      { procedimiento_id: "P-C1", opcional: true, regla_id: "R-P2", etapa_id: "E1", alternativas: [] },
      { procedimiento_id: "P-A2", opcional: false, regla_id: "R-P1", etapa_id: "E2", alternativas: ["P-ALT"] },
      { procedimiento_id: "P-B2", opcional: false, regla_id: "R-P1", etapa_id: "E2", alternativas: [] },
    ]);
  });

  it("alertas y programas", () => {
    const res = diagnosticar({ pisos: 5 }, base);
    expect(res.modalidad).toBe("B");
    expect(res.alertas).toEqual([{ id: "R-AL", nivel: "alta", mensaje: "Modalidad B" }]);
    expect(res.programas).toEqual(["PR-X"]);
  });

  it("modalidad null si ninguna regla cumple; no muta las respuestas", () => {
    const soloA: BaseReglas = { ...base, reglas: reglas.filter((x) => x.id !== "R-MOD-B") };
    const respuestas = { pisos: 9 };
    expect(diagnosticar(respuestas, soloA).modalidad).toBeNull();
    expect(respuestas).toEqual({ pisos: 9 });
  });

  it("_modalidad de entrada se sobrescribe", () => {
    expect(diagnosticar({ pisos: 5, _modalidad: "A" }, base).modalidad).toBe("B");
  });

  it("lanza error si una regla referencia un procedimiento o etapa inexistente", () => {
    const sinProc: BaseReglas = { ...base, procedimientos: procedimientos.slice(1) };
    expect(() => diagnosticar({}, sinProc)).toThrow(/Procedimiento inexistente: P-A2/);
    const sinEtapa: BaseReglas = { ...base, etapas: etapas.slice(1) };
    expect(() => diagnosticar({}, sinEtapa)).toThrow(/Etapa inexistente/);
  });
});
