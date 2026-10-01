// Implementación del repositorio con localStorage (prototipo, sin backend).
// Todo acceso al almacenamiento va en try/catch: en modo privado o con el almacenamiento
// bloqueado se lanza RepositorioNoDisponibleError y la UI avisa en vez de romperse.
import { ExpedienteRegistroSchema } from "@/domain/schemas";
import type { ExpedienteRegistro } from "@/domain/types";
import {
  ConflictoVersionError,
  ExpedienteNoEncontradoError,
  ExpedienteYaExisteError,
  importarRespaldo,
  RepositorioNoDisponibleError,
  serializarRespaldo,
  type ExpedienteRepository,
  type ListaExpedientes,
  type ResultadoImportacion,
} from "./expediente-repo";

export const CLAVE_ALMACENAMIENTO = "rutaobra.expedientes.v1";

export type AlmacenamientoSimple = Pick<Storage, "getItem" | "setItem">;

export interface OpcionesRepositorioLocal {
  /** Devuelve el almacenamiento (window.localStorage en el navegador). Puede lanzar. */
  almacenamiento: () => AlmacenamientoSimple;
  generarId: () => string;
  ahora: () => string;
}

const idDe = (crudo: unknown): string | undefined => {
  if (typeof crudo !== "object" || crudo === null) return undefined;
  const exp = (crudo as { expediente?: { id?: unknown } }).expediente;
  return typeof exp?.id === "string" ? exp.id : undefined;
};

export function crearRepositorioLocal(op: OpcionesRepositorioLocal): ExpedienteRepository {
  function storage(): AlmacenamientoSimple {
    try {
      return op.almacenamiento();
    } catch (e) {
      throw new RepositorioNoDisponibleError(e);
    }
  }

  /** Todo lo guardado, sin validar (los registros corruptos se conservan tal cual). */
  function leerCrudo(): unknown[] {
    let texto: string | null;
    try {
      texto = storage().getItem(CLAVE_ALMACENAMIENTO);
    } catch (e) {
      throw new RepositorioNoDisponibleError(e);
    }
    if (!texto) return [];
    try {
      const datos: unknown = JSON.parse(texto);
      return Array.isArray(datos) ? datos : [];
    } catch {
      return [];
    }
  }

  function escribirCrudo(lista: unknown[]): void {
    try {
      storage().setItem(CLAVE_ALMACENAMIENTO, JSON.stringify(lista));
    } catch (e) {
      throw new RepositorioNoDisponibleError(e);
    }
  }

  function leerValidos(): ListaExpedientes {
    const registros: ExpedienteRegistro[] = [];
    let corruptos = 0;
    for (const crudo of leerCrudo()) {
      const r = ExpedienteRegistroSchema.safeParse(crudo);
      if (r.success) registros.push(r.data);
      else corruptos++;
    }
    return { registros, corruptos };
  }

  function guardar(registro: ExpedienteRegistro, debeExistir: boolean, versionBase?: string): void {
    const valido = ExpedienteRegistroSchema.parse(registro);
    const lista = leerCrudo();
    const i = lista.findIndex((x) => idDe(x) === valido.expediente.id);
    if (debeExistir && i === -1) throw new ExpedienteNoEncontradoError(valido.expediente.id);
    if (!debeExistir && i !== -1) throw new ExpedienteYaExisteError(valido.expediente.id);
    if (versionBase !== undefined && i !== -1) {
      const actual = ExpedienteRegistroSchema.safeParse(lista[i]);
      if (actual.success && (actual.data.expediente.actualizado_en ?? "") !== versionBase) {
        throw new ConflictoVersionError(valido.expediente.id);
      }
    }
    if (i === -1) lista.push(valido);
    else lista[i] = valido;
    escribirCrudo(lista);
  }

  const repo: ExpedienteRepository = {
    async listar() {
      return leerValidos();
    },

    async obtener(id) {
      return leerValidos().registros.find((r) => r.expediente.id === id) ?? null;
    },

    async crear(registro) {
      guardar(registro, false);
    },

    async actualizar(registro, opciones) {
      guardar(registro, true, opciones?.versionBase);
    },

    async eliminar(id) {
      const lista = leerCrudo();
      const restantes = lista.filter((x) => idDe(x) !== id);
      if (restantes.length === lista.length) throw new ExpedienteNoEncontradoError(id);
      escribirCrudo(restantes);
    },

    async exportar(id) {
      const registro = await repo.obtener(id);
      if (!registro) throw new ExpedienteNoEncontradoError(id);
      return serializarRespaldo(registro, op.ahora());
    },

    async importar(json, modo): Promise<ResultadoImportacion> {
      return importarRespaldo(repo, json, modo, op.generarId, op.ahora());
    },
  };
  return repo;
}

/** Repositorio del navegador. Solo se llama en el cliente. */
export function crearRepositorioNavegador(): ExpedienteRepository {
  return crearRepositorioLocal({
    almacenamiento: () => window.localStorage,
    generarId: () => crypto.randomUUID(),
    ahora: () => new Date().toISOString(),
  });
}
