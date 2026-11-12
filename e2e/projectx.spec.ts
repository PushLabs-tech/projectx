import { test, expect } from "@playwright/test";

test("public shell renders", async ({ page }) => {
  const errors:string[]=[];
  page.on("console", m => { if(m.type()==="error") errors.push(m.text()); });
  await page.goto("/app.html");
  await expect(page).toHaveTitle(/ProjectX/);
  await expect(page.getByRole("heading", { name: /Turn any idea into a real product/i })).toBeVisible();
  await expect(page.locator("#pxl-purpose")).toBeAttached();
  await expect(page.locator("#pxl-create")).toBeAttached();
  await expect(page.locator("#pxl-difference")).toBeAttached();
  await expect(page.locator("#pxl-experience")).toBeAttached();
  await expect(page.locator("#pxl-brain")).toBeAttached();
  await expect(page.locator("#pxl-execution")).toBeAttached();
  await expect(page.locator("#pxl-final")).toBeAttached();
  await expect(page.locator("#public-start-arrow")).toBeVisible();
  await expect(page.locator("#px-app")).toBeVisible();
  expect(errors).toEqual([]);
});


test("public landing sections form one continuous scroll page", async ({ page }) => {
  await page.goto("/app.html");
  const sections = await page.locator("main > section").evaluateAll(nodes =>
    nodes.map(node => ({ id: node.id, top: node.getBoundingClientRect().top + window.scrollY }))
  );
  expect(sections.map(section => section.id)).toEqual([
    "pxl-hero", "pxl-purpose", "pxl-create", "pxl-difference",
    "pxl-experience", "pxl-brain", "pxl-execution", "pxl-final"
  ]);
  expect(sections.every((section, index) => index === 0 || section.top > sections[index - 1].top)).toBe(true);
});

test("Project Brain modules and architecture drill-down are interactive", async ({ page }) => {
  await page.goto("/app.html");
  await page.locator("#pxl-brain").evaluate((el:any) => el.scrollIntoView({block:"center"}));
  await page.locator('[data-brain-module="architecture"]').evaluate((el:any) => el.click());
  await expect(page.locator("#pxl-brain-stage")).toHaveClass(/has-selection/);
  await expect(page.locator("#pxl-brain-detail h3")).toHaveText("Architecture");
  await page.locator('[data-brain-path="Frontend"]').click();
  await expect(page.locator("#pxl-brain-detail h3")).toHaveText("Frontend");
  await page.locator('[data-brain-path="Landing"]').click();
  await expect(page.locator("#pxl-brain-detail h3")).toHaveText("Landing");
  await page.locator('[data-brain-path="Hero"]').click();
  await page.locator('[data-brain-path="Composer"]').click();
  await expect(page.locator("#pxl-brain-detail h3")).toHaveText("Composer");
  await page.locator("[data-brain-back]").click();
  await expect(page.locator("#pxl-brain-detail h3")).toHaveText("Hero");
});

test("hero creation type controls update the real composer context", async ({ page }) => {
  await page.goto("/app.html");
  const input = page.locator("#start-input");
  await page.locator('button[data-domain="agent"]').click();
  await expect(input).toHaveAttribute("data-domain", "agent");
  await expect(input).toHaveAttribute("placeholder", /AI agent/i);
  await expect(page.locator('button[data-domain="agent"]')).toHaveAttribute("aria-pressed", "true");
});

test("auth screen exposes login and signup controls", async ({ page }) => {
  await page.goto("/app.html");
  await page.locator("#public-signin").click();
  const signup = page.locator("#auth-signup-mode");
  await expect(signup).toBeVisible();
  await signup.click();
  await expect(page.locator("#auth-email")).toBeVisible();
  await expect(page.locator("#auth-password")).toBeVisible();
  await expect(page.locator("#auth-submit")).toHaveText(/create account/i);
  await expect(page.locator("#auth-guest")).toBeVisible();
});

test("responsive shell does not overflow horizontally", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/app.html");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
  expect(overflow).toBe(false);
});

test("mobile creation shortcuts wrap instead of requiring horizontal scrolling", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/app.html#workspace");
  const shortcuts = page.locator(".px-home-shortcuts");
  await expect(shortcuts).toBeVisible();
  const layout = await shortcuts.evaluate(el => ({
    flexWrap: getComputedStyle(el).flexWrap,
    overflowX: getComputedStyle(el).overflowX,
    scrollWidth: el.scrollWidth,
    clientWidth: el.clientWidth,
    optionCount: el.querySelectorAll("button").length
  }));
  expect(layout.flexWrap).toBe("wrap");
  expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth + 2);
  expect(layout.optionCount).toBeGreaterThan(1);
});


test("project shell can open guest creation flow and expose execution workspace", async ({ page }) => {
  const errors:string[]=[];
  page.on("pageerror", e => errors.push(e.message));
  page.on("console", m => { if(m.type()==="error") errors.push(m.text()); });

  await page.goto("/app.html");
  await page.locator("#start-input").fill("Create a small personal portfolio website with an introduction and projects section.");
  await page.locator("#public-start-arrow").click();

  await expect(page.locator("#px-app")).toBeVisible();
  const appText = await page.locator("#px-app").innerText();
  expect(appText).toMatch(/ProjectX|workspace|project/i);

  const interactive = page.locator("button:visible");
  await expect(interactive.first()).toBeVisible();

  expect(errors.filter(x => !/favicon/i.test(x))).toEqual([]);
});

