import "server-only";
// Base común de las Server Actions: sesión con estudio activo y mapeo de errores a Resultado.
import { z } from "zod";
import { ArchivoNoPermitidoError } from "@/data/archivos-reglas";
import { db } from "@/data/db/client";
import {
  ConflictoVersionError,
  ExpedienteNoEncontradoError,
  ExpedienteYaExisteError,
  ImportacionInvalidaError,
} from "@/data/expediente-repo";
import { crearRepositorioDb, type BaseDb } from "@/data/expediente-repo.db";
import type { Resultado } from "@/data/resultado-accion";
import { obtenerSesion } from "./sesion";

class SinSesion extends Error {}

export async function contextoAccion() {
  const sesion = await obtenerSesion();
  const estudioId = sesion?.session.activeOrganizationId;
  if (!sesion || !estudioId) throw new SinSesion();
  const base = db as unknown as BaseDb;
  return {
    db: base,
    estudioId,
    usuarioId: sesion.user.id,
    repo: crearRepositorioDb(base, {
      estudioId,
      usuarioId: sesion.user.id,
      generarId: () => crypto.randomUUID(),
      ahora: () => new Date().toISOString(),
    }),
  };
}

export type ContextoAccion = Awaited<ReturnType<typeof contextoAccion>>;

export async function ejecutar<T>(fn: (c: ContextoAccion) => Promise<T>): Promise<Resultado<T>> {
  try {
    return { ok: true, datos: await fn(await contextoAccion()) };
  } catch (e) {
    if (e instanceof SinSesion) return { ok: false, error: "sesion", mensaje: "Tu sesión venció. Vuelve a ingresar." };
    if (e instanceof ExpedienteNoEncontradoError) return { ok: false, error: "no_encontrado", mensaje: e.message };
    if (e instanceof ExpedienteYaExisteError) return { ok: false, error: "ya_existe", mensaje: e.message };
    if (e instanceof ConflictoVersionError) return { ok: false, error: "conflicto", mensaje: e.message };
    if (e instanceof ImportacionInvalidaError || e instanceof ArchivoNoPermitidoError) {
      return { ok: false, error: "invalido", mensaje: e.message };
    }
    if (e instanceof z.ZodError) return { ok: false, error: "invalido", mensaje: z.prettifyError(e) };
    console.error("[acciones]", e);
    return { ok: false, error: "interno", mensaje: "No se pudo completar la operación." };
  }
}
