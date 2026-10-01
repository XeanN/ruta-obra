import { describe, expect, it } from "vitest";
import casos from "../../fixtures/casos.json";
import { knowledgeRepo } from "@/data/knowledge-repo";
import { analizarExpediente } from "./analisis";
import { ordenarAlertas, type AlertaExpediente } from "./alerts";
import { armarChecklist, resumenChecklist } from "./checklist";
import {
  actualizarDatos,
  actualizarDocumento,
  actualizarPaso,
  crearRegistro,
  migrarRegistro,
  pasoCerrado,
  resumirExpediente,
} from "./expediente";
import { diagnosticar } from "./rules-engine";
import { RespuestasSchema } from "./schemas";
import type { ExpedienteRegistro } from "./types";

const base = knowledgeRepo.baseExpedientes;
const AHORA = "2026-10-01T10:00:00-05:00";
const HOY = "2026-10-01";

function registroDe(casoId: string, id = "exp-1"): ExpedienteRegistro {
  const caso = casos.find((c) => c.id === casoId);
  if (!caso) throw new Error(casoId);
  const respuestas = RespuestasSchema.parse(caso.respuestas);
  return crearRegistro({
    id,
    predioId: `predio-${id}`,
    nombre: "Casa de prueba",
    respuestas,
    predio: { ubigeo: String(respuestas.distrito), direccion: "Av. Prueba 123" },
    actores: [{ id: "a1", rol: "arquitecto", nombre: "Arq. Prueba" }],
    diagnostico: diagnosticar(respuestas, base),
    versionDatos: base.versionDatos,
    ahora: AHORA,
  });
}

describe("crearRegistro", () => {
  it("guarda respuestas, modalidad, versión y todos los pasos en pendiente", () => {
    const r = registroDe("caso-angel");
    const diag = diagnosticar(r.expediente.respuestas_diagnostico, base);
    expect(r.expediente.modalidad).toBe("B");
    expect(r.expediente.version_datos).toBe(base.versionDatos);
    expect(r.expediente.pasos.map((p) => p.procedimiento_id)).toEqual(
      diag.pasos.map((p) => p.procedimiento_id),
    );
    expect(r.expediente.pasos.every((p) => p.estado === "pendiente")).toBe(true);
    expect(r.predio).toEqual({ id: "predio-exp-1", ubigeo: "150108", direccion: "Av. Prueba 123" });
    expect(r.expediente.predio_id).toBe("predio-exp-1");
  });
});

describe("actualizarPaso", () => {
  it("completa la fecha que corresponde al nuevo estado si no se indicó", () => {
    let r = registroDe("caso-angel");
    r = actualizarPaso(r, "P-MUN-PARAM", { estado: "presentado" }, HOY, AHORA);
    r = actualizarPaso(r, "P-MUN-PARAM", { estado: "observado" }, "2026-10-02", AHORA);
    r = actualizarPaso(r, "P-MUN-PARAM", { estado: "aprobado", fecha_resultado: "2026-10-20" }, "2026-10-21", AHORA);
    const p = r.expediente.pasos.find((x) => x.procedimiento_id === "P-MUN-PARAM");
    expect(p).toMatchObject({
      estado: "aprobado",
      fecha_presentacion: HOY,
      fecha_observacion: "2026-10-02",
      fecha_resultado: "2026-10-20",
    });
  });

  it("no pisa una fecha existente y guarda datos del trámite", () => {
    let r = registroDe("caso-angel");
    r = actualizarPaso(r, "P-MUN-PARAM", { estado: "observado", fecha_observacion: "2026-09-25" }, HOY, AHORA);
    r = actualizarPaso(r, "P-MUN-PARAM", { numero_expediente_entidad: "EXP-123", monto_pagado: 92.9 }, HOY, AHORA);
    const p = r.expediente.pasos.find((x) => x.procedimiento_id === "P-MUN-PARAM");
    expect(p).toMatchObject({ fecha_observacion: "2026-09-25", numero_expediente_entidad: "EXP-123", monto_pagado: 92.9 });
  });

  it("es inmutable y falla con un paso inexistente", () => {
    const r = registroDe("caso-angel");
    const r2 = actualizarPaso(r, "P-MUN-PARAM", { estado: "presentado" }, HOY, AHORA);
    expect(r.expediente.pasos.find((x) => x.procedimiento_id === "P-MUN-PARAM")?.estado).toBe("pendiente");
    expect(r2).not.toBe(r);
    expect(() => actualizarPaso(r, "P-NO-EXISTE", { estado: "aprobado" }, HOY, AHORA)).toThrow(/no tiene el paso/);
  });
});

