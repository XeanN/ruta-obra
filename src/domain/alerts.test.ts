import { describe, expect, it } from "vitest";
import casos from "../../fixtures/casos.json";
import { knowledgeRepo } from "@/data/knowledge-repo";
import { generarAlertas, ordenarAlertas, type AlertaExpediente } from "./alerts";
import { armarChecklist } from "./checklist";
import { actualizarDocumento, actualizarPaso, crearRegistro } from "./expediente";
import { diagnosticar } from "./rules-engine";
import { RespuestasSchema } from "./schemas";
import type { ExpedienteRegistro } from "./types";

const base = knowledgeRepo.baseExpedientes;
const AHORA = "2026-10-01T10:00:00-05:00";

function registro(): ExpedienteRegistro {
  const respuestas = RespuestasSchema.parse(casos.find((c) => c.id === "unifamiliar-simple")!.respuestas);
  return crearRegistro({
    id: "exp-1",
    predioId: "pre-1",
    nombre: "Casa",
    respuestas,
    predio: { ubigeo: "150140", direccion: "x" },
    actores: [],
    diagnostico: diagnosticar(respuestas, base),
    versionDatos: base.versionDatos,
    ahora: AHORA,
  });
}

function alertas(r: ExpedienteRegistro, hoy: string, feriados?: string[]): AlertaExpediente[] {
  const checklist = armarChecklist(r, new Set(), base, hoy);
  const diag = diagnosticar(r.expediente.respuestas_diagnostico, base);
  return generarAlertas(r, checklist, diag.alertas, { ...base, feriados }, hoy);
}

describe("plazo de subsanación (aceptación: 5 días hábiles)", () => {
  // Observación recibida el viernes 02/10/2026 → límite viernes 09/10/2026.
  const observado = () =>
    actualizarPaso(registro(), "P-MUN-PARAM", { estado: "observado", fecha_observacion: "2026-10-02" }, "2026-10-02", AHORA);

  it("genera la alerta con el límite en días hábiles", () => {
    const a = alertas(observado(), "2026-10-02").find((x) => x.tipo === "plazo_subsanacion");
    expect(a).toMatchObject({
      id: "subsanar-P-MUN-PARAM",
      origen_id: "V-SUBSANAR",
      fecha: "2026-10-09",
      dias: 5,
      habiles: true,
      nivel: "media",
    });
    expect(a?.mensaje).toMatch(/^Certificado de Parámetros.*5 días hábiles para subsanar/);
  });

  it("sube de nivel al acercarse y es crítica si venció", () => {
    expect(alertas(observado(), "2026-10-07").find((x) => x.tipo === "plazo_subsanacion")).toMatchObject({ dias: 2, nivel: "alta" });
    expect(alertas(observado(), "2026-10-12").find((x) => x.tipo === "plazo_subsanacion")).toMatchObject({ dias: -1, nivel: "critica" });
  });

  it("respeta feriados", () => {
    expect(alertas(observado(), "2026-10-02", ["2026-10-08"]).find((x) => x.tipo === "plazo_subsanacion")?.fecha).toBe("2026-10-12");
  });

  it("desaparece cuando el paso deja de estar observado", () => {
    const r = actualizarPaso(observado(), "P-MUN-PARAM", { estado: "subsanado" }, "2026-10-05", AHORA);
    expect(alertas(r, "2026-10-05").some((x) => x.tipo === "plazo_subsanacion")).toBe(false);
  });

  it("sin regla de subsanación en los datos no hay alerta", () => {
    const r = observado();
    const checklist = armarChecklist(r, new Set(), base, "2026-10-02");
    const sinRegla = { ...base, vencimientos: base.vencimientos.filter((v) => v.evento !== "observacion_recibida") };
    expect(generarAlertas(r, checklist, [], sinRegla, "2026-10-02")).toEqual([]);
  });
});

