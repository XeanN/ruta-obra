import { describe, expect, it } from "vitest";
import { contratoRepositorio, registroDePrueba } from "./expediente-repo.contrato";
import {
  ConflictoVersionError,
  ExpedienteRepository,
  RepositorioNoDisponibleError,
  SesionRequeridaError,
} from "./expediente-repo";
import { crearRepositorioLocal } from "./expediente-repo.local";
import { crearRepositorioRemoto, type AccionesExpedientes } from "./expediente-repo.remoto";
import type { CodigoError, Resultado } from "./resultado-accion";

/** Simula las Server Actions sobre otro repositorio, con el mismo mapeo de errores del servidor. */
function accionesSobre(repo: ExpedienteRepository): AccionesExpedientes {
  const envolver = async <T>(fn: () => Promise<T>): Promise<Resultado<T>> => {
    try {
      return { ok: true, datos: await fn() };
    } catch (e) {
      const nombre = e instanceof Error ? e.name : "";
      const mapa: Record<string, CodigoError> = {
        ExpedienteNoEncontradoError: "no_encontrado",
        ExpedienteYaExisteError: "ya_existe",
        ConflictoVersionError: "conflicto",
        ImportacionInvalidaError: "invalido",
      };
      return { ok: false, error: mapa[nombre] ?? "interno", mensaje: String(e) };
    }
  };
  return {
    listarExpedientes: () => envolver(() => repo.listar()),
    obtenerExpediente: (id) => envolver(() => repo.obtener(id)),
    crearExpediente: (r) => envolver(async () => (await repo.crear(r), null)),
    actualizarExpediente: (r, v) => envolver(async () => (await repo.actualizar(r, { versionBase: v }), null)),
    eliminarExpediente: (id) => envolver(async () => (await repo.eliminar(id), null)),
    exportarExpediente: (id) => envolver(() => repo.exportar(id)),
    importarExpediente: (j, m) => envolver(() => repo.importar(j, m)),
  };
}

function enMemoria() {
  const datos = new Map<string, string>();
  let n = 0;
  return crearRepositorioLocal({
    almacenamiento: () => ({ getItem: (k) => datos.get(k) ?? null, setItem: (k, v) => void datos.set(k, v) }),
    generarId: () => `nuevo-${++n}`,
    ahora: () => "2026-10-02T09:00:00Z",
  });
}

contratoRepositorio("remoto (Server Actions)", {
  crear: async () => crearRepositorioRemoto(accionesSobre(enMemoria())),
});

describe("repositorio remoto: errores", () => {
  const fallo = (error: CodigoError) => async () => ({ ok: false as const, error, mensaje: "x" });
  const remoto = (sobre: Partial<AccionesExpedientes>) =>
    crearRepositorioRemoto({ ...accionesSobre(enMemoria()), ...sobre });

  it("sesión vencida → SesionRequeridaError", async () => {
    await expect(remoto({ listarExpedientes: fallo("sesion") }).listar()).rejects.toBeInstanceOf(SesionRequeridaError);
  });

  it("sin conexión → RepositorioNoDisponibleError", async () => {
    const r = remoto({
      listarExpedientes: async () => {
        throw new TypeError("Failed to fetch");
      },
    });
    await expect(r.listar()).rejects.toBeInstanceOf(RepositorioNoDisponibleError);
  });

  it("conflicto e interno", async () => {
    const r = remoto({ actualizarExpediente: fallo("conflicto"), eliminarExpediente: fallo("interno") });
    await expect(r.actualizar(registroDePrueba("a"))).rejects.toBeInstanceOf(ConflictoVersionError);
    await expect(r.eliminar("a")).rejects.toThrow("x");
  });
});
