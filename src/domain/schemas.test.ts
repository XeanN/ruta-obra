import { describe, expect, it } from "vitest";
import {
  AlertaSchema,
  CondicionSchema,
  ExpedienteSchema,
  PreguntaSchema,
  ReglaSchema,
} from "./schemas";

const expediente = {
  id: "exp-1",
  predio_id: "pre-1",
  nombre: "Casa Chorrillos",
  respuestas_diagnostico: { titulo: "inscrito", pisos: 3 },
  modalidad: "B",
  pasos: [
    { procedimiento_id: "P-MUN-PARAM", etapa_id: "E2", estado: "presentado", fecha_presentacion: "2026-10-01" },
  ],
  bitacora: [{ id: "b-1", fecha: "2026-10-02", tipo: "pago", descripcion: "Derecho de trámite", monto: 120.5 }],
  creado_en: "2026-09-30T21:00:00-05:00",
};

describe("ExpedienteSchema", () => {
  it("acepta un expediente válido", () => {
    expect(ExpedienteSchema.parse(expediente).pasos[0]?.estado).toBe("presentado");
  });

  it("rechaza estados, fechas y porcentajes inválidos", () => {
    const pasoMalo = { ...expediente, pasos: [{ procedimiento_id: "P", etapa_id: "E1", estado: "listo" }] };
    expect(ExpedienteSchema.safeParse(pasoMalo).success).toBe(false);
    const fechaMala = { ...expediente, creado_en: "30/09/2026" };
    expect(ExpedienteSchema.safeParse(fechaMala).success).toBe(false);
    const avanceMalo = {
      ...expediente,
      bitacora: [{ id: "b", fecha: "2026-10-02", tipo: "avance", descripcion: "x", avance_pct: 120 }],
    };
    expect(ExpedienteSchema.safeParse(avanceMalo).success).toBe(false);
  });

  it("acepta modalidad null (diagnóstico sin modalidad)", () => {
    expect(ExpedienteSchema.safeParse({ ...expediente, modalidad: null }).success).toBe(true);
  });
});

describe("AlertaSchema", () => {
  it("valida tipo y nivel", () => {
    const alerta = { id: "a", expediente_id: "e", tipo: "plazo_subsanacion", fecha: "2026-10-09", mensaje: "m", nivel: "alta" };
    expect(AlertaSchema.safeParse(alerta).success).toBe(true);
    expect(AlertaSchema.safeParse({ ...alerta, nivel: "urgente" }).success).toBe(false);
  });
});

describe("ReglaSchema", () => {
  it("exige los campos propios de cada tipo", () => {
    expect(ReglaSchema.safeParse({ id: "R", tipo: "alerta", si: { todas: [] } }).success).toBe(false);
    expect(ReglaSchema.safeParse({ id: "R", tipo: "modalidad", si: { todas: [] }, orden: 1 }).success).toBe(false);
    expect(
      ReglaSchema.safeParse({ id: "R", tipo: "agregar_procedimientos", si: { todas: [] }, procedimientos: [] }).success,
    ).toBe(false);
  });

  it("valida condiciones anidadas", () => {
    expect(CondicionSchema.safeParse({ todas: [{ alguna: [{ campo: "x", mayor: "3" }] }] }).success).toBe(false);
  });
});

describe("PreguntaSchema", () => {
  it("una pregunta de opción necesita opciones", () => {
    expect(PreguntaSchema.safeParse({ id: "q", texto: "t", tipo: "opcion", obligatoria: true, opciones: [] }).success).toBe(false);
  });
});
