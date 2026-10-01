import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { beforeAll, describe, expect, it } from "vitest";
import { ArchivoNoPermitidoError } from "./archivos-reglas";
import { clavesDeArchivos, eliminarRegistrosArchivos, registrarArchivo } from "./archivos-servicio";
import * as schema from "./db/schema";
import { registroDePrueba } from "./expediente-repo.contrato";
import { ExpedienteNoEncontradoError } from "./expediente-repo";
import { crearRepositorioDb, type BaseDb } from "./expediente-repo.db";

let db: BaseDb;
const A = { estudioId: "estudio-a" };
const B = { estudioId: "estudio-b" };
const foto = (archivoId: string, expedienteId = "exp-a") => ({
  archivoId,
  expedienteId,
  nombre: "obra.jpg",
  tipo: "image/jpeg",
  tamano: 250_000,
});

beforeAll(async () => {
  const pg = drizzle({ client: new PGlite(), schema });
  await migrate(pg, { migrationsFolder: "drizzle" });
  db = pg as unknown as BaseDb;
  for (const id of [A.estudioId, B.estudioId]) {
    await db.insert(schema.organization).values({ id, name: id, slug: id, createdAt: new Date() });
  }
  const repoA = crearRepositorioDb(db, { ...A, generarId: () => "x", ahora: () => "" });
  await repoA.crear(registroDePrueba("exp-a"));
}, 60_000);

describe("archivos por estudio (regla 8)", () => {
  it("registra la foto de un expediente propio y arma la clave privada", async () => {
    expect(await registrarArchivo(db, A, foto("f1"))).toBe("estudio-a/exp-a/f1.jpg");
    expect(await clavesDeArchivos(db, A, "exp-a", ["f1"])).toEqual([{ id: "f1", clave: "estudio-a/exp-a/f1.jpg" }]);
  });

  it("otro estudio no puede subir a ese expediente ni obtener sus archivos", async () => {
    await registrarArchivo(db, A, foto("f2"));
    await expect(registrarArchivo(db, B, foto("f3"))).rejects.toBeInstanceOf(ExpedienteNoEncontradoError);
    expect(await clavesDeArchivos(db, B, "exp-a", ["f2"])).toEqual([]);
    expect(await eliminarRegistrosArchivos(db, B, "exp-a", ["f2"])).toEqual([]);
    expect(await clavesDeArchivos(db, A, "exp-a", ["f2"])).toHaveLength(1);
  });

  it("rechaza tipos y tamaños no permitidos", async () => {
    await expect(registrarArchivo(db, A, { ...foto("f4"), tipo: "text/html" })).rejects.toBeInstanceOf(
      ArchivoNoPermitidoError,
    );
    await expect(registrarArchivo(db, A, { ...foto("f5"), tamano: 11 * 1024 * 1024 })).rejects.toBeInstanceOf(
      ArchivoNoPermitidoError,
    );
  });

  it("elimina solo lo pedido y devuelve las claves para borrarlas de R2", async () => {
    await registrarArchivo(db, A, foto("f6"));
    await registrarArchivo(db, A, foto("f7"));
    expect(await eliminarRegistrosArchivos(db, A, "exp-a", ["f6", "no-existe"])).toEqual(["estudio-a/exp-a/f6.jpg"]);
    expect(await clavesDeArchivos(db, A, "exp-a", ["f6", "f7"])).toEqual([{ id: "f7", clave: "estudio-a/exp-a/f7.jpg" }]);
    expect(await clavesDeArchivos(db, A, "exp-a", [])).toEqual([]);
  });

  it("los archivos se borran en cascada con el expediente", async () => {
    const repoA = crearRepositorioDb(db, { ...A, generarId: () => "y", ahora: () => "" });
    await repoA.crear(registroDePrueba("exp-borrar"));
    await registrarArchivo(db, A, foto("f8", "exp-borrar"));
    await repoA.eliminar("exp-borrar");
    expect(await clavesDeArchivos(db, A, "exp-borrar", ["f8"])).toEqual([]);
  });
});