describe("vencimiento de documentos", () => {
  it("copia literal: avisa desde 7 días antes, alta a 2 días y crítica vencida", () => {
    const r = actualizarDocumento(registro(), "D-COPIA-LITERAL", { estado: "obtenido", fecha_emision: "2026-09-01" }, AHORA);
    // Vence el 01/10/2026.
    expect(alertas(r, "2026-09-23").some((x) => x.tipo === "vencimiento")).toBe(false);
    expect(alertas(r, "2026-09-24").find((x) => x.tipo === "vencimiento")).toMatchObject({
      fecha: "2026-10-01",
      dias: 7,
      nivel: "media",
      origen_id: "V-COPIA-LITERAL",
    });
    expect(alertas(r, "2026-09-29").find((x) => x.tipo === "vencimiento")?.nivel).toBe("alta");
    expect(alertas(r, "2026-10-03").find((x) => x.tipo === "vencimiento")).toMatchObject({ nivel: "critica", dias: -2 });
  });

  it("no avisa por documentos en trámite ni sin fecha", () => {
    const r = actualizarDocumento(registro(), "D-COPIA-LITERAL", { estado: "en_tramite", fecha_emision: "2026-09-01" }, AHORA);
    expect(alertas(r, "2026-10-01").some((x) => x.tipo === "vencimiento")).toBe(false);
  });

  it("licencia aprobada: vence a los 36 meses del resultado y avisa desde 120 días antes", () => {
    const r = actualizarPaso(registro(), "P-MUN-LIC-A", { estado: "aprobado", fecha_resultado: "2026-01-15" }, "2026-01-15", AHORA);
    // vigencia_dias = 1095 (no "36 meses"): 15/01/2026 + 1095 días = 14/01/2029, porque 2028 es bisiesto.
    expect(alertas(r, "2028-09-01").some((x) => x.origen_id === "V-LICENCIA")).toBe(false);
    const a = alertas(r, "2028-10-01").find((x) => x.origen_id === "V-LICENCIA");
    expect(a).toMatchObject({ fecha: "2029-01-14", nivel: "media" });
    expect(alertas(r, "2029-01-05").find((x) => x.origen_id === "V-LICENCIA")?.nivel).toBe("alta");
  });

  it("lo anotado en el checklist manda sobre lo deducido de un paso aprobado", () => {
    let r = actualizarPaso(registro(), "P-SUN-COPIA", { estado: "aprobado", fecha_resultado: "2026-08-01" }, "2026-08-01", AHORA);
    r = actualizarDocumento(r, "D-COPIA-LITERAL", { estado: "obtenido", fecha_emision: "2026-09-20" }, AHORA);
    expect(alertas(r, "2026-10-15").find((x) => x.origen_id === "V-COPIA-LITERAL")?.fecha).toBe("2026-10-20");
  });

  it("si dos pasos producen el mismo documento, vale el resultado más reciente", () => {
    let r = actualizarPaso(registro(), "P-SUN-COPIA", { estado: "aprobado", fecha_resultado: "2026-09-25" }, "2026-09-25", AHORA);
    const conInscripcion = {
      ...r,
      expediente: {
        ...r.expediente,
        pasos: [
          ...r.expediente.pasos,
          { procedimiento_id: "P-SUN-INSC-CV", etapa_id: "E1", estado: "aprobado" as const, fecha_resultado: "2026-09-10" },
        ],
      },
    };
    r = conInscripcion;
    expect(alertas(r, "2026-10-20").find((x) => x.origen_id === "V-COPIA-LITERAL")?.fecha).toBe("2026-10-25");
  });

  it("no avisa si todos los pasos que piden el documento ya se cerraron", () => {
    let r = actualizarDocumento(registro(), "D-COPIA-LITERAL", { estado: "obtenido", fecha_emision: "2026-09-01" }, AHORA);
    const pideCopia = armarChecklist(r, new Set(), base, "2026-10-03").find((i) => i.documento.id === "D-COPIA-LITERAL");
    expect(pideCopia?.requeridoPor.length).toBeGreaterThan(0);
    for (const proc of pideCopia?.requeridoPor ?? []) {
      expect(alertas(r, "2026-10-03").some((x) => x.origen_id === "V-COPIA-LITERAL")).toBe(true);
      r = actualizarPaso(r, proc.id, { estado: "aprobado", fecha_resultado: "2026-09-20" }, "2026-09-20", AHORA);
    }
    expect(alertas(r, "2026-10-03").some((x) => x.origen_id === "V-COPIA-LITERAL")).toBe(false);
  });
});

describe("alertas del diagnóstico y orden", () => {
  it("incluye las alertas de reglas al final, con la fecha de creación", () => {
    const respuestas = RespuestasSchema.parse(casos.find((c) => c.id === "caso-angel")!.respuestas);
    const r = actualizarPaso(
      crearRegistro({
        id: "e",
        predioId: "p",
        nombre: "n",
        respuestas,
        predio: { ubigeo: "150108", direccion: "x" },
        actores: [],
        diagnostico: diagnosticar(respuestas, base),
        versionDatos: base.versionDatos,
        ahora: AHORA,
      }),
      "P-MUN-PARAM",
      { estado: "observado", fecha_observacion: "2026-10-01" },
      "2026-10-01",
      AHORA,
    );
    const lista = alertas(r, "2026-10-01");
    expect(lista[0]?.tipo).toBe("plazo_subsanacion");
    expect(lista.slice(1).map((a) => a.id)).toEqual(["regla-A-TITULO-BLOQUEA", "regla-A-PANTANOS"]);
    expect(lista[1]).toMatchObject({ tipo: "regla", fecha: "2026-10-01", nivel: "critica" });
  });

  it("ordena por tipo, nivel y fecha", () => {
    const a = (id: string, tipo: AlertaExpediente["tipo"], nivel: AlertaExpediente["nivel"], fecha: string): AlertaExpediente => ({
      id,
      expediente_id: "e",
      tipo,
      nivel,
      fecha,
      mensaje: "",
    });
    const orden = ordenarAlertas([
      a("1", "regla", "critica", "2026-01-01"),
      a("2", "vencimiento", "media", "2026-01-05"),
      a("3", "vencimiento", "media", "2026-01-02"),
      a("4", "plazo_subsanacion", "alta", "2026-03-01"),
    ]).map((x) => x.id);
    expect(orden).toEqual(["4", "3", "2", "1"]);
  });
});
