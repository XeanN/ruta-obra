import { expect, test, type Page } from "@playwright/test";

const CASO =
  "titulo=inscrito&lote_individual=si&construccion_existente=no&distrito=150140&zona_especial=ninguna&tipo_obra=obra_nueva&uso=vivienda_unifamiliar&pisos=2&area_total_m2=110";

async function nuevaEntrada(
  page: Page,
  e: { tipo: string; fecha: string; descripcion: string; monto?: string; avance?: string; responsable?: string },
) {
  await page.getByRole("button", { name: "Nueva entrada" }).click();
  const form = page.getByRole("form", { name: "Nueva entrada de bitácora" });
  await form.getByLabel("Tipo").selectOption({ label: e.tipo });
  await form.getByLabel("Fecha").fill(e.fecha);
  await form.getByLabel("Qué pasó").fill(e.descripcion);
  if (e.monto) await form.getByLabel("Monto (S/)").fill(e.monto);
  if (e.avance) await form.getByLabel("Avance de obra (%)").fill(e.avance);
  if (e.responsable) await form.getByLabel("Responsable").selectOption({ label: e.responsable });
  await form.getByRole("button", { name: "Agregar a la bitácora" }).click();
  await expect(form).toBeHidden();
}

test("bitácora: registrar, totales por tipo y mes, filtrar, editar y eliminar", async ({ page }) => {
  await page.goto(`/expedientes/nuevo?${CASO}`);
  await page.getByLabel("Nombre del expediente").fill("Casa bitácora");
  await page.getByLabel("Dirección del predio").fill("Calle 1");
  await page.getByRole("button", { name: "Agregar actor" }).click();
  await page.getByLabel("Rol").selectOption({ label: "Maestro de obra" });
  await page.getByLabel("Nombre", { exact: true }).fill("Don Lucho");
  await page.getByRole("button", { name: "Crear expediente" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Casa bitácora" })).toBeVisible();

  await page.getByRole("tab", { name: "Bitácora" }).click();
  await page.getByRole("button", { name: "Nueva entrada" }).click();
  await expect(page.getByText(/Para agregar fotos, crea tu cuenta/)).toBeVisible();
  await page.getByRole("button", { name: "Cancelar" }).click();

  await nuevaEntrada(page, { tipo: "Compra", fecha: "2026-09-28", descripcion: "Cemento y fierro", monto: "1250.50" });
  await nuevaEntrada(page, { tipo: "Pago", fecha: "2026-10-02", descripcion: "Semana 1", monto: "800", responsable: "Don Lucho (Maestro de obra)" });
  await nuevaEntrada(page, { tipo: "Avance", fecha: "2026-10-03", descripcion: "Vaciado de zapatas", avance: "12" });
  await nuevaEntrada(page, { tipo: "Compra", fecha: "2026-10-04", descripcion: "Ladrillos", monto: "349.90" });

  const resumen = page.getByText("Resumen de obra").locator("xpath=ancestor::*[@data-slot='card'][1]");
  await expect(resumen).toContainText("S/ 2,400.40");
  await expect(resumen).toContainText("12%");
  await expect(resumen).toContainText(/Compra\s*S\/ 1,600.40/);
  await expect(resumen).toContainText(/Octubre de 2026\s*S\/ 1,149.90/);
  await expect(resumen).toContainText(/Septiembre de 2026\s*S\/ 1,250.50/);

  await expect(page.getByRole("heading", { name: "Octubre de 2026" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Septiembre de 2026" })).toBeVisible();

  await page.getByLabel("Responsable", { exact: true }).selectOption({ label: "Don Lucho" });
  await expect(page.getByText("Semana 1")).toBeVisible();
  await expect(page.getByText("Ladrillos")).toBeHidden();
  await page.getByLabel("Responsable", { exact: true }).selectOption({ label: "Todos" });

  const ladrillos = page.getByRole("listitem").filter({ hasText: "Ladrillos" });
  await ladrillos.getByRole("button", { name: "Editar" }).click();
  const edicion = page.getByRole("form", { name: "Editar entrada" });
  await edicion.getByLabel("Monto (S/)").fill("400");
  await edicion.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(resumen).toContainText("S/ 2,450.50");

  await page.getByRole("listitem").filter({ hasText: "Cemento y fierro" }).getByRole("button", { name: "Eliminar" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Eliminar" }).click();
  await expect(page.getByText("Cemento y fierro")).toBeHidden();
  await expect(resumen).toContainText("S/ 1,200.00");

  await page.reload();
  await page.getByRole("tab", { name: "Bitácora" }).click();
  await expect(page.getByText("Vaciado de zapatas")).toBeVisible();

  const anchoExtra = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(anchoExtra).toBeLessThanOrEqual(0);
});
