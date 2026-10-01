import { describe, expect, it } from "vitest";
import type { ExpedienteRegistro } from "@/domain/types";
import {
  ExpedienteNoEncontradoError,
  ImportacionInvalidaError,
  RepositorioNoDisponibleError,
} from "./expediente-repo";
import { CLAVE_ALMACENAMIENTO, crearRepositorioLocal, type AlmacenamientoSimple } from "./expediente-repo.local";

function memoria(): AlmacenamientoSimple & { datos: Map<string, string> } {
  const datos = new Map<string, string>();
  return {
    datos,
    getItem: (k) => datos.get(k) ?? null,
    setItem: (k, v) => void datos.set(k, v),
  };
}

const registro = (id: string, nombre = "Casa"): ExpedienteRegistro => ({
  predio: { id: `pre-${id}`, ubigeo: "150108", direccion: "Av. 1" },
  expediente: {
    id,
    predio_id: `pre-${id}`,
    nombre,
    respuestas_diagnostico: { titulo: "inscrito" },
    modalidad: "A",
    version_datos: "0.1.0",
    pasos: [{ procedimiento_id: "P-MUN-PARAM", etapa_id: "E2", estado: "pendiente" }],
    creado_en: "2026-10-01T10:00:00-05:00",
  },
});

function repo(almacen = memoria()) {
  let n = 0;
  return {
    almacen,
    repo: crearRepositorioLocal({
      almacenamiento: () => almacen,
      generarId: () => `nuevo-${++n}`,
      ahora: () => "2026-10-02T09:00:00Z",
    }),
  };
}

describe("repositorio local", () => {
  it("crea, lista, obtiene, actualiza y elimina; persiste entre instancias", async () => {
    const { repo: r, almacen } = repo();
    await r.crear(registro("a"));
    await r.crear(registro("b"));
    await expect(r.crear(registro("a"))).rejects.toThrow(/Ya existe/);
    await r.actualizar(registro("a", "Casa editada"));
    expect((await r.obtener("a"))?.expediente.nombre).toBe("Casa editada");

    const otra = repo(almacen).repo; // "recargar la página"
    expect((await otra.listar()).registros.map((x) => x.expediente.id)).toEqual(["a", "b"]);

    await r.eliminar("b");
    expect(await r.obtener("b")).toBeNull();
    await expect(r.eliminar("b")).rejects.toBeInstanceOf(ExpedienteNoEncontradoError);
    await expect(r.actualizar(registro("zz"))).rejects.toBeInstanceOf(ExpedienteNoEncontradoError);
  });

  it("no guarda registros inválidos", async () => {
    const { repo: r } = repo();
    const malo = { ...registro("a"), expediente: { ...registro("a").expediente, modalidad: "Z" } };
    await expect(r.crear(malo as unknown as ExpedienteRegistro)).rejects.toThrow();
    expect((await r.listar()).registros).toEqual([]);
  });

  it("conserva sin tocar los registros corruptos y los cuenta", async () => {
    const { repo: r, almacen } = repo();
    almacen.setItem(CLAVE_ALMACENAMIENTO, JSON.stringify([{ expediente: { id: "roto" } }, "basura", registro("ok")]));
    const lista = await r.listar();
    expect(lista).toMatchObject({ corruptos: 2 });
    expect(lista.registros.map((x) => x.expediente.id)).toEqual(["ok"]);
    await r.crear(registro("nuevo"));
    expect(JSON.parse(almacen.getItem(CLAVE_ALMACENAMIENTO) ?? "[]")).toHaveLength(4);
  });

  it("tolera JSON inválido o un valor que no es lista", async () => {
    const { repo: r, almacen } = repo();
    almacen.setItem(CLAVE_ALMACENAMIENTO, "{no es json");
    expect((await r.listar()).registros).toEqual([]);
    almacen.setItem(CLAVE_ALMACENAMIENTO, JSON.stringify({ a: 1 }));
    expect((await r.listar()).registros).toEqual([]);
  });

  it("almacenamiento bloqueado o lleno → RepositorioNoDisponibleError", async () => {
    const bloqueado = crearRepositorioLocal({
      almacenamiento: () => {
        throw new DOMException("bloqueado", "SecurityError");
      },
      generarId: () => "x",
      ahora: () => "",
    });
    await expect(bloqueado.listar()).rejects.toBeInstanceOf(RepositorioNoDisponibleError);

    const lleno = memoria();
    lleno.setItem = () => {
      throw new DOMException("lleno", "QuotaExceededError");
    };
    await expect(repo(lleno).repo.crear(registro("a"))).rejects.toBeInstanceOf(RepositorioNoDisponibleError);

    const sinLectura = memoria();
    sinLectura.getItem = () => {
      throw new Error("sin acceso");
    };
    await expect(repo(sinLectura).repo.listar()).rejects.toBeInstanceOf(RepositorioNoDisponibleError);
  });

  it("exporta e importa un respaldo; detecta conflicto, reemplaza o duplica", async () => {
    const { repo: r } = repo();
    await r.crear(registro("a", "Original"));
    const json = await r.exportar("a");
    expect(JSON.parse(json)).toMatchObject({ formato: "rutaobra-expediente", version: 1, exportado_en: "2026-10-02T09:00:00Z" });

    expect(await r.importar(json)).toEqual({ estado: "conflicto", id: "a", nombreExistente: "Original" });

    const dup = await r.importar(json, "duplicar");
    expect(dup).toEqual({ estado: "importado", id: "nuevo-1" });
    const copia = await r.obtener("nuevo-1");
    expect(copia?.expediente).toMatchObject({ nombre: "Original (copia)", predio_id: "nuevo-2" });
    expect(copia?.predio.id).toBe("nuevo-2");

    const editado = JSON.stringify({ ...JSON.parse(json), registro: registro("a", "Del respaldo") });
    expect(await r.importar(editado, "reemplazar")).toEqual({ estado: "importado", id: "a" });
    expect((await r.obtener("a"))?.expediente.nombre).toBe("Del respaldo");

    const { repo: vacio } = repo();
    expect(await vacio.importar(JSON.stringify(registro("suelto")))).toEqual({ estado: "importado", id: "suelto" });
    await expect(vacio.exportar("no")).rejects.toBeInstanceOf(ExpedienteNoEncontradoError);
  });

  it("rechaza archivos que no son respaldos", async () => {
    const { repo: r } = repo();
    await expect(r.importar("no es json")).rejects.toBeInstanceOf(ImportacionInvalidaError);
    await expect(r.importar(JSON.stringify({ formato: "otro" }))).rejects.toBeInstanceOf(ImportacionInvalidaError);
  });
});
