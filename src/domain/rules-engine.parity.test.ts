// Paridad con el motor de referencia (scripts/simulate.py).
// - casos.json: lo que el negocio espera (modalidad, incluye, excluye, alertas).
// - resultados-motor.json: salida COMPLETA de Python (`python scripts/simulate.py --export`).
import { describe, expect, it } from "vitest";
import casos from "../../fixtures/casos.json";
import resultadosPython from "../../fixtures/resultados-motor.json";
import { knowledgeRepo } from "@/data/knowledge-repo";
import { diagnosticar } from "./rules-engine";
import { RespuestasSchema } from "./schemas";

const salidaPython: Record<string, unknown> = resultadosPython;

describe("paridad con scripts/simulate.py", () => {
  it("hay una salida de Python por cada caso (si falla: python scripts/simulate.py --export)", () => {
    expect(Object.keys(salidaPython).sort()).toEqual(
      casos.map((c) => c.id).sort(),
    );
  });

  describe.each(casos)("$id", (caso) => {
    const res = diagnosticar(
      RespuestasSchema.parse(caso.respuestas),
      knowledgeRepo.baseReglas,
    );
    const obtenidos = new Set(res.pasos.map((p) => p.procedimiento_id));
    const alertas = new Set(res.alertas.map((a) => a.id));

    it("modalidad esperada", () => {
      expect(res.modalidad).toBe(caso.esperado.modalidad);
    });

    it("incluye los procedimientos esperados", () => {
      for (const pid of caso.esperado.incluye) expect(obtenidos).toContain(pid);
    });

    it("excluye los procedimientos esperados", () => {
      for (const pid of caso.esperado.excluye) expect(obtenidos).not.toContain(pid);
    });

    it("genera las alertas esperadas", () => {
      for (const aid of caso.esperado.alertas) expect(alertas).toContain(aid);
    });

    it("salida idéntica a la de Python (pasos, orden, alternativas, alertas, programas)", () => {
      expect(res).toStrictEqual(salidaPython[caso.id]);
    });
  });
});
