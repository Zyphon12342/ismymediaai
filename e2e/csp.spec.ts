import { expect, test } from "@playwright/test";

// Fails if the Content-Security-Policy blocks anything the pages load,
// including Turnstile, PostHog and Cloudflare's beacon where they are on.
test("pages load with no CSP violations @smoke", async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { cspViolations: string[] }).cspViolations = [];
    document.addEventListener("securitypolicyviolation", (e) => {
      (window as unknown as { cspViolations: string[] }).cspViolations.push(`${location.pathname}: ${e.violatedDirective} ${e.blockedURI} (${e.sourceFile}:${e.lineNumber})`);
    });
  });
  const violations: string[] = [];
  for (const path of ["/", "/sign-in", "/sign-up", "/privacy"]) {
    const res = await page.goto(path);
    expect(res?.headers()["content-security-policy"] ?? "").toContain("'strict-dynamic'");
    await page.waitForLoadState("networkidle");
    violations.push(...(await page.evaluate(() => (window as unknown as { cspViolations: string[] }).cspViolations)));
  }
  const title = page.locator('a[href^="/titles/"]:not([href="/titles/new"])').first();
  await page.goto("/");
  if (await title.count()) {
    await title.click();
    await page.waitForLoadState("networkidle");
    violations.push(...(await page.evaluate(() => (window as unknown as { cspViolations: string[] }).cspViolations)));
  }
  expect(violations).toEqual([]);
});
