// Contrato + aislamiento entre estudios contra Postgres real (PGlite, en memoria) con las
// migraciones de drizzle/. No necesita red ni claves: corre igual en local y en CI.
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { beforeAll, describe, expect, it } from "vitest";
import * as schema from "./db/schema";
import { contratoRepositorio, registroDePrueba } from "./expediente-repo.contrato";
import { ExpedienteNoEncontradoError } from "./expediente-repo";
import { crearRepositorioDb, type BaseDb } from "./expediente-repo.db";

let contador = 0;

async function baseNueva(): Promise<BaseDb> {
  const pg = drizzle({ client: new PGlite(), schema });
  await migrate(pg, { migrationsFolder: "drizzle" });
  return pg as unknown as BaseDb;
}

async function nuevoEstudio(base: BaseDb): Promise<string> {
  const id = `estudio-${++contador}`;
  await base.insert(schema.organization).values({ id, name: id, slug: id, createdAt: new Date() });
  return id;
}

function repoDe(base: BaseDb, estudioId: string) {
  let n = 0;
  return crearRepositorioDb(base, {
    estudioId,
    generarId: () => `${estudioId}-nuevo-${++n}`,
    ahora: () => "2026-10-02T09:00:00Z",
  });
}

// Contrato: cada test con una base nueva (los ids son globales, como en producción).
contratoRepositorio("Postgres (PGlite)", {
  crear: async () => {
    const base = await baseNueva();
    return repoDe(base, await nuevoEstudio(base));
  },
});

// Aislamiento: una sola base compartida por varios estudios.
let db: BaseDb;
beforeAll(async () => {
  db = await baseNueva();
}, 60_000);

describe("aislamiento entre estudios (regla 8)", () => {
  it("un estudio no ve, ni modifica, ni elimina expedientes de otro", async () => {
    const a = repoDe(db, await nuevoEstudio(db));
    const b = repoDe(db, await nuevoEstudio(db));
    await a.crear(registroDePrueba("compartido-no"));

    expect((await b.listar()).registros).toEqual([]);
    expect(await b.obtener("compartido-no")).toBeNull();
    await expect(b.actualizar(registroDePrueba("compartido-no", "Hackeado"))).rejects.toBeInstanceOf(
      ExpedienteNoEncontradoError,
    );
    await expect(b.eliminar("compartido-no")).rejects.toBeInstanceOf(ExpedienteNoEncontradoError);
    await expect(b.exportar("compartido-no")).rejects.toBeInstanceOf(ExpedienteNoEncontradoError);
    expect((await a.obtener("compartido-no"))?.expediente.nombre).toBe("Casa");
  });

  it("importar un respaldo cuyo id existe en otro estudio guarda una copia, sin tocar el original", async () => {
    const a = repoDe(db, await nuevoEstudio(db));
    const b = repoDe(db, await nuevoEstudio(db));
    await a.crear(registroDePrueba("ajeno", "De A"));
    const json = await a.exportar("ajeno");

    const r = await b.importar(json);
    expect(r.estado).toBe("importado");
    expect(r.id).not.toBe("ajeno");
    expect((await b.obtener(r.id))?.expediente.nombre).toBe("De A (copia)");
    expect((await a.obtener("ajeno"))?.expediente.nombre).toBe("De A");
  });

  it("guarda quién creó el expediente", async () => {
    const estudio = await nuevoEstudio(db);
    await db.insert(schema.user).values({ id: "u1", name: "Uno", email: "u1@ejemplo.pe" });
    const repo = crearRepositorioDb(db, { estudioId: estudio, usuarioId: "u1", generarId: () => "x", ahora: () => "" });
    await repo.crear(registroDePrueba("con-autor"));
    const fila = await db.query.expedientes.findFirst({
      where: (e, { eq }) => eq(e.id, "con-autor"),
      columns: { creadoPor: true },
    });
    expect(fila?.creadoPor).toBe("u1");
  });
});
