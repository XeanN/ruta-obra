// Implementación del repositorio en el cliente para usuarios con cuenta: llama a las Server
// Actions (app/expedientes/acciones.ts). Las pantallas no cambian: usan la misma interfaz.
import type { ExpedienteRegistro } from "@/domain/types";
import {
  ConflictoVersionError,
  ExpedienteNoEncontradoError,
  ExpedienteYaExisteError,
  ImportacionInvalidaError,
  RepositorioNoDisponibleError,
  SesionRequeridaError,
  type ExpedienteRepository,
  type ListaExpedientes,
  type ResultadoImportacion,
} from "./expediente-repo";
import type { Resultado } from "./resultado-accion";

export interface AccionesExpedientes {
  listarExpedientes(): Promise<Resultado<ListaExpedientes>>;
  obtenerExpediente(id: string): Promise<Resultado<ExpedienteRegistro | null>>;
  crearExpediente(r: ExpedienteRegistro): Promise<Resultado<null>>;
  actualizarExpediente(r: ExpedienteRegistro, versionBase?: string): Promise<Resultado<null>>;
  eliminarExpediente(id: string): Promise<Resultado<null>>;
  exportarExpediente(id: string): Promise<Resultado<string>>;
  importarExpediente(json: string, modo?: "reemplazar" | "duplicar"): Promise<Resultado<ResultadoImportacion>>;
}

async function llamar<T>(fn: () => Promise<Resultado<T>>, id = ""): Promise<T> {
  let r: Resultado<T>;
  try {
    r = await fn();
  } catch (e) {
    // Sin conexión o el servidor no respondió.
    throw new RepositorioNoDisponibleError(e);
  }
  if (r.ok) return r.datos;
  switch (r.error) {
    case "sesion":
      throw new SesionRequeridaError();
    case "no_encontrado":
      throw new ExpedienteNoEncontradoError(id);
    case "ya_existe":
      throw new ExpedienteYaExisteError(id);
    case "conflicto":
      throw new ConflictoVersionError(id);
    case "invalido":
      throw new ImportacionInvalidaError(r.mensaje);
    case "interno":
      throw new Error(r.mensaje);
  }
}

export function crearRepositorioRemoto(a: AccionesExpedientes): ExpedienteRepository {
  return {
    listar: () => llamar(() => a.listarExpedientes()),
    obtener: (id) => llamar(() => a.obtenerExpediente(id), id),
    crear: (r) => llamar(() => a.crearExpediente(r), r.expediente.id).then(() => undefined),
    actualizar: (r, op) =>
      llamar(() => a.actualizarExpediente(r, op?.versionBase), r.expediente.id).then(() => undefined),
    eliminar: (id) => llamar(() => a.eliminarExpediente(id), id).then(() => undefined),
    exportar: (id) => llamar(() => a.exportarExpediente(id), id),
    importar: (json, modo) => llamar(() => a.importarExpediente(json, modo)),
  };
}
