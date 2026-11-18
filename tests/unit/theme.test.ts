import { describe, expect, it } from "vitest";
import { parseTheme, themeCookie } from "@/lib/theme";

describe("theme choice", () => {
  it("accepts light and dark, and treats anything else as follow-the-device", () => {
    expect(parseTheme("light")).toBe("light");
    expect(parseTheme("dark")).toBe("dark");
    for (const v of [undefined, null, "", "system", "DARK", "blue"]) expect(parseTheme(v)).toBe("system");
  });
  it("stores a year-long cookie for light and dark, and clears it for system", () => {
    expect(themeCookie("dark", true)).toBe("mm_theme=dark; Path=/; SameSite=Lax; Secure; Max-Age=31536000");
    expect(themeCookie("light", false)).toBe("mm_theme=light; Path=/; SameSite=Lax; Max-Age=31536000");
    expect(themeCookie("system", true)).toBe("mm_theme=; Path=/; SameSite=Lax; Secure; Max-Age=0");
  });
});
