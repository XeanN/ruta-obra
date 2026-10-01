// Modo demo: carga y borrado de los expedientes de ejemplo en un repositorio. Se usa solo con el
// repositorio del navegador: la demo nunca toca la base de datos.
import { esDemo } from "@/domain/demo";
import type { ExpedienteRegistro } from "@/domain/types";
import type { ExpedienteRepository } from "./expediente-repo";

/** Reemplaza la demo anterior (si la hay) por los registros nuevos. No toca lo que no es demo. */
export async function cargarDemo(repo: ExpedienteRepository, registros: readonly ExpedienteRegistro[]): Promise<void> {
  await borrarDemo(repo);
  for (const r of registros) await repo.crear(r);
}

/** Borra solo los expedientes de la demo. Devuelve cuántos borró. */
export async function borrarDemo(repo: ExpedienteRepository): Promise<number> {
  const { registros } = await repo.listar();
  const demo = registros.filter((r) => esDemo(r.expediente.id));
  for (const r of demo) await repo.eliminar(r.expediente.id);
  return demo.length;
}

/** Cookie que hace que /expedientes use el navegador aunque haya sesión (la demo no va a la cuenta). */
export const COOKIE_DEMO = "rutaobra_demo";