describe("actualizarDocumento y actualizarDatos", () => {
  it("crea y luego actualiza el documento del checklist", () => {
    let r = registroDe("caso-angel");
    r = actualizarDocumento(r, "D-COPIA-LITERAL", { estado: "en_tramite" }, AHORA);
    r = actualizarDocumento(r, "D-COPIA-LITERAL", { estado: "obtenido", fecha_emision: "2026-09-20" }, AHORA);
    expect(r.expediente.documentos).toEqual([
      { id: "doc-D-COPIA-LITERAL", documento_id: "D-COPIA-LITERAL", estado: "obtenido", fecha_emision: "2026-09-20" },
    ]);
  });

  it("actualiza nombre, predio y actores conservando el id del predio", () => {
    const r = actualizarDatos(
      registroDe("caso-angel"),
      { nombre: "Nuevo", predio: { ubigeo: "150108", direccion: "Jr. Otro 9", partida_registral: "P123" }, actores: [] },
      "2026-10-02T09:00:00-05:00",
    );
    expect(r.expediente.nombre).toBe("Nuevo");
    expect(r.predio).toEqual({ id: "predio-exp-1", ubigeo: "150108", direccion: "Jr. Otro 9", partida_registral: "P123" });
    expect(r.expediente.actualizado_en).toBe("2026-10-02T09:00:00-05:00");
  });
});

describe("migrarRegistro", () => {
  it("no cambia nada si la versión de datos es la misma", () => {
    const r = registroDe("caso-angel");
    expect(migrarRegistro(r, diagnosticar(r.expediente.respuestas_diagnostico, base), base.versionDatos, AHORA)).toBe(r);
  });

  it("recalcula los pasos y conserva el avance; los que ya no aplican se quedan solo si tenían avance", () => {
    let r = registroDe("caso-angel");
    r = actualizarPaso(r, "P-MUN-PARAM", { estado: "aprobado" }, HOY, AHORA);
    r = actualizarPaso(r, "P-PROH-OPINION", { estado: "presentado" }, HOY, AHORA);
    r = { ...r, expediente: { ...r.expediente, version_datos: "0.0.9" } };
    // Con otras respuestas (sin zona especial) PROHVILLA ya no aplica y la copia tampoco cambia.
    const otras = { ...r.expediente.respuestas_diagnostico, zona_especial: "ninguna" };
    const diag = diagnosticar(otras, base);
    const m = migrarRegistro(r, diag, base.versionDatos, "2026-10-05T08:00:00-05:00");
    expect(m.expediente.version_datos).toBe(base.versionDatos);
    expect(m.expediente.pasos.find((p) => p.procedimiento_id === "P-MUN-PARAM")?.estado).toBe("aprobado");
    expect(m.expediente.pasos.find((p) => p.procedimiento_id === "P-PROH-OPINION")?.estado).toBe("presentado");
    expect(m.expediente.pasos.slice(0, diag.pasos.length).map((p) => p.procedimiento_id)).toEqual(
      diag.pasos.map((p) => p.procedimiento_id),
    );
    const sinAvance = migrarRegistro(registroDe("caso-angel"), diag, "9.9.9", AHORA);
    expect(sinAvance.expediente.pasos.some((p) => p.procedimiento_id === "P-PROH-OPINION")).toBe(false);
  });
});

