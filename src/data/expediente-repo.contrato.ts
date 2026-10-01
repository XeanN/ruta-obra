// Pruebas de contrato de ExpedienteRepository: TODA implementación (navegador, Postgres y las que
// vengan, como AWS) debe pasarlas. Se registran con contratoRepositorio() desde cada *.test.ts.
import { describe, expect, it } from "vitest";
import type { ExpedienteRegistro } from "@/domain/types";
import {
  ConflictoVersionError,
  ExpedienteNoEncontradoError,
  ExpedienteYaExisteError,
  ImportacionInvalidaError,
  type ExpedienteRepository,
} from "./expediente-repo";

export function registroDePrueba(id: string, nombre = "Casa"): ExpedienteRegistro {
  return {
    predio: {
      id: `pre-${id}`,
      ubigeo: "150108",
      direccion: "Av. 1",
      partida_registral: "P0001",
      area_terreno_m2: 120.5,
      coordenadas: { lat: -12.17, lng: -77.02 },
    },
    expediente: {
      id,
      predio_id: `pre-${id}`,
      nombre,
      respuestas_diagnostico: { titulo: "inscrito", pisos: 3, distrito: "150108" },
      modalidad: "B",
      version_datos: "0.1.0",
      actores: [
        { id: "a1", rol: "arquitecto", nombre: "Arq. Uno", colegiatura: "CAP 123" },
        { id: "a2", rol: "propietario", nombre: "Dueña", telefono: "999", email: "duena@ejemplo.pe" },
      ],
      pasos: [
        { procedimiento_id: "P-SUN-COPIA", etapa_id: "E1", estado: "aprobado", fecha_resultado: "2026-09-20", monto_pagado: 5 },
        {
          procedimiento_id: "P-MUN-PARAM",
          etapa_id: "E2",
          estado: "observado",
          fecha_presentacion: "2026-09-25",
          fecha_observacion: "2026-10-01",
          numero_expediente_entidad: "EXP-1",
          notas: "Falta plano",
        },
        { procedimiento_id: "P-MUN-LIC-B", etapa_id: "E5", estado: "pendiente" },
      ],
      documentos: [{ id: "doc-D-COPIA-LITERAL", documento_id: "D-COPIA-LITERAL", estado: "obtenido", fecha_emision: "2026-09-20" }],
      bitacora: [
        { id: "b1", fecha: "2026-10-01", tipo: "pago", descripcion: "Derecho de trámite", monto: 92.9, actor_id: "a1" },
        { id: "b2", fecha: "2026-10-02", tipo: "avance", descripcion: "Excavación", avance_pct: 10, fotos: ["k/1.jpg"] },
      ],
      creado_en: "2026-10-01T10:00:00-05:00",
      actualizado_en: "2026-10-01T10:00:00-05:00",
    },
  };
}

export interface FabricaRepositorio {
  /** Repositorio vacío y aislado para cada test. */
  crear: () => Promise<ExpedienteRepository>;
}

