import { describe, expect, it } from "vitest";
import { knowledgeRepo } from "@/data/knowledge-repo";
import { formatFecha, formatSoles, textoProfesional, textoVariante } from "./format";

describe("formatos", () => {
  it("fecha dd/mm/aaaa", () => {
    expect(formatFecha("2026-09-30")).toBe("30/09/2026");
  });

  it("soles S/ 1,234.50", () => {
    expect(formatSoles(1234.5)).toBe("S/ 1,234.50");
    expect(formatSoles(0)).toBe("S/ 0.00");
  });

  it("variantes de tarifa legibles", () => {
    expect(textoVariante("general")).toBe("General");
    expect(textoVariante("rango_min")).toBe("Mínimo");
    expect(textoVariante("A")).toBe("Modalidad A");
    expect(textoVariante("BCD")).toBe("Modalidad B, C o D");
    expect(textoVariante("demolicion_3_pisos")).toBe("Demolición 3 pisos");
    expect(textoVariante("vivienda_unifamiliar_120m2")).toBe("Vivienda unifamiliar 120 m²");
    expect(textoVariante("comercio_mas_30000m2")).toBe("Comercio más de 30,000 m²");
    expect(textoVariante("multifamiliar_mas_5_pisos")).toBe("Multifamiliar más de 5 pisos");
    expect(textoVariante("demas_edificaciones")).toBe("Demás edificaciones");
    expect(textoVariante("educacion_salud_hospedaje")).toBe("Educación salud hospedaje");
  });

  it("profesionales legibles", () => {
    expect(textoProfesional("arquitecto_colegiado")).toBe("Arquitecto colegiado");
    expect(textoProfesional("notario")).toBe("Notario");
  });

  it("ninguna variante real queda sin traducir a texto legible", () => {
    const variantes = new Set(knowledgeRepo.baseHojaDeRuta.tarifas.map((t) => t.variante));
    for (const v of variantes) {
      const t = textoVariante(v);
      expect(t).not.toContain("_");
      expect(t).not.toMatch(/cion\b|\bmas\b/);
    }
  });
});
