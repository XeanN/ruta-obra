// Registro de archivos en la base, siempre filtrado por estudio (regla 8). No toca R2: las
// Server Actions combinan esto con las URLs firmadas de archivos.ts. Testeable con PGlite.
import { and, eq, inArray } from "drizzle-orm";
import * as schema from "./db/schema";
import { claveDeArchivo, validarArchivo } from "./archivos-reglas";
import { ExpedienteNoEncontradoError } from "./expediente-repo";
import type { BaseDb } from "./expediente-repo.db";

export interface ContextoArchivos {
  estudioId: string;
  usuarioId?: string;
}

export interface NuevoArchivo {
  archivoId: string;
  expedienteId: string;
  nombre: string;
  tipo: string;
  tamano: number;
}

/** Valida tipo/tamaño y que el expediente sea del estudio; guarda el archivo y devuelve su clave en R2. */
export async function registrarArchivo(db: BaseDb, ctx: ContextoArchivos, a: NuevoArchivo): Promise<string> {
  validarArchivo(a);
  const [exp] = await db
    .select({ id: schema.expedientes.id })
    .from(schema.expedientes)
    .where(and(eq(schema.expedientes.id, a.expedienteId), eq(schema.expedientes.estudioId, ctx.estudioId)));
  if (!exp) throw new ExpedienteNoEncontradoError(a.expedienteId);
  const clave = claveDeArchivo(ctx.estudioId, a.expedienteId, a.archivoId, a.tipo);
  await db.insert(schema.archivos).values({
    id: a.archivoId,
    estudioId: ctx.estudioId,
    expedienteId: a.expedienteId,
    clave,
    nombre: a.nombre.slice(0, 200),
    tipo: a.tipo,
    tamano: a.tamano,
    creadoPor: ctx.usuarioId ?? null,
  });
  return clave;
}

/** Claves de los archivos pedidos que SÍ son del estudio y del expediente; los ajenos se ignoran. */
export async function clavesDeArchivos(
  db: BaseDb,
  ctx: ContextoArchivos,
  expedienteId: string,
  ids: readonly string[],
): Promise<{ id: string; clave: string }[]> {
  if (ids.length === 0) return [];
  return db
    .select({ id: schema.archivos.id, clave: schema.archivos.clave })
    .from(schema.archivos)
    .where(
      and(
        eq(schema.archivos.estudioId, ctx.estudioId),
        eq(schema.archivos.expedienteId, expedienteId),
        inArray(schema.archivos.id, [...ids]),
      ),
    );
}

/** Borra los registros (solo del estudio) y devuelve sus claves para borrarlas de R2. */
export async function eliminarRegistrosArchivos(
  db: BaseDb,
  ctx: ContextoArchivos,
  expedienteId: string,
  ids: readonly string[],
): Promise<string[]> {
  const propios = await clavesDeArchivos(db, ctx, expedienteId, ids);
  if (propios.length === 0) return [];
  await db.delete(schema.archivos).where(
    and(
      eq(schema.archivos.estudioId, ctx.estudioId),
      inArray(
        schema.archivos.id,
        propios.map((p) => p.id),
      ),
    ),
  );
  return propios.map((p) => p.clave);
}