export function contratoRepositorio(nombre: string, fabrica: FabricaRepositorio) {
  describe(`contrato ExpedienteRepository: ${nombre}`, () => {
    it("crea, obtiene y lista conservando TODO el registro (pasos, orden, actores, documentos, bitácora)", async () => {
      const repo = await fabrica.crear();
      const r = registroDePrueba("a");
      await repo.crear(r);
      expect(await repo.obtener("a")).toEqual(r);
      expect((await repo.listar()).registros).toEqual([r]);
    });

    it("un id repetido lanza ExpedienteYaExisteError", async () => {
      const repo = await fabrica.crear();
      await repo.crear(registroDePrueba("a"));
      await expect(repo.crear(registroDePrueba("a"))).rejects.toBeInstanceOf(ExpedienteYaExisteError);
    });

    it("actualiza reemplazando pasos y documentos; obtener devuelve null si no existe", async () => {
      const repo = await fabrica.crear();
      await repo.crear(registroDePrueba("a"));
      const r = registroDePrueba("a", "Editada");
      r.expediente.pasos = r.expediente.pasos.slice(1).map((p) => ({ ...p, estado: "aprobado" }));
      r.expediente.documentos = [];
      r.predio.direccion = "Jr. Nuevo 2";
      r.expediente.actualizado_en = "2026-10-02T09:00:00-05:00";
      await repo.actualizar(r);
      expect(await repo.obtener("a")).toEqual(r);
      expect(await repo.obtener("no-existe")).toBeNull();
      await expect(repo.actualizar(registroDePrueba("zz"))).rejects.toBeInstanceOf(ExpedienteNoEncontradoError);
    });

    it("detecta cambios concurrentes con versionBase", async () => {
      const repo = await fabrica.crear();
      const original = registroDePrueba("a");
      await repo.crear(original);
      const base = original.expediente.actualizado_en;
      const deUno = { ...original, expediente: { ...original.expediente, nombre: "Uno", actualizado_en: "2026-10-02T10:00:00Z" } };
      await repo.actualizar(deUno, { versionBase: base });
      const deOtro = { ...original, expediente: { ...original.expediente, nombre: "Otro", actualizado_en: "2026-10-02T10:01:00Z" } };
      await expect(repo.actualizar(deOtro, { versionBase: base })).rejects.toBeInstanceOf(ConflictoVersionError);
      expect((await repo.obtener("a"))?.expediente.nombre).toBe("Uno");
    });

    it("elimina", async () => {
      const repo = await fabrica.crear();
      await repo.crear(registroDePrueba("a"));
      await repo.crear(registroDePrueba("b"));
      await repo.eliminar("a");
      expect((await repo.listar()).registros.map((x) => x.expediente.id)).toEqual(["b"]);
      await expect(repo.eliminar("a")).rejects.toBeInstanceOf(ExpedienteNoEncontradoError);
    });

    it("exporta e importa: conflicto, reemplazar y duplicar", async () => {
      const repo = await fabrica.crear();
      await repo.crear(registroDePrueba("a", "Original"));
      const json = await repo.exportar("a");
      expect(JSON.parse(json)).toMatchObject({ formato: "rutaobra-expediente", version: 1 });

      expect(await repo.importar(json)).toEqual({ estado: "conflicto", id: "a", nombreExistente: "Original" });

      const dup = await repo.importar(json, "duplicar");
      expect(dup.estado).toBe("importado");
      const copia = await repo.obtener(dup.id);
      expect(copia?.expediente.nombre).toBe("Original (copia)");
      expect(copia?.expediente.pasos).toEqual(registroDePrueba("a").expediente.pasos);
      expect(copia?.predio.id).not.toBe("pre-a");

      const editado = JSON.stringify({ ...JSON.parse(json), registro: registroDePrueba("a", "Del respaldo") });
      expect(await repo.importar(editado, "reemplazar")).toEqual({ estado: "importado", id: "a" });
      expect((await repo.obtener("a"))?.expediente.nombre).toBe("Del respaldo");

      await expect(repo.importar("no es json")).rejects.toBeInstanceOf(ImportacionInvalidaError);
      await expect(repo.exportar("no")).rejects.toBeInstanceOf(ExpedienteNoEncontradoError);
    });

    it("registros mínimos: sin actores, documentos ni bitácora y modalidad null", async () => {
      const repo = await fabrica.crear();
      const r = registroDePrueba("m");
      r.predio = { id: "pre-m", ubigeo: "otro", direccion: "S/N" };
      r.expediente = {
        id: "m",
        predio_id: "pre-m",
        nombre: "Mínimo",
        respuestas_diagnostico: {},
        modalidad: null,
        pasos: [],
        actores: [],
        documentos: [],
        bitacora: [],
        creado_en: "2026-10-01T10:00:00Z",
      };
      await repo.crear(r);
      expect(await repo.obtener("m")).toEqual(r);
    });
  });
}
