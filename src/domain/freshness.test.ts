import { describe, expect, it } from "vitest";
import { knowledgeRepo } from "@/data/knowledge-repo";
import {
  conEstadoEfectivo,
  estadoEfectivo,
  fechaRevision,
  revisionVencida,
  textoAntiguedad,
  vencidosPorArchivo,
  type BaseAntiguedad,
} from "./freshness";
import type { Fuente } from "./types";

const fuente = (id: string, fecha_consulta: string): Fuente => ({
  id,
  titulo: id,
  url: "https://example.org",
  tipo: "oficial",
  fecha_consulta,
});

describe("estadoEfectivo", () => {
  const consulta = "2025-03-15";

  it("justo en el umbral sigue verificado; un día después pasa a desactualizado", () => {
    expect(estadoEfectivo("verificado", consulta, "2026-03-15", 12)).toBe("verificado");
    expect(estadoEfectivo("verificado", consulta, "2026-03-16", 12)).toBe("desactualizado");
  });

  it("11 meses no vence; 13 meses sí (aceptación)", () => {
    expect(estadoEfectivo("verificado", consulta, "2026-02-15", 12)).toBe("verificado");
    expect(estadoEfectivo("verificado", consulta, "2026-04-15", 12)).toBe("desactualizado");
  });

  it("el umbral es un parámetro (viene de meta.json)", () => {
    expect(estadoEfectivo("verificado", consulta, "2026-04-15", 24)).toBe("verificado");
    expect(estadoEfectivo("verificado", consulta, "2025-05-01", 1)).toBe("desactualizado");
  });

  it("nunca mejora ni cambia un estado que ya no es verificado", () => {
    for (const e of ["fuente_secundaria", "desactualizado", "por_verificar"] as const) {
      expect(estadoEfectivo(e, consulta, "2030-01-01", 12)).toBe(e);
      expect(estadoEfectivo(e, consulta, "2025-03-16", 12)).toBe(e);
    }
  });

  it("sin fecha de consulta no se degrada", () => {
    expect(estadoEfectivo("verificado", null, "2030-01-01", 12)).toBe("verificado");
    expect(estadoEfectivo("verificado", undefined, "2030-01-01", 12)).toBe("verificado");
    expect(revisionVencida("", "2030-01-01", 12)).toBe(false);
  });

  it("fin de mes: 31/01 + 1 mes es 28/02", () => {
    expect(estadoEfectivo("verificado", "2026-01-31", "2026-02-28", 1)).toBe("verificado");
    expect(estadoEfectivo("verificado", "2026-01-31", "2026-03-01", 1)).toBe("desactualizado");
  });
});

describe("fechaRevision", () => {
  it("toma la consulta más antigua (criterio conservador)", () => {
    expect(fechaRevision([fuente("F-A", "2026-09-01"), fuente("F-B", "2025-01-10")])).toBe("2025-01-10");
  });

  it("null sin fuentes", () => {
    expect(fechaRevision([])).toBeNull();
  });
});

describe("conEstadoEfectivo", () => {
  const dato = { id: "X", estado_verificacion: "verificado" as const };

  it("degrada y marca el umbral superado", () => {
    const r = conEstadoEfectivo(dato, [fuente("F-A", "2025-01-01")], { hoy: "2026-06-01", meses: 12 });
    expect(r).toEqual({ id: "X", estado_verificacion: "desactualizado", antiguedad_meses: 12 });
  });

  it("sin degradar, antiguedad_meses es null y el dato no cambia", () => {
    const r = conEstadoEfectivo(dato, [fuente("F-A", "2026-01-01")], { hoy: "2026-06-01", meses: 12 });
    expect(r).toEqual({ ...dato, antiguedad_meses: null });
  });

  it("un dato ya desactualizado por versión anterior no se atribuye a la antigüedad", () => {
    const r = conEstadoEfectivo(
      { estado_verificacion: "desactualizado" as const },
      [fuente("F-A", "2020-01-01")],
      { hoy: "2026-06-01", meses: 12 },
    );
    expect(r.antiguedad_meses).toBeNull();
  });

  it("sin fuentes no se degrada", () => {
    expect(conEstadoEfectivo(dato, [], { hoy: "2030-01-01", meses: 12 }).estado_verificacion).toBe("verificado");
  });
});

describe("textoAntiguedad", () => {
  it("usa el umbral configurado", () => {
    expect(textoAntiguedad(12)).toBe("Sin revisar desde hace más de 12 meses");
  });
});

describe("vencidosPorArchivo", () => {
  const base: BaseAntiguedad = {
    fuentes: [fuente("F-VIEJA", "2024-01-01"), fuente("F-NUEVA", "2026-05-01")],
    procedimientos: [
      { estado_verificacion: "verificado", fuentes: ["F-VIEJA"] },
      { estado_verificacion: "verificado", fuentes: ["F-NUEVA"] },
      { estado_verificacion: "por_verificar", fuentes: ["F-VIEJA"] },
    ],
    tarifas: [
      { estado_verificacion: "verificado", fuente_id: "F-VIEJA" },
      { estado_verificacion: "verificado", fuente_id: "F-NO-EXISTE" },
    ],
    distritos: [{ estado_verificacion: "verificado", tupa: { fuente_id: null } }],
    programas: [{ estado_verificacion: "verificado", fuentes: ["F-NUEVA", "F-VIEJA"] }],
    zonas: [],
  };

  it("cuenta verificados y vencidos por archivo", () => {
    expect(vencidosPorArchivo(base, { hoy: "2026-06-01", meses: 12 })).toEqual([
      { archivo: "procedimientos.json", verificados: 2, vencidos: 1 },
      { archivo: "tarifas_distritales.json", verificados: 2, vencidos: 1 },
      { archivo: "distritos.json", verificados: 1, vencidos: 0 },
      { archivo: "programas.json", verificados: 1, vencidos: 1 },
      { archivo: "zonas_especiales.json", verificados: 0, vencidos: 0 },
    ]);
  });

  it("data/ real: nada vence hoy (fuentes consultadas en 2026-09) y las tarifas vencen en 2028", () => {
    const meses = knowledgeRepo.meta.vigencia_verificacion_meses;
    const hoy = vencidosPorArchivo(knowledgeRepo.baseAntiguedad, { hoy: "2026-10-01", meses });
    expect(hoy.every((a) => a.vencidos === 0)).toBe(true);
    const futuro = vencidosPorArchivo(knowledgeRepo.baseAntiguedad, { hoy: "2028-01-01", meses });
    expect(futuro.find((a) => a.archivo === "tarifas_distritales.json")?.vencidos).toBeGreaterThan(0);
  });
});
