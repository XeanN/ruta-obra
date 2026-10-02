import { describe, expect, it } from "vitest";
import { enlaceReporte, urlHojaDeRuta, type DatoReportado } from "./reporte";

const dato: DatoReportado = {
  procedimientoId: "P-MUN-LIC-B",
  ubigeo: "150108",
  variante: "general",
  montoMostrado: "S/ 1,234.50",
  pagina: "https://rutaobra.pe/diagnostico/hoja-de-ruta?distrito=150108",
};

const paramsMailto = (href: string) => new URLSearchParams(href.slice(href.indexOf("?") + 1));

describe("enlaceReporte", () => {
  it("formulario con marcadores (Google Forms): reemplaza y codifica cada valor", () => {
    const href = enlaceReporte(dato, {
      formularioUrl:
        "https://docs.google.com/forms/d/e/X/viewform?usp=pp_url&entry.1={procedimiento}&entry.2={ubigeo}&entry.3={variante}&entry.4={monto}&entry.5={pagina}",
      correo: "info@aliiatech.com",
    });
    const url = new URL(href);
    expect(url.searchParams.get("entry.1")).toBe("P-MUN-LIC-B");
    expect(url.searchParams.get("entry.2")).toBe("150108");
    expect(url.searchParams.get("entry.3")).toBe("general");
    expect(url.searchParams.get("entry.4")).toBe("S/ 1,234.50");
    expect(url.searchParams.get("entry.5")).toBe(dato.pagina);
    expect(url.searchParams.get("usp")).toBe("pp_url");
  });

  it("formulario sin marcadores: agrega los datos como parámetros y omite los vacíos", () => {
    const href = enlaceReporte(
      { ...dato, ubigeo: null, variante: null },
      { formularioUrl: "https://forms.example.org/reporte?origen=app", correo: "x@y.pe" },
    );
    const url = new URL(href);
    expect(url.origin + url.pathname).toBe("https://forms.example.org/reporte");
    expect(url.searchParams.get("origen")).toBe("app");
    expect(url.searchParams.get("procedimiento")).toBe("P-MUN-LIC-B");
    expect(url.searchParams.get("monto")).toBe("S/ 1,234.50");
    expect(url.searchParams.has("ubigeo")).toBe(false);
    expect(url.searchParams.has("variante")).toBe(false);
  });

  it("sin formulario (o vacío): mailto con asunto y cuerpo prellenados", () => {
    for (const formularioUrl of [undefined, null, "", "  "]) {
      const href = enlaceReporte(dato, { formularioUrl, correo: "info@aliiatech.com" });
      expect(href.startsWith("mailto:info@aliiatech.com?subject=")).toBe(true);
      expect(href).not.toContain("+");
      const params = paramsMailto(href);
      expect(params.get("subject")).toBe("Dato desactualizado: P-MUN-LIC-B (150108)");
      const cuerpo = params.get("body") ?? "";
      expect(cuerpo).toContain("Procedimiento: P-MUN-LIC-B");
      expect(cuerpo).toContain("Distrito (ubigeo): 150108");
      expect(cuerpo).toContain("Variante: general");
      expect(cuerpo).toContain("Monto mostrado: S/ 1,234.50");
      expect(cuerpo).toContain(`Página: ${dato.pagina}`);
      expect(cuerpo).toContain("¿Qué viste?");
    }
  });

  it("mailto sin distrito, variante ni monto no deja líneas vacías de datos", () => {
    const href = enlaceReporte(
      { ...dato, ubigeo: null, variante: null, montoMostrado: null },
      { correo: "info@aliiatech.com" },
    );
    const params = paramsMailto(href);
    expect(params.get("subject")).toBe("Dato desactualizado: P-MUN-LIC-B");
    const cuerpo = params.get("body") ?? "";
    expect(cuerpo).not.toContain("Distrito");
    expect(cuerpo).not.toContain("Variante");
    expect(cuerpo).not.toContain("Monto");
  });
});

describe("urlHojaDeRuta", () => {
  it("arma la URL pública con las respuestas y sin barra doble", () => {
    expect(urlHojaDeRuta("https://rutaobra.pe/", { distrito: "150108", pisos: 3, x: null })).toBe(
      "https://rutaobra.pe/diagnostico/hoja-de-ruta?distrito=150108&pisos=3",
    );
    expect(urlHojaDeRuta("http://localhost:3000", {})).toBe("http://localhost:3000/diagnostico/hoja-de-ruta");
  });
});
