import { expect, test } from "@playwright/test";

// Un navegador en "es-ES" formatea números distinto que el servidor ("0 %" vs "0%"): si un
// componente usa el idioma del navegador, React rehace la página al hidratar (error #418).
test.use({ locale: "es-ES", timezoneId: "Europe/Madrid" });

for (const ruta of ["/", "/diagnostico", "/fuentes", "/expedientes"]) {
  test(`sin errores de hidratación en ${ruta} con el navegador en es-ES`, async ({ page }) => {
    const errores: string[] = [];
    page.on("pageerror", (e) => errores.push(e.message));
    await page.goto(ruta);
    await page.waitForLoadState("networkidle");
    expect(errores).toEqual([]);
  });
}
