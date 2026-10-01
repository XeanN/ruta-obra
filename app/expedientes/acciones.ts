"use server";

// Server Actions de expedientes. Cada una: (1) exige sesión con estudio activo, (2) valida la
// entrada con Zod, (3) usa el repositorio de base de datos filtrado por ese estudio (regla 8).
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { eliminarObjetos } from "@/data/archivos";
import { db } from "@/data/db/client";
import * as schema from "@/data/db/schema";
import {
  ConflictoVersionError,
  ExpedienteNoEncontradoError,
  ExpedienteYaExisteError,
  ImportacionInvalidaError,
  type ListaExpedientes,
  type ResultadoImportacion,
} from "@/data/expediente-repo";
import { crearRepositorioDb, type BaseDb } from "@/data/expediente-repo.db";
import type { Resultado } from "@/data/resultado-accion";
import { ExpedienteRegistroSchema } from "@/domain/schemas";
import type { ExpedienteRegistro } from "@/domain/types";
import { obtenerSesion } from "@/lib/sesion";

class SinSesion extends Error {}

const IdSchema = z.string().min(1).max(100);
const JsonSchema = z.string().max(2_000_000, "El respaldo es demasiado grande.");

async function contexto() {
  const sesion = await obtenerSesion();
  const estudioId = sesion?.session.activeOrganizationId;
  if (!sesion || !estudioId) throw new SinSesion();
  return {
    estudioId,
    usuarioId: sesion.user.id,
    repo: crearRepositorioDb(db as unknown as BaseDb, {
      estudioId,
      usuarioId: sesion.user.id,
      generarId: () => crypto.randomUUID(),
      ahora: () => new Date().toISOString(),
    }),
  };
}

async function ejecutar<T>(fn: (c: Awaited<ReturnType<typeof contexto>>) => Promise<T>): Promise<Resultado<T>> {
  try {
    return { ok: true, datos: await fn(await contexto()) };
  } catch (e) {
    if (e instanceof SinSesion) return { ok: false, error: "sesion", mensaje: "Tu sesión venció. Vuelve a ingresar." };
    if (e instanceof ExpedienteNoEncontradoError) return { ok: false, error: "no_encontrado", mensaje: e.message };
    if (e instanceof ExpedienteYaExisteError) return { ok: false, error: "ya_existe", mensaje: e.message };
    if (e instanceof ConflictoVersionError) return { ok: false, error: "conflicto", mensaje: e.message };
    if (e instanceof ImportacionInvalidaError || e instanceof z.ZodError) {
      return { ok: false, error: "invalido", mensaje: e instanceof z.ZodError ? z.prettifyError(e) : e.message };
    }
    console.error("[expedientes]", e);
    return { ok: false, error: "interno", mensaje: "No se pudo completar la operación." };
  }
}

export async function listarExpedientes(): Promise<Resultado<ListaExpedientes>> {
  return ejecutar(({ repo }) => repo.listar());
}

export async function obtenerExpediente(id: string): Promise<Resultado<ExpedienteRegistro | null>> {
  return ejecutar(({ repo }) => repo.obtener(IdSchema.parse(id)));
}

export async function crearExpediente(registro: ExpedienteRegistro): Promise<Resultado<null>> {
  return ejecutar(async ({ repo }) => {
    await repo.crear(ExpedienteRegistroSchema.parse(registro));
    return null;
  });
}

export async function actualizarExpediente(
  registro: ExpedienteRegistro,
  versionBase?: string,
): Promise<Resultado<null>> {
  return ejecutar(async ({ repo }) => {
    await repo.actualizar(ExpedienteRegistroSchema.parse(registro), {
      versionBase: versionBase === undefined ? undefined : z.string().parse(versionBase),
    });
    return null;
  });
}

export async function eliminarExpediente(id: string): Promise<Resultado<null>> {
  return ejecutar(async ({ repo, estudioId }) => {
    const expedienteId = IdSchema.parse(id);
    // Los archivos de R2 se borran después de borrar el expediente (sus filas caen en cascada).
    const claves = (
      await db
        .select({ clave: schema.archivos.clave })
        .from(schema.archivos)
        .where(and(eq(schema.archivos.expedienteId, expedienteId), eq(schema.archivos.estudioId, estudioId)))
    ).map((f) => f.clave);
    await repo.eliminar(expedienteId);
    await eliminarObjetos(claves).catch((e: unknown) => console.error("[archivos] no se pudieron borrar", e));
    return null;
  });
}

export async function exportarExpediente(id: string): Promise<Resultado<string>> {
  return ejecutar(({ repo }) => repo.exportar(IdSchema.parse(id)));
}

export async function importarExpediente(
  json: string,
  modo?: "reemplazar" | "duplicar",
): Promise<Resultado<ResultadoImportacion>> {
  return ejecutar(({ repo }) =>
    repo.importar(JsonSchema.parse(json), z.enum(["reemplazar", "duplicar"]).optional().parse(modo)),
  );
}
