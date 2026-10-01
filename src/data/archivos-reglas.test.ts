import { describe, expect, it } from "vitest";
import { ArchivoNoPermitidoError, claveDeArchivo, TAMANO_MAXIMO, validarArchivo } from "./archivos-reglas";

describe("reglas de archivos", () => {
  it("acepta fotos y PDF hasta 10 MB", () => {
    expect(() => validarArchivo({ tipo: "image/jpeg", tamano: 500_000 })).not.toThrow();
    expect(() => validarArchivo({ tipo: "application/pdf", tamano: TAMANO_MAXIMO })).not.toThrow();
  });

  it("rechaza otros tipos, archivos vacíos y de más de 10 MB", () => {
    expect(() => validarArchivo({ tipo: "text/html", tamano: 10 })).toThrow(ArchivoNoPermitidoError);
    expect(() => validarArchivo({ tipo: "image/png", tamano: 0 })).toThrow(/vacío/);
    expect(() => validarArchivo({ tipo: "image/png", tamano: TAMANO_MAXIMO + 1 })).toThrow(/10 MB/);
  });

  it("arma la clave con estudio, expediente e id, sin caracteres peligrosos", () => {
    expect(claveDeArchivo("est-1", "exp-1", "abc", "image/webp")).toBe("est-1/exp-1/abc.webp");
    expect(claveDeArchivo("../x", "a/b", "c?d", "application/pdf")).toBe("x/ab/cd.pdf");
    expect(() => claveDeArchivo("e", "x", "i", "text/plain")).toThrow(ArchivoNoPermitidoError);
  });
});
