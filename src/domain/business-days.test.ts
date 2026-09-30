import { describe, expect, it } from "vitest";
import { diasHabilesEntre, esDiaHabil, sumarDiasHabiles } from "./business-days";

// Octubre 2026: jueves 01, viernes 02, sábado 03, domingo 04, lunes 05.

describe("esDiaHabil", () => {
  it("lunes a viernes sí; fines de semana no", () => {
    expect(esDiaHabil("2026-10-02")).toBe(true);
    expect(esDiaHabil("2026-10-03")).toBe(false);
    expect(esDiaHabil("2026-10-04")).toBe(false);
  });

  it("excluye feriados", () => {
    expect(esDiaHabil("2026-10-08", ["2026-10-08"])).toBe(false);
  });

  it("rechaza fechas inválidas", () => {
    expect(() => esDiaHabil("02/10/2026")).toThrow(/Fecha inválida/);
    expect(() => esDiaHabil("2026-02-30")).toThrow(/Fecha inválida/);
  });
});

describe("sumarDiasHabiles", () => {
  it("salta fines de semana (plazo de subsanación de 5 días hábiles)", () => {
    expect(sumarDiasHabiles("2026-10-02", 5)).toBe("2026-10-09");
    expect(sumarDiasHabiles("2026-10-01", 1)).toBe("2026-10-02");
    expect(sumarDiasHabiles("2026-10-02", 1)).toBe("2026-10-05");
  });

  it("desde un fin de semana cuenta desde el lunes", () => {
    expect(sumarDiasHabiles("2026-10-03", 1)).toBe("2026-10-05");
  });

  it("salta feriados", () => {
    expect(sumarDiasHabiles("2026-10-07", 1, ["2026-10-08"])).toBe("2026-10-09");
  });

  it("0 devuelve la misma fecha; negativos restan", () => {
    expect(sumarDiasHabiles("2026-10-03", 0)).toBe("2026-10-03");
    expect(sumarDiasHabiles("2026-10-05", -1)).toBe("2026-10-02");
  });

  it("cruza meses y años", () => {
    expect(sumarDiasHabiles("2026-12-31", 1)).toBe("2027-01-01");
    expect(sumarDiasHabiles("2026-10-30", 1)).toBe("2026-11-02");
  });

  it("rechaza días no enteros", () => {
    expect(() => sumarDiasHabiles("2026-10-02", 1.5)).toThrow(/entero/);
  });
});

describe("diasHabilesEntre", () => {
  it("cuenta hábiles en (desde, hasta]", () => {
    expect(diasHabilesEntre("2026-10-02", "2026-10-09")).toBe(5);
    expect(diasHabilesEntre("2026-10-02", "2026-10-02")).toBe(0);
    expect(diasHabilesEntre("2026-10-02", "2026-10-04")).toBe(0);
  });

  it("es negativo y simétrico hacia atrás", () => {
    expect(diasHabilesEntre("2026-10-09", "2026-10-02")).toBe(-5);
    expect(diasHabilesEntre("2026-10-05", "2026-10-03")).toBe(-1);
  });

  it("es inverso de sumarDiasHabiles", () => {
    for (const n of [1, 3, 5, 10, 22]) {
      expect(diasHabilesEntre("2026-10-02", sumarDiasHabiles("2026-10-02", n))).toBe(n);
    }
  });

  it("descuenta feriados", () => {
    expect(diasHabilesEntre("2026-10-02", "2026-10-09", ["2026-10-08"])).toBe(4);
  });
});
