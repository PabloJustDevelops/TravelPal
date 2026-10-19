import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { deleteInteriorFixture } from "../support/cleanup";
import { hasCredentials, signIn, uniqueName } from "../support/flows";

test("perfil: editar y cancelar conserva contraste en ambos temas y tamaños", async ({ page }) => {
  test.skip(!hasCredentials, "faltan credenciales E2E");
  await signIn(page);
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1024 });
    for (const theme of ["light", "dark"]) {
      await page.evaluate((value) => localStorage.setItem("theme", value), theme);
      await page.goto("/profile", { waitUntil: "networkidle" });
      const name = page.getByLabel("Nombre Completo", { exact: true });
      const original = await name.inputValue();
      await page.getByRole("button", { name: "Editar Perfil", exact: true }).click();
      const axe = await new AxeBuilder({ page }).include("main").analyze();
      expect(axe.violations).toEqual([]);
      await name.fill("Borrador de perfil QA");
      await page.getByRole("button", { name: "Cancelar", exact: true }).click();
      await expect(name).toBeDisabled();
      await expect(name).toHaveValue(original);
    }
  }
});

test("notas: guardar, favorita persistida y proteger el borrador al cambiar o cerrar", async ({
  page,
}) => {
  test.skip(!hasCredentials, "faltan credenciales E2E");
  const title = uniqueName("nota-interior");
  await signIn(page);
  try {
    await page.goto("/notes");
    await page.getByRole("button", { name: "Nueva Nota", exact: true }).click();
    const editor = page.getByRole("region", { name: "Editor de nota" });
    await editor.getByLabel("Título *", { exact: true }).fill(title);
    await editor
      .getByLabel("Contenido *", { exact: true })
      .fill(
        "## Mi lista\n- Billetes\n- Pasaporte\n\n<img src=x onerror=alert(1)>",
      );
    await editor.getByRole("button", { name: "Vista Previa" }).click();
    await expect(
      editor.getByRole("heading", { name: "Mi lista" }),
    ).toBeVisible();
    await expect(editor.getByRole("img")).toHaveCount(0);
    await editor
      .getByRole("button", { name: "Guardar Nota", exact: true })
      .click();
    await page.getByRole("button", { name: `Editar nota ${title}` }).click();
    await page
      .getByRole("button", { name: `Añadir a favoritas: ${title}` })
      .click();
    await expect(
      page.getByRole("button", { name: `Quitar de favoritas: ${title}` }),
    ).toHaveAttribute("aria-pressed", "true");
    await page.reload();
    await page.getByRole("button", { name: "Favoritas", exact: true }).click();
    await page.getByRole("button", { name: `Editar nota ${title}` }).click();
    await editor
      .getByLabel("Contenido *", { exact: true })
      .fill("Un borrador sin guardar");
    page.once("dialog", (dialog) => dialog.dismiss());
    await page.getByRole("button", { name: "Nueva Nota", exact: true }).click();
    await expect(editor.getByLabel("Contenido *", { exact: true })).toHaveValue(
      "Un borrador sin guardar",
    );
    page.once("dialog", (dialog) => dialog.dismiss());
    await page
      .getByRole("navigation", { name: "Navegación principal" })
      .getByRole("link", { name: "Viajes", exact: true })
      .click();
    await expect(page).toHaveURL(/\/notes$/);
    page.once("dialog", (dialog) => dialog.accept());
    await editor.getByRole("button", { name: "Cancelar" }).click();
    await page.getByRole("button", { name: `Editar nota ${title}` }).click();
    await expect(
      editor.getByLabel("Contenido *", { exact: true }),
    ).not.toHaveValue("Un borrador sin guardar");
    const axe = await new AxeBuilder({ page }).include("main").analyze();
    expect(axe.violations).toEqual([]);
  } finally {
    await deleteInteriorFixture("notes", title);
  }
});

test("tareas: lista, cambio de estado persistido, búsqueda y modos existentes", async ({
  page,
}) => {
  test.skip(!hasCredentials, "faltan credenciales E2E");
  const title = uniqueName("tarea-interior");
  await signIn(page);
  try {
    await page.goto("/tasks");
    await page
      .getByRole("button", { name: "Nueva Tarea", exact: true })
      .click();
    const dialog = page.getByRole("dialog", { name: "Nueva Tarea" });
    await dialog.getByLabel("Título", { exact: true }).fill(title);
    await dialog
      .getByLabel("Descripción", { exact: true })
      .fill("Preparativos personales");
    await dialog.getByRole("button", { name: "Guardar", exact: true }).click();
    const status = page.getByRole("combobox", {
      name: `Mover la tarea ${title}`,
    });
    await expect(status).toHaveValue("pending");
    const update = page.waitForResponse(
      (response) =>
        response.request().method() === "PATCH" &&
        response.url().includes("/tasks"),
    );
    await status.selectOption("in_progress");
    expect((await update).ok()).toBe(true);
    await page.reload();
    await expect(status).toHaveValue("in_progress");
    await page.getByRole("textbox", { name: "Buscar tareas" }).fill(title);
    await expect(
      page.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Vista Tablero", exact: true })
      .click();
    await expect(
      page.getByRole("combobox", { name: `Mover la tarea ${title}` }),
    ).toHaveValue("in_progress");
    await page
      .getByRole("button", { name: "Vista Calendario", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Vista Calendario" }),
    ).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Lista", exact: true }).click();
    const axe = await new AxeBuilder({ page }).include("main").analyze();
    expect(axe.violations).toEqual([]);
  } finally {
    await deleteInteriorFixture("tasks", title);
  }
});
