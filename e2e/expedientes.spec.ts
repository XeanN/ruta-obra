import { expect, test, type Page } from "@playwright/test";

const CASO_ANGEL =
  "titulo=compraventa_no_inscrita&lote_individual=si&construccion_existente=si_sin_declarar&fecha_construccion=hasta_2016&distrito=150108&zona_especial=pantanos_villa&tipo_obra=ampliacion&uso=vivienda_unifamiliar&pisos=3&area_total_m2=260&cambio_estructural=si&valor_obra_soles=180000&financiamiento=propio&contrata_obreros=si";

async function crearExpediente(page: Page, nombre: string) {
  await page.goto(`/diagnostico/resultado?${CASO_ANGEL}`);
  await page.getByRole("link", { name: "Guardar como expediente" }).click();
  await expect(page.getByRole("heading", { name: "Guarda este caso para seguirlo" })).toBeVisible();
  await page.getByLabel("Nombre del expediente").fill(nombre);
  await page.getByLabel("Dirección del predio").fill("Av. Los Pantanos 123");
  await page.getByRole("button", { name: "Agregar actor" }).click();
  await page.getByLabel("Nombre", { exact: true }).fill("Ángel Ponce");
  await page.getByRole("button", { name: "Crear expediente" }).click();
  await expect(page.getByRole("heading", { level: 1, name: nombre })).toBeVisible();
}

test("crear un expediente, marcar una observación y ver la alerta de 5 días hábiles; recargar no pierde nada", async ({
  page,
}) => {
  await crearExpediente(page, "Casa Chorrillos");
  await expect(page.getByText("Modalidad B").first()).toBeVisible();

  const parametros = page.locator("details", { hasText: "Certificado de Parámetros Urbanísticos" }).first();
  await parametros.locator("summary").click();
  await parametros.getByLabel("Estado").selectOption("observado");
  await parametros.getByLabel("N.° de trámite en la entidad").fill("EXP-2026-001");
  await parametros.getByRole("button", { name: "Guardar seguimiento" }).click();
  await expect(parametros.getByText("Observado").first()).toBeVisible();

  await page.getByRole("tab", { name: /Alertas \(1\)/ }).click();
  const alerta = page.getByRole("listitem").filter({ hasText: "para subsanar" });
  await expect(alerta).toContainText("5 días hábiles");
  await expect(alerta).toContainText(/Faltan \d+ días hábiles/);

  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: "Casa Chorrillos" })).toBeVisible();
  await page.getByRole("tab", { name: /Alertas \(1\)/ }).click();
  await expect(page.getByRole("listitem").filter({ hasText: "para subsanar" })).toBeVisible();

  await page.getByRole("link", { name: "Mis expedientes" }).click();
  const tarjeta = page.getByRole("listitem").filter({ hasText: "Casa Chorrillos" }).first();
  // Con 5 días hábiles por delante la alerta es media: sigue "En curso" (pasa a "Con alertas" a 2 días o vencida).
  await expect(tarjeta).toContainText("En curso");
  await expect(tarjeta).toContainText("Próximo paso");
  await expect(tarjeta).toContainText(/para subsanar.*Faltan \d+ días hábiles/);
});

test("checklist: anotar la emisión de la copia literal calcula su vencimiento", async ({ page }) => {
  await crearExpediente(page, "Casa checklist");
  await page.getByRole("tab", { name: "Checklist" }).click();
  const copia = page.getByRole("listitem").filter({ hasText: "Copia literal de la partida registral" }).first();
  await copia.getByLabel("Estado").selectOption("obtenido");
  await copia.getByLabel("Fecha de emisión").fill("2020-01-01");
  await expect(copia).toContainText("Venció el 31/01/2020");
  await expect(copia.getByText("Vencido", { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole("tab", { name: "Checklist" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: "Copia literal de la partida registral" }).first()).toContainText(
    "Venció el 31/01/2020",
  );
});

test("con el almacenamiento bloqueado avisa y no se rompe", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new DOMException("bloqueado", "SecurityError");
      },
    });
  });
  await page.goto("/expedientes");
  await expect(page.getByText("No podemos guardar en este navegador")).toBeVisible();
  await page.goto("/diagnostico");
  await expect(page.getByText("Pregunta 1 de")).toBeVisible();
});
