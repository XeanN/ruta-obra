import { describe, expect, it } from "vitest";
import { armarExpedientesDemo } from "@/domain/demo";
import { definicionesDemo } from "./demo-definiciones";
import { borrarDemo, cargarDemo } from "./demo-repo";
import { registroDePrueba } from "./expediente-repo.contrato";
import { crearRepositorioLocal, type AlmacenamientoSimple } from "./expediente-repo.local";
import { knowledgeRepo } from "./knowledge-repo";

function repoEnMemoria() {
  const datos = new Map<string, string>();
  const almacen: AlmacenamientoSimple = { getItem: (k) => datos.get(k) ?? null, setItem: (k, v) => void datos.set(k, v) };
  return crearRepositorioLocal({ almacenamiento: () => almacen, generarId: () => "x", ahora: () => "2026-10-01T10:00:00Z" });
}

const demo = () => armarExpedientesDemo(definicionesDemo, knowledgeRepo.baseExpedientes, "2026-10-01");

describe("carga de la demo", () => {
  it("carga los 3 expedientes, se puede recargar y borrar sin tocar los propios", async () => {
    const repo = repoEnMemoria();
    const propio = registroDePrueba("propio");
    await repo.crear(propio);

    await cargarDemo(repo, demo());
    await cargarDemo(repo, demo()); // volver a cargar no duplica ni falla
    const ids = (await repo.listar()).registros.map((r) => r.expediente.id).sort();
    expect(ids).toEqual(["demo-casi-terminado", "demo-con-observacion", "demo-recien-creado", "propio"]);

    expect(await borrarDemo(repo)).toBe(3);
    expect((await repo.listar()).registros.map((r) => r.expediente.id)).toEqual(["propio"]);
    expect(await borrarDemo(repo)).toBe(0);
  });
});
