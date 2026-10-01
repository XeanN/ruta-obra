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

export interface ExpedienteRepository {
  listar(): Promise<ListaExpedientes>;
  obtener(id: string): Promise<ExpedienteRegistro | null>;
  crear(registro: ExpedienteRegistro): Promise<void>;
  actualizar(registro: ExpedienteRegistro): Promise<void>;
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
