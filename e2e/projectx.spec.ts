import { test, expect } from "@playwright/test";

test("public homepage renders the eight landing sections in order", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/ProjectX/);
  await expect(page.getByRole("heading", { name: /Turn any idea into a real product/i })).toBeVisible();

  const sectionIds = await page.locator("#main-content > section").evaluateAll(sections =>
    sections.map(section => section.id)
  );
  expect(sectionIds).toEqual(["top", "purpose", "create", "difference", "experience", "brain", "loop", "final-cta"]);
});

test("idea form saves locally and reset clears the idea and format", async ({ page }) => {
  await page.goto("/");
  const idea = page.getByPlaceholder("What do you want to create?");
  const appChip = page.locator('[data-format="app"]');

  await idea.fill("A music practice app for beginners");
  await appChip.click();
  await page.getByRole("button", { name: "Save your idea on this page" }).click();
  await expect(page.locator("#idea-status")).toContainText("Idea saved in this browser");
  await expect(appChip).toHaveAttribute("aria-pressed", "true");

  await page.reload();
  await expect(idea).toHaveValue("A music practice app for beginners");
  await expect(appChip).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Reset idea and selection" }).click();
  await expect(idea).toHaveValue("");
  await expect(appChip).toHaveAttribute("aria-pressed", "false");
});

test("mobile navigation opens, navigates, and closes", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const menu = page.getByRole("button", { name: "Open navigation" });

  await menu.click();
  await expect(page.getByRole("button", { name: "Close navigation" })).toHaveAttribute("aria-expanded", "true");
  await page.getByRole("link", { name: "Product" }).click();
  await expect(page).toHaveURL(/#create$/);
  await expect(page.getByRole("button", { name: "Open navigation" })).toHaveAttribute("aria-expanded", "false");
});

test("get started focuses the idea box and placeholder actions explain their state", async ({ page }) => {
  await page.goto("/");
  await page.locator(".header-actions [data-app-action='get-started']").click();
  await expect(page.locator("#idea-input")).toBeFocused();

  await page.getByRole("button", { name: "Pricing", exact: true }).click();
  await expect(page.locator("#site-notice")).toContainText("Pricing details are being prepared");
});

test("footer signup provides clear feedback without sending an email", async ({ page }) => {
  await page.goto("/");
  await page.locator("#email-input").fill("person@example.com");
  await page.getByRole("button", { name: "Submit email" }).click();
  await expect(page.locator("#email-status")).toContainText("Email signup is not connected yet");
  await expect(page.locator("#email-status")).toContainText("No email was sent");
});
