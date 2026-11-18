/** Light/dark theme choice. Pure functions only, shared by server and browser. */

export const THEME_COOKIE = "mm_theme";
export const THEME_MAX_AGE = 60 * 60 * 24 * 365;

/** "system" follows the device's light/dark setting and stores no cookie. */
export type ThemeChoice = "system" | "light" | "dark";
export const THEME_CHOICES: readonly ThemeChoice[] = ["system", "light", "dark"];

export function parseTheme(value: string | null | undefined): ThemeChoice {
  return value === "light" || value === "dark" ? value : "system";
}

/** The Set-Cookie value the toggle writes with document.cookie. "system" clears it. */
export function themeCookie(choice: ThemeChoice, secure: boolean): string {
  const tail = `; Path=/; SameSite=Lax${secure ? "; Secure" : ""}`;
  return choice === "system" ? `${THEME_COOKIE}=${tail}; Max-Age=0` : `${THEME_COOKIE}=${choice}${tail}; Max-Age=${THEME_MAX_AGE}`;
}
