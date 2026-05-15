// Captures screenshots of the running dev server (localhost:5173) using Playwright.
// Run: node scripts/screenshots.mjs
//
// Requires the dev server to be running and PREVIEW_MODE=true so pages render
// without needing a Supabase login.

import { chromium } from "playwright";
import { mkdir } from "fs/promises";

const BASE = "http://localhost:5173";
const OUT = "docs/screenshots";

const DESKTOP = { width: 1280, height: 800 };
const MOBILE  = { width: 390, height: 844, isMobile: true, hasTouch: true };

const PAGES = [
  { name: "dashboard",     path: "/dashboard" },
  { name: "deals",         path: "/deals" },
  { name: "leads",         path: "/leads" },
  { name: "contacts",      path: "/contacts" },
  { name: "transactions",  path: "/cashflow/transactions" },
  { name: "cashflow",      path: "/cashflow" },
  { name: "tasks",         path: "/tasks" },
  { name: "settings",      path: "/settings" },
];

async function shot(page, viewport, name, label) {
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  await page.goto(`${BASE}${name}`, { waitUntil: "networkidle" });
  // Give charts / animations a moment to settle
  await page.waitForTimeout(800);
  await page.screenshot({
    path: `${OUT}/${label}.png`,
    fullPage: false,
  });
  console.log(`  ✓ ${OUT}/${label}.png`);
}

(async () => {
  await mkdir(OUT, { recursive: true });

  const browser = await chromium.launch();

  // Dark mode desktop
  const darkCtx = await browser.newContext({
    colorScheme: "dark",
    viewport: DESKTOP,
    storageState: undefined,
  });
  const darkPage = await darkCtx.newPage();
  // Set theme token so the app picks up dark mode immediately
  await darkPage.addInitScript(() => localStorage.setItem("theme", "dark"));

  console.log("Dark desktop:");
  for (const { name, path } of PAGES) {
    await shot(darkPage, DESKTOP, path, `${name}-dark`);
  }

  // Light mode desktop
  const lightCtx = await browser.newContext({
    colorScheme: "light",
    viewport: DESKTOP,
  });
  const lightPage = await lightCtx.newPage();
  await lightPage.addInitScript(() => localStorage.setItem("theme", "light"));

  console.log("Light desktop:");
  for (const { name, path } of PAGES) {
    await shot(lightPage, DESKTOP, path, `${name}-light`);
  }

  // Mobile (dark)
  const mobileCtx = await browser.newContext({
    colorScheme: "dark",
    viewport: { width: MOBILE.width, height: MOBILE.height },
    isMobile: true,
    hasTouch: true,
  });
  const mobilePage = await mobileCtx.newPage();
  await mobilePage.addInitScript(() => localStorage.setItem("theme", "dark"));

  console.log("Mobile dark:");
  for (const { name, path } of [
    { name: "dashboard", path: "/dashboard" },
    { name: "deals",     path: "/deals" },
    { name: "leads",     path: "/leads" },
  ]) {
    await shot(mobilePage, { width: MOBILE.width, height: MOBILE.height }, path, `${name}-mobile`);
  }

  await browser.close();
  console.log("\nDone.");
})();