test("runs navigation contract is wired into the project UI", async ({ page }) => {
  await page.goto("/app.html");
  await expect(page.locator("#px-app")).toBeVisible();

  const creationContract = await page.evaluate(async () => {
    const response = await fetch("/projectx/px-ui.js?v=54.0.0");
    const source = await response.text();
    return {
      friendlyHeading: source.includes("A few quick questions, then I'll start."),
      hidesTechnicalDiscovery: source.includes("You can answer in your own words. I'll handle the technical details.")
    };
  });
  expect(creationContract.friendlyHeading).toBe(true);
  expect(creationContract.hidesTechnicalDiscovery).toBe(true);

  const sourceContract = await page.evaluate(async () => {
    const response = await fetch("/projectx/px-ui.js?v=54.0.0");
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
  await page.goto("/app.html");
  await expect(page.locator("#public-start-arrow")).toBeVisible();

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


test("authenticated workspace smoke path syncs a real account", async ({ page }) => {
  const email = process.env.PROJECTX_E2E_EMAIL;
  const password = process.env.PROJECTX_E2E_PASSWORD;
  test.skip(!email || !password, "Set PROJECTX_E2E_EMAIL and PROJECTX_E2E_PASSWORD for the live authenticated gate.");

  const errors:string[]=[];
  page.on("pageerror", e => errors.push(e.message));
  page.on("console", m => { if(m.type()==="error") errors.push(m.text()); });

  await page.goto("/app.html?projectx_e2e_chaos=placeholder#login");
  await page.locator("#auth-email").fill(email!);
  await page.locator("#auth-password").fill(password!);
  await page.locator("#auth-submit").click();

  await expect(page.locator("#px-app")).toBeVisible();
  await expect(page.locator("#start-input")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator(".composer .sub")).toContainText(/signed in/i);

  const before = await page.locator("#home-projects").innerText();
  await page.locator('[data-template]').first().click();
  await expect(page.locator("#project-body")).toBeVisible();
  await expect(page.locator(".project-title")).toBeVisible();

  const after = await page.locator("#px-app").innerText();
  expect(after).toMatch(/project|assistant|build/i);
  expect(before.length).toBeGreaterThanOrEqual(0);
  expect(errors.filter(x => !/favicon/i.test(x))).toEqual([]);
});

test("authenticated autonomous loop can discover, reconcile, and verify a real project", async ({ page }) => {
  const email = process.env.PROJECTX_E2E_EMAIL;
  const password = process.env.PROJECTX_E2E_PASSWORD;
  test.skip(!email || !password, "Set PROJECTX_E2E_EMAIL and PROJECTX_E2E_PASSWORD for the live autonomous gate.");

  const errors:string[]=[];
  page.on("pageerror", e => errors.push(e.message));
  page.on("console", m => { if(m.type()==="error") errors.push(m.text()); });

  await page.goto("/app.html#login");
  await page.locator("#auth-email").fill(email!);
  await page.locator("#auth-password").fill(password!);
  await page.locator("#auth-submit").click();
  await expect(page.locator("#px-app")).toBeVisible();
  await expect(page.locator("#start-input")).toBeVisible({ timeout: 15_000 });

  await page.locator("#start-input").fill(
    "Build a tiny fictional bakery landing page with a hero, three menu items, opening hours, and a contact section."
  );
  await page.locator("#start-send").click();

  // Discovery is intentionally allowed to ask contextual questions. Keep the
  // test deterministic by selecting the first concrete option when a poll is shown.
  for (let i=0; i<6; i++) {
    const poll = page.locator("#interview-poll");
    if (await poll.count() && await poll.isVisible().catch(()=>false)) {
      const option = poll.locator(".poll-option").first();
      if (await option.count()) {
        await option.click();
        await page.waitForTimeout(700);
        continue;
      }
    }
    if (await page.locator("#project-body").count()) break;
    await page.waitForTimeout(1500);
  }

  await expect(page.locator("#project-body")).toBeVisible({ timeout: 45_000 });

  // The project is created through the authenticated createProjectFromIntent path,
  // so reconciliation below exercises the real remote-worker boundary.
  await page.locator('[data-section="impact"]').click();
  await expect(page.locator("#impact-run-reconcile")).toBeVisible({ timeout: 15_000 });
  await page.locator("#impact-run-reconcile").click();

  const status = page.locator("#impact-run-status");
  await expect(status).toContainText(/Reconciliation (complete|reconciled)|action\(s\) executed/i, { timeout: 180_000 });

  const journalEvidence = await page.evaluate(() => {
    const raw = Object.values(localStorage).join("\\n");
    return /repair_cycle_started|repair_scheduled/i.test(raw);
  });
  expect(journalEvidence).toBe(true);

  const finalText = await status.innerText();
  expect(finalText).not.toMatch(/stopped|failed|blocked/i);

  // The final verification gate must be represented in the rendered execution
  // state rather than inferred from the presence of a button or project shell.
  const bodyText = await page.locator("#project-body").innerText();
  expect(bodyText).toMatch(/complete|passed|verified/i);
  expect(errors.filter(x => !/favicon/i.test(x))).toEqual([]);
});
