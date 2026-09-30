import { expect, test, type Page } from "@playwright/test";

async function elegir(page: Page, opcion: string) {
  await page.getByRole("radio", { name: opcion, exact: true }).click();
  await page.getByRole("button", { name: /Siguiente|Ver resultado/ }).click();
}

async function escribir(page: Page, valor: string) {
  await page.getByRole("spinbutton").fill(valor);
  await page.getByRole("button", { name: /Siguiente|Ver resultado/ }).click();
}

test("caso real de referencia: compraventa sin inscribir cerca de Pantanos de Villa → modalidad B", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Diagnosticar mi predio" }).click();
  await expect(page.getByText("Pregunta 1 de")).toBeVisible();

  await elegir(page, "Tengo contrato o minuta de compraventa, sin inscribir");
  await elegir(page, "Sí");
  await elegir(page, "Sí, pero sin licencia o sin declarar");
  await elegir(page, "Hasta el 31-12-2016");
  await elegir(page, "Chorrillos");
  await elegir(page, "Cerca de los Pantanos de Villa");
  await elegir(page, "Ampliar (más pisos o más área)");
  await elegir(page, "Vivienda de una familia");
  await escribir(page, "3");
  await escribir(page, "260");
  await elegir(page, "Sí");
  await page.getByRole("button", { name: "Omitir" }).click(); // excavación
  await escribir(page, "180000");
  await elegir(page, "Recursos propios");
  await elegir(page, "Sí");

  await expect(page).toHaveURL(/\/diagnostico\/resultado\?/);
  await expect(page.getByText("Modalidad B", { exact: true })).toBeVisible();
  await expect(page.getByText(/Sin predio inscrito a tu nombre/)).toBeVisible();
  await expect(page.getByText(/Necesitas opinión de PROHVILLA/)).toBeVisible();
  await expect(page.getByText("Prioridad crítica")).toBeVisible();

  // El resultado vive en la URL: recargar no pierde nada.
  await page.reload();
  await expect(page.getByText("Modalidad B", { exact: true })).toBeVisible();

  // Sin scroll horizontal a 375 px.
  const anchoExtra = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(anchoExtra).toBeLessThanOrEqual(0);
});

test("valida la respuesta, conserva el avance al recargar y permite editar desde el resultado", async ({
  page,
}) => {
  await page.goto("/diagnostico");
  await page.getByRole("button", { name: "Siguiente" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Elige una opción" })).toBeVisible();

  await elegir(page, "Inscrita en SUNARP a mi nombre");
  await expect(page.getByText("Pregunta 2 de")).toBeVisible();
  await page.reload();
  await expect(page.getByText("Pregunta 2 de")).toBeVisible();

  await page.getByRole("button", { name: "Atrás" }).click();
  await expect(page.getByRole("radio", { name: "Inscrita en SUNARP a mi nombre" })).toBeChecked();

  await page.goto(
    "/diagnostico/resultado?titulo=inscrito&lote_individual=si&construccion_existente=no&distrito=150140&zona_especial=ninguna&tipo_obra=obra_nueva&uso=vivienda_unifamiliar&pisos=2&area_total_m2=110",
  );
  await expect(page.getByText("Modalidad A", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Cambiar: ¿Cuántos pisos tendrá en total?" }).click();
  await expect(page.getByRole("spinbutton")).toHaveValue("2");
  await page.getByRole("spinbutton").fill("0");
  await page.getByRole("button", { name: "Siguiente" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Debe ser al menos 1" })).toBeVisible();
});

test("resultado incompleto pide continuar el diagnóstico", async ({ page }) => {
  await page.goto("/diagnostico/resultado?titulo=inscrito");
  await expect(page.getByText("Faltan respuestas")).toBeVisible();
  await page.getByRole("link", { name: "Continuar el diagnóstico" }).click();
  await expect(page.getByText("Pregunta 2 de")).toBeVisible();
});
