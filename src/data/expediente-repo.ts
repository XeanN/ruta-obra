// Interfaz del repositorio de expedientes. La UI solo conoce esto: pasar a Supabase u otro
// backend es escribir otra implementación (ver expediente-repo.local.ts).
import { z } from "zod";
import { ExpedienteRegistroSchema } from "@/domain/schemas";
import type { ExpedienteRegistro } from "@/domain/types";

export interface ListaExpedientes {
  registros: ExpedienteRegistro[];
  /** Registros guardados que no cumplen el esquema: se conservan sin tocar, pero no se muestran. */
  corruptos: number;
}

export type ResultadoImportacion =
  | { estado: "importado"; id: string }
  | { estado: "conflicto"; id: string; nombreExistente: string };

export interface OpcionesActualizar {
  /**
   * actualizado_en del expediente tal como se cargó antes de editarlo. Si lo guardado ya no
   * coincide (otro miembro guardó antes), se lanza ConflictoVersionError en vez de pisarlo.
   */
  versionBase?: string;
}

export interface ExpedienteRepository {
  listar(): Promise<ListaExpedientes>;
  obtener(id: string): Promise<ExpedienteRegistro | null>;
  /** Lanza ExpedienteYaExisteError si el id ya está en uso. */
  crear(registro: ExpedienteRegistro): Promise<void>;
  actualizar(registro: ExpedienteRegistro, opciones?: OpcionesActualizar): Promise<void>;
  eliminar(id: string): Promise<void>;
  /** Respaldo en JSON (formato de archivo, ver ArchivoRespaldoSchema). */
  exportar(id: string): Promise<string>;
  /**
   * Importa un respaldo. Si el id ya existe y no se indica modo, devuelve "conflicto" sin
   * guardar; con "reemplazar" lo sobrescribe y con "duplicar" lo guarda con ids nuevos.
   */
  importar(json: string, modo?: "reemplazar" | "duplicar"): Promise<ResultadoImportacion>;
}

/** El navegador no permite guardar (modo privado, almacenamiento lleno o bloqueado). */
export class RepositorioNoDisponibleError extends Error {
  constructor(causa?: unknown) {
    super("No se pudo acceder al almacenamiento del navegador.", { cause: causa });
    this.name = "RepositorioNoDisponibleError";
  }
}

export class ExpedienteNoEncontradoError extends Error {
  constructor(id: string) {
    super(`No existe el expediente ${id}.`);
    this.name = "ExpedienteNoEncontradoError";
  }
}

export class ExpedienteYaExisteError extends Error {
  constructor(id: string) {
    super(`Ya existe un expediente con id ${id}.`);
    this.name = "ExpedienteYaExisteError";
  }
}

/** Otro miembro guardó el expediente después de que lo cargaste. */
export class ConflictoVersionError extends Error {
  constructor(id: string) {
    super(`El expediente ${id} cambió desde que lo abriste. Recarga para ver la última versión.`);
    this.name = "ConflictoVersionError";
  }
}

/** La sesión venció o no hay estudio activo. */
export class SesionRequeridaError extends Error {
  constructor() {
    super("Tu sesión venció. Vuelve a ingresar.");
    this.name = "SesionRequeridaError";
  }
}

export class ImportacionInvalidaError extends Error {
  constructor(detalle: string) {
    super(`El archivo no es un respaldo válido de RutaObra: ${detalle}`);
    this.name = "ImportacionInvalidaError";
  }
}

export const FORMATO_RESPALDO = "rutaobra-expediente";

export const ArchivoRespaldoSchema = z.object({
  formato: z.literal(FORMATO_RESPALDO),
  version: z.literal(1),
  exportado_en: z.string(),
  registro: ExpedienteRegistroSchema,
});

export function serializarRespaldo(registro: ExpedienteRegistro, ahora: string): string {
  const archivo: z.infer<typeof ArchivoRespaldoSchema> = {
    formato: FORMATO_RESPALDO,
    version: 1,
    exportado_en: ahora,
    registro,
  };
  return JSON.stringify(archivo, null, 2);
}

/** Copia de un registro con ids nuevos (expediente y predio) y "(copia)" en el nombre. */
export function duplicarRegistro(
  registro: ExpedienteRegistro,
  generarId: () => string,
  ahora: string,
): ExpedienteRegistro {
  const id = generarId();
  const predioId = generarId();
  return {
    predio: { ...registro.predio, id: predioId },
    expediente: {
      ...registro.expediente,
      id,
      predio_id: predioId,
      nombre: `${registro.expediente.nombre} (copia)`,
      actualizado_en: ahora,
    },
  };
}

/**
 * Importación común a todas las implementaciones: conflicto si el id ya está en el estudio;
 * "reemplazar" lo sobrescribe; "duplicar" (o un id ocupado fuera del estudio) guarda una copia.
 */
export async function importarRespaldo(
  repo: Pick<ExpedienteRepository, "obtener" | "crear" | "actualizar">,
  json: string,
  modo: "reemplazar" | "duplicar" | undefined,
  generarId: () => string,
  ahora: string,
): Promise<ResultadoImportacion> {
  const registro = leerRespaldo(json);
  const existente = await repo.obtener(registro.expediente.id);
  if (existente && !modo) {
    return { estado: "conflicto", id: registro.expediente.id, nombreExistente: existente.expediente.nombre };
  }
  if (existente && modo === "reemplazar") {
    await repo.actualizar(registro);
    return { estado: "importado", id: registro.expediente.id };
  }
  if (existente && modo === "duplicar") {
    const copia = duplicarRegistro(registro, generarId, ahora);
    await repo.crear(copia);
    return { estado: "importado", id: copia.expediente.id };
  }
  try {
    await repo.crear(registro);
    return { estado: "importado", id: registro.expediente.id };
  } catch (e) {
    // El id está ocupado por un expediente que este estudio no ve: se guarda como copia.
    if (!(e instanceof ExpedienteYaExisteError)) throw e;
    const copia = duplicarRegistro(registro, generarId, ahora);
    await repo.crear(copia);
    return { estado: "importado", id: copia.expediente.id };
  }
}

/** Acepta el archivo de respaldo o un registro suelto. */
export function leerRespaldo(json: string): ExpedienteRegistro {
  let crudo: unknown;
  try {
    crudo = JSON.parse(json);
  } catch {
    throw new ImportacionInvalidaError("no es JSON.");
  }
  const archivo = ArchivoRespaldoSchema.safeParse(crudo);
  if (archivo.success) return archivo.data.registro;
  const registro = ExpedienteRegistroSchema.safeParse(crudo);
  if (registro.success) return registro.data;
  throw new ImportacionInvalidaError(z.prettifyError(archivo.error));
}
