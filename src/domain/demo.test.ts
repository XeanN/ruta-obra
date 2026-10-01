import { describe, expect, it } from "vitest";
import casos from "../../fixtures/casos.json";
import demo from "../../fixtures/demo.json";
import { knowledgeRepo } from "@/data/knowledge-repo";
import { analizarExpediente } from "./analisis";
import { armarExpedientesDemo, esDemo, resolverDemo, type DefinicionDemo } from "./demo";
import { ExpedienteRegistroSchema } from "./schemas";

const base = knowledgeRepo.baseExpedientes;
const HOY = "2026-10-01";
const definiciones = resolverDemo(demo, casos);
const armar = (hoy = HOY) => armarExpedientesDemo(definiciones, base, hoy);

describe("modo demo", () => {
  it("arma 3 expedientes válidos, marcados como demo", () => {
    const registros = armar();
    expect(registros).toHaveLength(3);
    for (const r of registros) {
      expect(ExpedienteRegistroSchema.parse(r)).toEqual(r);
      expect(esDemo(r.expediente.id)).toBe(true);
      expect(esDemo(r.predio.id)).toBe(true);
      expect(r.expediente.version_datos).toBe(base.versionDatos);
    }
    expect(esDemo("4f0c…")).toBe(false);
  });

  it("cubre los tres estados: recién creado, con observación y casi terminado", () => {
    const analizados = armar().map((r) => analizarExpediente(r, base, HOY, `${HOY}T12:00:00-05:00`));
    const [nuevo, observado, casi] = analizados;

    expect(nuevo?.resumen.avance.porcentaje).toBeLessThan(20);
    expect(observado?.alertas.some((a) => a.tipo === "plazo_subsanacion" && (a.dias ?? -1) >= 0)).toBe(true);
    expect(casi?.resumen.avance.porcentaje).toBeGreaterThan(75);
    // La migración no debe tocar nada: la demo nace con la versión actual de los datos.
    expect(analizados.every((a) => !a.migrado)).toBe(true);
  });

  it("calcula las fechas relativas a hoy", () => {
    const [, observado] = armar("2026-03-10");
    const anteproyecto = observado?.expediente.pasos.find((p) => p.procedimiento_id === "P-MUN-ANTEPROY");
    expect(anteproyecto?.fecha_observacion).toBe("2026-03-07");
    expect(observado?.expediente.creado_en).toBe("2025-10-11T09:00:00-05:00");
    expect(observado?.expediente.actualizado_en).toBe("2026-03-07T09:00:00-05:00");
    expect(observado?.expediente.bitacora?.[0]).toMatchObject({ id: "demo-con-observacion-b1", fecha: "2025-12-05" });
    expect(anteproyecto && "monto_pagado" in anteproyecto).toBe(false);
  });

  it("falla si un caso o un paso de la demo ya no existe", () => {
    expect(() => resolverDemo(demo, [])).toThrow(/no existe el caso/);
    const roto: DefinicionDemo[] = definiciones.map((d, i) =>
      i === 0 ? { ...d, pasos: [{ procedimiento_id: "P-NO-EXISTE", estado: "aprobado" }] } : d,
    );
    expect(() => armarExpedientesDemo(roto, base, HOY)).toThrow(/P-NO-EXISTE/);
  });
});