describe("resumirExpediente", () => {
  const etapas = base.etapas;
  const alerta = (tipo: AlertaExpediente["tipo"], nivel: AlertaExpediente["nivel"]): AlertaExpediente => ({
    id: `${tipo}-${nivel}`,
    expediente_id: "exp-1",
    tipo,
    fecha: HOY,
    mensaje: "m",
    nivel,
  });

  it("avance sin opcionales, etapa actual y próximo paso", () => {
    let r = registroDe("caso-angel");
    const opcionales = new Set(["P-MUN-ANTEPROY"]);
    const e1 = r.expediente.pasos.filter((p) => p.etapa_id === "E1").map((p) => p.procedimiento_id);
    for (const id of e1) r = actualizarPaso(r, id, { estado: "aprobado" }, HOY, AHORA);
    r = actualizarPaso(r, "P-MUN-ANTEPROY", { estado: "aprobado" }, HOY, AHORA);
    const res = resumirExpediente(r, opcionales, etapas, []);
    const total = r.expediente.pasos.length - 1;
    expect(res.avance).toEqual({ cerrados: e1.length, total, porcentaje: Math.round((e1.length / total) * 100) });
    expect(res.etapaActual?.id).toBe("E2");
    expect(res.proximoPaso?.procedimiento_id).toBe("P-MUN-PARAM");
    expect(res.estado).toBe("en_curso");
  });

  it("con alertas solo por alertas con plazo; terminado cuando todo está cerrado", () => {
    const r = registroDe("unifamiliar-simple");
    expect(resumirExpediente(r, new Set(), etapas, [alerta("regla", "critica")]).estado).toBe("en_curso");
    expect(resumirExpediente(r, new Set(), etapas, [alerta("plazo_subsanacion", "alta")]).estado).toBe("con_alertas");
    let cerrado = r;
    for (const p of r.expediente.pasos) cerrado = actualizarPaso(cerrado, p.procedimiento_id, { estado: "no_aplica" }, HOY, AHORA);
    const res = resumirExpediente(cerrado, new Set(), etapas, []);
    expect(res).toMatchObject({ estado: "terminado", proximoPaso: null, etapaActual: null });
    expect(res.avance.porcentaje).toBe(100);
    expect(pasoCerrado({ estado: "denegado" })).toBe(false);
  });

  it("sin pasos, avance 0 y en curso", () => {
    const r = registroDe("caso-angel");
    const vacio = { ...r, expediente: { ...r.expediente, pasos: [] } };
    expect(resumirExpediente(vacio, new Set(), etapas, []).avance).toEqual({ cerrados: 0, total: 0, porcentaje: 0 });
  });

  it("muestra hasta 3 alertas, primero las de plazo", () => {
    const r = registroDe("caso-angel");
    const alertas = ordenarAlertas([
      alerta("regla", "critica"),
      alerta("vencimiento", "media"),
      alerta("plazo_subsanacion", "critica"),
      alerta("regla", "alta"),
    ]);
    expect(resumirExpediente(r, new Set(), etapas, alertas).proximasAlertas.map((a) => a.tipo)).toEqual([
      "plazo_subsanacion",
      "vencimiento",
      "regla",
    ]);
  });
});

describe("checklist", () => {
  it("une requisitos sin duplicados, sin opcionales ni pasos que no aplican, con origen y vigencia", () => {
    let r = registroDe("caso-angel");
    const items = armarChecklist(r, new Set(["P-MUN-ANTEPROY"]), base, HOY);
    const ids = items.map((i) => i.documento.id);
    expect(new Set(ids).size).toBe(ids.length);
    const copia = items.find((i) => i.documento.id === "D-COPIA-LITERAL");
    expect(copia?.vigenciaDias).toBe(30);
    expect(copia?.seObtieneEn.map((p) => p.id)).toEqual(expect.arrayContaining(["P-SUN-COPIA"]));
    expect(copia?.requeridoPor.length).toBeGreaterThan(0);
    expect(copia?.estado).toBe("falta");

    // Si todos los pasos que piden un documento pasan a "no aplica", sale del checklist.
    for (const p of copia?.requeridoPor ?? []) r = actualizarPaso(r, p.id, { estado: "no_aplica" }, HOY, AHORA);
    expect(armarChecklist(r, new Set(), base, HOY).some((i) => i.documento.id === "D-COPIA-LITERAL")).toBe(false);
  });

  it("calcula vencimiento y pasa a vencido solo", () => {
    const r = actualizarDocumento(registroDe("caso-angel"), "D-COPIA-LITERAL", { estado: "obtenido", fecha_emision: "2026-09-01" }, AHORA);
    const vigente = armarChecklist(r, new Set(), base, "2026-09-25").find((i) => i.documento.id === "D-COPIA-LITERAL");
    expect(vigente).toMatchObject({ estado: "obtenido", fechaVencimiento: "2026-10-01", diasParaVencer: 6 });
    const vencida = armarChecklist(r, new Set(), base, "2026-10-02").find((i) => i.documento.id === "D-COPIA-LITERAL");
    expect(vencida).toMatchObject({ estado: "vencido", diasParaVencer: -1 });
    expect(resumenChecklist([vencida!]).vencido).toBe(1);
  });
});

describe("analizarExpediente", () => {
  it("reúne diagnóstico, hoja, checklist, alertas y resumen; migra si cambió la versión", () => {
    const r = registroDe("caso-angel");
    const a = analizarExpediente(r, base, HOY, AHORA);
    expect(a.migrado).toBe(false);
    expect(a.hoja.etapas.length).toBeGreaterThan(0);
    expect(a.opcionales.has("P-MUN-ANTEPROY")).toBe(true);
    expect(a.alertas.map((x) => x.origen_id)).toEqual(expect.arrayContaining(["A-TITULO-BLOQUEA", "A-PANTANOS"]));
    expect(a.resumen.proximoPaso?.procedimiento_id).toBe(r.expediente.pasos[0]?.procedimiento_id);

    const viejo = { ...r, expediente: { ...r.expediente, version_datos: "0.0.1" } };
    expect(analizarExpediente(viejo, base, HOY, AHORA).migrado).toBe(true);
  });
});
