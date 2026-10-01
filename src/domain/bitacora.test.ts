import { describe, expect, it } from "vitest";
import {
  actualizarEntrada,
  agregarEntrada,
  agruparPorMes,
  eliminarEntrada,
  filtrarEntradas,
  fotosQuitadas,
  mesDe,
  ordenarEntradas,
  totalesBitacora,
} from "./bitacora";
import type { EntradaBitacora, ExpedienteRegistro } from "./types";

const AHORA = "2026-10-05T10:00:00Z";
const registro = (bitacora?: EntradaBitacora[]): ExpedienteRegistro => ({
  predio: { id: "p", ubigeo: "150108", direccion: "x" },
  expediente: {
    id: "e",
    predio_id: "p",
    nombre: "Casa",
    respuestas_diagnostico: {},
    modalidad: "B",
    pasos: [],
    bitacora,
    creado_en: "2026-10-01T00:00:00Z",
  },
});
const e = (id: string, fecha: string, extra: Partial<EntradaBitacora> = {}): EntradaBitacora => ({
  id,
  fecha,
  tipo: "otro",
  descripcion: id,
  ...extra,
});

// Diez entradas de un mes y medio de obra (aceptación: los totales cuadran).
const DIEZ: EntradaBitacora[] = [
  e("1", "2026-09-28", { tipo: "compra", monto: 1250.5, actor_id: "maestro" }),
  e("2", "2026-09-29", { tipo: "pago", monto: 800, actor_id: "maestro" }),
  e("3", "2026-09-30", { tipo: "avance", avance_pct: 5 }),
  e("4", "2026-10-01", { tipo: "compra", monto: 349.9 }),
  e("5", "2026-10-01", { tipo: "visita_municipal", descripcion: "Verificación técnica" }),
  e("6", "2026-10-02", { tipo: "pago", monto: 800, actor_id: "maestro" }),
  e("7", "2026-10-03", { tipo: "avance", avance_pct: 12, fotos: ["f1", "f2"] }),
  e("8", "2026-10-04", { tipo: "incidencia", monto: 120.1 }),
  e("9", "2026-10-05", { tipo: "reunion" }),
  e("10", "2026-10-05", { tipo: "compra", monto: 0.1 }),
];

describe("totalesBitacora (10 entradas)", () => {
  const t = totalesBitacora(DIEZ);

  it("total = suma de montos, sin errores de coma flotante", () => {
    expect(t.total).toBe(3320.6);
    expect(t.entradas).toBe(10);
    expect(t.entradasConMonto).toBe(6);
  });

  it("por tipo, de mayor a menor, y cuadra con el total", () => {
    expect(t.porTipo).toEqual([
      { tipo: "compra", total: 1600.5 },
      { tipo: "pago", total: 1600 },
      { tipo: "incidencia", total: 120.1 },
    ]);
    expect(t.porTipo.reduce((s, x) => s + x.total, 0)).toBeCloseTo(t.total, 2);
  });

  it("por mes, del más reciente, y cuadra con el total", () => {
    expect(t.porMes).toEqual([
      { mes: "2026-10", total: 1270.1 },
      { mes: "2026-09", total: 2050.5 },
    ]);
    expect(t.porMes.reduce((s, x) => s + x.total, 0)).toBeCloseTo(t.total, 2);
  });

  it("último avance por fecha", () => {
    expect(t.ultimoAvance).toEqual({ pct: 12, fecha: "2026-10-03" });
  });

  it("sin entradas", () => {
    expect(totalesBitacora([])).toEqual({
      total: 0,
      porTipo: [],
      porMes: [],
      ultimoAvance: null,
      entradas: 0,
      entradasConMonto: 0,
    });
  });
});

describe("orden, filtros y grupos", () => {
  it("más reciente primero; a igual fecha, la registrada después primero", () => {
    expect(ordenarEntradas(DIEZ).map((x) => x.id).slice(0, 4)).toEqual(["10", "9", "8", "7"]);
    expect(ordenarEntradas(DIEZ).map((x) => x.id).slice(-1)).toEqual(["1"]);
  });

  it("filtra por tipo y por responsable", () => {
    expect(filtrarEntradas(DIEZ, { tipo: "pago" }).map((x) => x.id)).toEqual(["2", "6"]);
    expect(filtrarEntradas(DIEZ, { actorId: "maestro" }).map((x) => x.id)).toEqual(["1", "2", "6"]);
    expect(filtrarEntradas(DIEZ, { tipo: "compra", actorId: "maestro" }).map((x) => x.id)).toEqual(["1"]);
    expect(filtrarEntradas(DIEZ, {})).toHaveLength(10);
  });

  it("agrupa por mes en orden cronológico inverso", () => {
    const g = agruparPorMes(DIEZ);
    expect(g.map((x) => [x.mes, x.entradas.length])).toEqual([
      ["2026-10", 7],
      ["2026-09", 3],
    ]);
    expect(mesDe("2026-10-05")).toBe("2026-10");
  });
});

describe("cambios en el registro", () => {
  it("agrega, edita y elimina; actualiza actualizado_en y no muta el original", () => {
    const r0 = registro();
    const r1 = agregarEntrada(r0, e("a", "2026-10-01", { monto: 10, fotos: ["f1", "f2"] }), AHORA);
    expect(r0.expediente.bitacora).toBeUndefined();
    expect(r1.expediente.bitacora).toHaveLength(1);
    expect(r1.expediente.actualizado_en).toBe(AHORA);

    const r2 = actualizarEntrada(r1, e("a", "2026-10-02", { monto: 20, fotos: ["f2"] }), "2026-10-06T00:00:00Z");
    expect(r2.expediente.bitacora?.[0]).toMatchObject({ fecha: "2026-10-02", monto: 20 });

    const { registro: r3, fotosEliminadas } = eliminarEntrada(r2, "a", AHORA);
    expect(r3.expediente.bitacora).toEqual([]);
    expect(fotosEliminadas).toEqual(["f2"]);
  });

  it("errores por id repetido o inexistente", () => {
    const r = agregarEntrada(registro([]), e("a", "2026-10-01"), AHORA);
    expect(() => agregarEntrada(r, e("a", "2026-10-01"), AHORA)).toThrow(/Ya existe/);
    expect(() => actualizarEntrada(r, e("z", "2026-10-01"), AHORA)).toThrow(/No existe/);
    expect(() => eliminarEntrada(r, "z", AHORA)).toThrow(/No existe/);
  });

  it("fotos quitadas al editar", () => {
    expect(fotosQuitadas(e("a", "x", { fotos: ["1", "2", "3"] }), e("a", "x", { fotos: ["2"] }))).toEqual(["1", "3"]);
    expect(fotosQuitadas(e("a", "x"), e("a", "x"))).toEqual([]);
  });
});
