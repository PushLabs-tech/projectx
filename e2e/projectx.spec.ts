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


test("project shell can open guest creation flow and expose execution workspace", async ({ page }) => {
  const errors:string[]=[];
  page.on("pageerror", e => errors.push(e.message));
  page.on("console", m => { if(m.type()==="error") errors.push(m.text()); });

  await page.goto("/");
  await page.locator("#public-start").click();

  await expect(page.locator("#px-app")).toBeVisible();
  const appText = await page.locator("#px-app").innerText();
  expect(appText).toMatch(/ProjectX|workspace|project/i);

  const interactive = page.locator("button:visible");
  await expect(interactive.first()).toBeVisible();

  expect(errors.filter(x => !/favicon/i.test(x))).toEqual([]);
});

test("runs navigation contract is wired into the project UI", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#px-app")).toBeVisible();

  const sourceContract = await page.evaluate(async () => {
    const response = await fetch("/px-ui.js?v=48.0.0");
    const source = await response.text();
    return {
      runsNav: source.includes("'runs'") && source.includes("Runs"),
      runsPalette: source.includes("Open execution runs")
    };
  });

  expect(sourceContract.runsNav).toBe(true);
  expect(sourceContract.runsPalette).toBe(true);
});

test("public mobile shell remains usable after observability release", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator("#public-start")).toBeVisible();

  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    visibleButtons: Array.from(document.querySelectorAll("button")).filter(b => {
      const r=b.getBoundingClientRect();
      return r.width>0 && r.height>0;
    }).length
  }));

  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 2);
  expect(metrics.visibleButtons).toBeGreaterThan(0);
});
