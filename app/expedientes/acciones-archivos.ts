"use server";

// Server Actions de archivos (fotos de la bitácora). El navegador sube directo a R2 con una URL
// firmada; antes, el servidor comprueba que el expediente sea del estudio de la sesión.
import { z } from "zod";
import { eliminarObjetos, urlDeDescarga, urlDeSubida } from "@/data/archivos";
import { clavesDeArchivos, eliminarRegistrosArchivos, registrarArchivo } from "@/data/archivos-servicio";
import type { Resultado } from "@/data/resultado-accion";
import { ejecutar } from "@/lib/acciones-base";

const Id = z.string().min(1).max(100);
const Ids = z.array(Id).max(200);

const SolicitudSchema = z.object({
  expedienteId: Id,
  nombre: z.string().min(1).max(200),
  tipo: z.string().min(1).max(100),
  tamano: z.number().int().positive(),
});

export async function solicitarSubida(
  solicitud: z.input<typeof SolicitudSchema>,
): Promise<Resultado<{ archivoId: string; url: string }>> {
  return ejecutar(async ({ db, estudioId, usuarioId }) => {
    const s = SolicitudSchema.parse(solicitud);
    const archivoId = crypto.randomUUID();
    const clave = await registrarArchivo(db, { estudioId, usuarioId }, { archivoId, ...s });
    return { archivoId, url: await urlDeSubida(clave, s) };
  });
}

/** URLs temporales (10 min) de los archivos pedidos que sean del estudio; los demás no aparecen. */
export async function urlsDeArchivos(expedienteId: string, ids: string[]): Promise<Resultado<Record<string, string>>> {
  return ejecutar(async ({ db, estudioId }) => {
    const propios = await clavesDeArchivos(db, { estudioId }, Id.parse(expedienteId), Ids.parse(ids));
    const urls = await Promise.all(propios.map(async (p) => [p.id, await urlDeDescarga(p.clave)] as const));
    return Object.fromEntries(urls);
  });
}

export async function eliminarArchivos(expedienteId: string, ids: string[]): Promise<Resultado<null>> {
  return ejecutar(async ({ db, estudioId }) => {
    const claves = await eliminarRegistrosArchivos(db, { estudioId }, Id.parse(expedienteId), Ids.parse(ids));
    await eliminarObjetos(claves).catch((e: unknown) => console.error("[archivos] no se pudieron borrar de R2", e));
    return null;
  });
}
