import { describe, expect, it } from "vitest";
import { createKnowledgeRepo, knowledgeRepo, rawKnowledge } from "./knowledge-repo";

describe("knowledgeRepo", () => {
  it("carga y valida todo data/", () => {
    expect(knowledgeRepo.meta.moneda).toBe("PEN");
    expect(knowledgeRepo.getEtapas()).toHaveLength(7);
    expect(knowledgeRepo.getProcedimientos().length).toBeGreaterThanOrEqual(50);
    expect(knowledgeRepo.getReglas().length).toBeGreaterThanOrEqual(47);
  });

  it("etapas ordenadas por orden", () => {
    const ordenes = knowledgeRepo.getEtapas().map((e) => e.orden);
    expect(ordenes).toEqual([...ordenes].sort((a, b) => a - b));
  });

  it("getters por id", () => {
    const param = knowledgeRepo.getProcedimiento("P-MUN-PARAM");
    expect(param?.etapa_id).toBe("E2");
    expect(knowledgeRepo.getEtapa("E2")?.id).toBe("E2");
    expect(knowledgeRepo.getDistrito("150108")?.nombre).toBe("Chorrillos");
    expect(knowledgeRepo.getZona("Z-PANTANOS-VILLA")?.procedimiento_requerido).toBe("P-PROH-OPINION");
    expect(knowledgeRepo.getPrograma("PR-TP-CSP")?.activo).toBe(true);
    expect(knowledgeRepo.getPregunta("pisos")?.tipo).toBe("numero");
    expect(knowledgeRepo.getVencimientoDeDocumento("D-COPIA-LITERAL")?.vigencia_dias).toBe(30);
    expect(knowledgeRepo.getProcedimiento("P-NO-EXISTE")).toBeUndefined();
  });

  it("referencias de un procedimiento resuelven", () => {
    const p = knowledgeRepo.getProcedimiento("P-MUN-PARAM");
    for (const f of p?.fuentes ?? []) expect(knowledgeRepo.getFuente(f)).toBeDefined();
    for (const n of p?.normas ?? []) expect(knowledgeRepo.getNorma(n)).toBeDefined();
    for (const d of p?.requisitos ?? []) expect(knowledgeRepo.getDocumento(d)).toBeDefined();
    if (p?.institucion_id) expect(knowledgeRepo.getInstitucion(p.institucion_id)).toBeDefined();
  });

  it("tarifas por distrito y procedimiento", () => {
    const tarifas = knowledgeRepo.getTarifas("150114", "P-MUN-PARAM");
    expect(tarifas.length).toBeGreaterThan(0);
    for (const t of tarifas) {
      expect(t.ubigeo).toBe("150114");
      expect(t.procedimiento_id).toBe("P-MUN-PARAM");
      expect(t.fuente_id).toBeTruthy();
    }
    expect(knowledgeRepo.getTarifas("999999", "P-MUN-PARAM")).toEqual([]);
  });

  it("listas completas", () => {
    expect(knowledgeRepo.getDistritos().length).toBeGreaterThanOrEqual(4);
    expect(knowledgeRepo.getZonas().length).toBeGreaterThanOrEqual(3);
    expect(knowledgeRepo.getProgramas().length).toBeGreaterThanOrEqual(5);
    expect(knowledgeRepo.getPreguntas().length).toBeGreaterThanOrEqual(15);
    expect(knowledgeRepo.getVencimientos().length).toBeGreaterThanOrEqual(6);
  });

  it("falla con un mensaje claro si data/ no cumple el esquema", () => {
    const roto = { ...(rawKnowledge as Record<string, unknown>), etapas: [{ id: "X" }] };
    expect(() => createKnowledgeRepo(roto)).toThrow(/data\/ no cumple el esquema/);
  });
});
