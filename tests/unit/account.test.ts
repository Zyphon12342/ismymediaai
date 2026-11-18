import { describe, expect, it } from "vitest";
import {
  authErrorMessage,
  avatarUrl,
  formatDate,
  handleChangeStatus,
  initials,
  memberSince,
  ownsAvatarPath,
  profileErrorMessage,
  safeNextPath,
  toProfileRow,
} from "@/lib/services/account";

const DAY = 86_400_000;

describe("handleChangeStatus", () => {
  const now = new Date("2026-11-18T00:00:00Z");
  it("allows a first change", () => {
    expect(handleChangeStatus(null, now)).toEqual({ allowed: true });
  });
  it("blocks for 30 days and says when", () => {
    const changed = new Date(now.getTime() - 10 * DAY);
    expect(handleChangeStatus(changed, now)).toEqual({ allowed: false, nextAt: new Date(changed.getTime() + 30 * DAY) });
  });
  it("allows again after 30 days", () => {
    expect(handleChangeStatus(new Date(now.getTime() - 30 * DAY), now)).toEqual({ allowed: true });
  });
});

describe("safeNextPath", () => {
  it.each([
    ["/u/alice", "/u/alice"],
    ["/settings/profile?welcome=1", "/settings/profile?welcome=1"],
    ["/titles/x#comments", "/titles/x#comments"],
  ])("keeps same-site path %s", (input, out) => {
    expect(safeNextPath(input)).toBe(out);
  });

  it.each([
    "https://evil.example/",
    "//evil.example/x",
    "/\\evil.example",
    "javascript:alert(1)",
    "evil",
    "/sign-in",
    "/auth/callback?code=1",
    "/a\nb",
    `/${"a".repeat(600)}`,
    "",
  ])("falls back for %s", (input) => {
    expect(safeNextPath(input, "/home")).toBe("/home");
  });

  it("falls back for null", () => {
    expect(safeNextPath(null)).toBe("/");
  });
});

describe("avatars and names", () => {
  it("builds public avatar URLs", () => {
    expect(avatarUrl("http://127.0.0.1:54321/", "u1/a b.webp")).toBe(
      "http://127.0.0.1:54321/storage/v1/object/public/avatars/u1/a%20b.webp",
    );
    expect(avatarUrl("https://x.supabase.co", null)).toBeNull();
  });

  it("checks avatar folders", () => {
    expect(ownsAvatarPath("abc", "abc/x.webp")).toBe(true);
    expect(ownsAvatarPath("abc", "abd/x.webp")).toBe(false);
    expect(ownsAvatarPath("abc", "abc/sub/x.webp")).toBe(false);
  });

  it("makes initials", () => {
    expect(initials("Ada Lovelace", "ada")).toBe("AL");
    expect(initials(null, "film_fan")).toBe("FF");
    expect(initials("  ", "zed")).toBe("ZE");
    expect(initials("Prince", "p")).toBe("PR");
  });

  it("formats dates in UTC", () => {
    expect(memberSince(new Date("2026-11-30T23:30:00Z"))).toBe("November 2026");
    expect(formatDate(new Date("2026-12-18T10:00:00Z"))).toBe("December 18, 2026");
  });
});

describe("toProfileRow", () => {
  it("maps only the fields sent", () => {
    expect(toProfileRow({ showVotes: true })).toEqual({ show_votes: true });
    expect(toProfileRow({ handle: "a_b", displayName: null, avatarPath: null })).toEqual({
      handle: "a_b",
      display_name: null,
      avatar_path: null,
    });
  });
});

describe("error messages", () => {
  it("maps profile rule violations", () => {
    expect(profileErrorMessage("23505", "dup")).toBe("That username is taken.");
    expect(profileErrorMessage("RL429", "x")).toMatch(/Too many/);
    expect(profileErrorMessage("23514", "handle can be changed once every 30 days")).toMatch(/30 days/);
    expect(profileErrorMessage("23514", "that username is reserved")).toMatch(/reserved/);
    expect(profileErrorMessage("23514", "avatar must be in your own folder")).toMatch(/avatar/);
    expect(profileErrorMessage("23514", "display name has control characters")).toMatch(/display name/);
    expect(profileErrorMessage("23514", "other")).toBeNull();
    expect(profileErrorMessage("23514", undefined)).toBeNull();
    expect(profileErrorMessage("42501", "x")).toBeNull();
  });

  it.each([
    [{ code: "invalid_credentials" }, /do not match/],
    [{ message: "Invalid login credentials" }, /do not match/],
    [{ code: "email_not_confirmed" }, /Verify your email/],
    [{ code: "weak_password" }, /stronger password/],
    [{ code: "user_already_exists" }, /already exists/],
    [{ code: "captcha_failed" }, /bot check/],
    [{ status: 429 }, /Too many attempts/],
    [{ code: "same_password" }, /different/],
    [{ code: "otp_expired" }, /expired/],
    [{ code: "something_else" }, /Something went wrong/],
  ])("maps auth error %o", (err, re) => {
    expect(authErrorMessage(err)).toMatch(re);
  });

  it("handles a missing error", () => {
    expect(authErrorMessage(null)).toMatch(/Something went wrong/);
  });
});
