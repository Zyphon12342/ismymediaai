import { describe, expect, it } from "vitest";
import { avatarExtension, avatarObjectPath, centreSquare } from "@/lib/services/image";
import { KIND_LABELS, VOTE_LABELS, profilePath, titlePath } from "@/lib/services/labels";
import { ProfileUpdate, SignInInput, SignUpInput, chosenHandle, displayName, isReservedHandle } from "@/lib/validation/profile";

const uid = "0b6e8d8e-3c5a-4f7e-9a51-1f2e3d4c5b6a";

describe("usernames", () => {
  it("rejects reserved and placeholder-shaped names", () => {
    expect(isReservedHandle("admin")).toBe(true);
    expect(isReservedHandle("user_0123456789ab")).toBe(true);
    expect(isReservedHandle("user_bob")).toBe(false);
    expect(chosenHandle.safeParse("Settings").success).toBe(false);
    expect(chosenHandle.parse("Film_Fan")).toBe("film_fan");
  });
});

describe("display names", () => {
  it("trims and limits", () => {
    expect(displayName.parse("  Ada  ")).toBe("Ada");
    expect(displayName.safeParse("").success).toBe(false);
    expect(displayName.safeParse("x".repeat(51)).success).toBe(false);
    expect(displayName.safeParse("bad\u0007name").success).toBe(false);
  });
});

describe("SignUpInput / SignInInput", () => {
  it("validates sign-up", () => {
    expect(SignUpInput.safeParse({ email: "a@b.co", password: "0123456789", handle: "ada" }).success).toBe(true);
    expect(SignUpInput.safeParse({ email: "a@b.co", password: "short", handle: "ada" }).success).toBe(false);
    expect(SignUpInput.safeParse({ email: "nope", password: "0123456789", handle: "ada" }).success).toBe(false);
    expect(SignUpInput.safeParse({ email: "a@b.co", password: "0123456789", handle: "ada", role: "admin" }).success).toBe(false);
  });
  it("validates sign-in", () => {
    expect(SignInInput.safeParse({ email: "a@b.co", password: "x" }).success).toBe(true);
    expect(SignInInput.safeParse({ email: "a@b.co", password: "" }).success).toBe(false);
  });
});

describe("ProfileUpdate", () => {
  it("accepts partial updates", () => {
    expect(ProfileUpdate.parse({ showVotes: true })).toEqual({ showVotes: true });
    expect(ProfileUpdate.parse({ displayName: null })).toEqual({ displayName: null });
    expect(ProfileUpdate.parse({ avatarPath: `${uid}/abc.webp` })).toEqual({ avatarPath: `${uid}/abc.webp` });
  });
  it("rejects empty, unknown and unsafe input", () => {
    expect(ProfileUpdate.safeParse({}).success).toBe(false);
    expect(ProfileUpdate.safeParse({ role: "admin" }).success).toBe(false);
    expect(ProfileUpdate.safeParse({ avatarPath: "../etc/passwd" }).success).toBe(false);
    expect(ProfileUpdate.safeParse({ avatarPath: `${uid}/a.svg` }).success).toBe(false);
    expect(ProfileUpdate.safeParse({ handle: "admin" }).success).toBe(false);
  });
});

describe("avatar images", () => {
  it("crops the centre square", () => {
    expect(centreSquare(400, 300)).toEqual({ sx: 50, sy: 0, size: 300 });
    expect(centreSquare(300, 401)).toEqual({ sx: 0, sy: 50, size: 300 });
  });
  it("maps types and builds paths", () => {
    expect(avatarExtension("image/webp")).toBe("webp");
    expect(avatarExtension("image/png")).toBe("png");
    expect(avatarExtension("image/jpeg")).toBe("jpg");
    expect(avatarExtension("image/gif")).toBeNull();
    expect(avatarObjectPath(uid, "webp", "a-b_c/../d")).toBe(`${uid}/a-b_cd.webp`);
  });
});

describe("labels", () => {
  it("has labels and paths", () => {
    expect(VOTE_LABELS.uses_ai).toBe("Uses gen AI");
    expect(KIND_LABELS.tv_show).toBe("TV show");
    expect(titlePath("dune-2021")).toBe("/titles/dune-2021");
    expect(profilePath("ada")).toBe("/u/ada");
  });
});
