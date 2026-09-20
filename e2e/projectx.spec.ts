import { test, expect } from "@playwright/test";

test("public shell renders", async ({ page }) => {
  const errors:string[]=[];
  page.on("console", m => { if(m.type()==="error") errors.push(m.text()); });
  await page.goto("/");
  await expect(page).toHaveTitle(/ProjectX/);
  await expect(page.getByText("Tell ProjectX what you want to accomplish")).toBeVisible();
  await expect(page.locator("#public-start")).toBeVisible();
  await expect(page.locator("#px-app")).toBeVisible();
  expect(errors).toEqual([]);
});

test("auth screen exposes login and signup controls", async ({ page }) => {
  await page.goto("/");
  const signup = page.locator("#public-signup");
  await expect(signup).toBeVisible();
  await signup.click();
  await expect(page.locator("#auth-email")).toBeVisible();
  await expect(page.locator("#auth-password")).toBeVisible();
  await expect(page.locator("#auth-submit")).toHaveText(/create account/i);
  await expect(page.locator("#auth-guest")).toBeVisible();
});

test("responsive shell does not overflow horizontally", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
  expect(overflow).toBe(false);
});
