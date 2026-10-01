import "server-only";
import { headers } from "next/headers";
import { auth, type Sesion } from "./auth";

/** Sesión actual o null (sin cookie, vencida o base de datos no disponible). */
export async function obtenerSesion(): Promise<Sesion | null> {
  try {
    return await auth.api.getSession({ headers: await headers() });
  } catch {
    return null;
  }
}
