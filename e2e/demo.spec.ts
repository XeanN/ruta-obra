import { expect, test } from "@playwright/test";

test("la demo carga 3 expedientes en 1 clic desde la landing y se borra al salir", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { level: 1, name: /Todos tus expedientes de obra/ }),
  ).toBeVisible();
  // A 375 px la landing no debe tener scroll horizontal.
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);

  await page.getByRole("link", { name: "Ver demo" }).first().click();
  await expect(page).toHaveURL(/\/expedientes$/, { timeout: 15_000 });
  await expect(page.getByText("Estás viendo la demo.")).toBeVisible();
  await expect(page.getByText("3 de 3 expedientes")).toBeVisible();
  await expect(page.getByText("Ejemplo", { exact: true })).toHaveCount(3);

  // El expediente con observación muestra el plazo para subsanar.
  await page.getByRole("link", { name: "Ampliación Los Cedros, Chorrillos (demo)" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Ampliación Los Cedros, Chorrillos (demo)" })).toBeVisible();
  await page.getByRole("tab", { name: /Alertas/ }).click();
  await expect(page.getByRole("listitem").filter({ hasText: "para subsanar" })).toBeVisible();

  // Recargar la demo no duplica.
  await page.goto("/demo");
  await expect(page.getByText("3 de 3 expedientes")).toBeVisible();

  await page.getByRole("button", { name: "Salir de la demo" }).click();
  await expect(page.getByText("Todavía no tienes expedientes")).toBeVisible();
  await expect(page.getByText("Estás viendo la demo.")).toHaveCount(0);
});
