import { describe, expect, it } from "vitest";
import { ACTIONS_FOR, MOD_ACTION_LABELS, REASONS_FOR, REPORT_REASON_LABELS, moderationErrorMessage, slugFromTitleRef } from "@/lib/services/moderation";
import { MergeInput, ModActionInput, ReportInput } from "@/lib/validation/moderation";

const id = "0b7b7c3e-1111-4a2b-9c3d-1234567890ab";

describe("report validation", () => {
  it("accepts a report and turns an empty note into null", () => {
    expect(ReportInput.parse({ targetType: "comment", targetId: id, reason: "spam", note: "  " }).note).toBeNull();
  });
  it("rejects unknown reasons, bad ids, long notes and unknown fields", () => {
    expect(ReportInput.safeParse({ targetType: "comment", targetId: id, reason: "boring" }).success).toBe(false);
    expect(ReportInput.safeParse({ targetType: "comment", targetId: "x", reason: "spam" }).success).toBe(false);
    expect(ReportInput.safeParse({ targetType: "comment", targetId: id, reason: "spam", note: "x".repeat(1001) }).success).toBe(false);
    expect(ReportInput.safeParse({ targetType: "comment", targetId: id, reason: "spam", status: "actioned" }).success).toBe(false);
  });
});

describe("moderator action validation", () => {
  it("accepts known actions with an optional value", () => {
    expect(ModActionInput.parse({ action: "ban", targetType: "profile", targetId: id, value: 7 }).value).toBe(7);
    expect(ModActionInput.parse({ action: "hide", targetType: "comment", targetId: id }).value).toBeUndefined();
  });
  it("rejects merge and edit, which have their own tools, and out-of-range values", () => {
    expect(ModActionInput.safeParse({ action: "merge", targetType: "media", targetId: id }).success).toBe(false);
    expect(ModActionInput.safeParse({ action: "ban", targetType: "profile", targetId: id, value: -1 }).success).toBe(false);
    expect(ModActionInput.safeParse({ action: "ban", targetType: "profile", targetId: id, value: 1.5 }).success).toBe(false);
  });
  it("needs a value for lock, trust and role changes", () => {
    for (const action of ["lock_comments", "set_trust", "set_role"]) {
      const targetType = action === "lock_comments" ? "media" : "profile";
      expect(ModActionInput.safeParse({ action, targetType, targetId: id }).success).toBe(false);
      expect(ModActionInput.safeParse({ action, targetType, targetId: id, value: null }).success).toBe(false);
      expect(ModActionInput.safeParse({ action, targetType, targetId: id, value: 1 }).success).toBe(true);
    }
  });
});

describe("moderation labels and errors", () => {
  it("labels every reason and action it offers", () => {
    for (const list of Object.values(REASONS_FOR)) for (const r of list) expect(REPORT_REASON_LABELS[r]).toBeTruthy();
    for (const list of Object.values(ACTIONS_FOR)) for (const a of list) expect(MOD_ACTION_LABELS[a]).toBeTruthy();
  });
  it("explains database errors", () => {
    expect(moderationErrorMessage("23505", "")).toMatch(/already reported/);
    expect(moderationErrorMessage("RL429", "")).toMatch(/Too many/);
    expect(moderationErrorMessage("P0002", "nothing to report")).toMatch(/no longer/);
    expect(moderationErrorMessage("42501", "only admins can change roles")).toMatch(/Only admins/);
    expect(moderationErrorMessage("42501", "you cannot moderate yourself")).toMatch(/your own/);
    expect(moderationErrorMessage("22023", "x")).toMatch(/doesn't fit/);
    expect(moderationErrorMessage("42501", "moderators only")).toBe("Moderators only.");
    expect(moderationErrorMessage("XX000", "")).toBeNull();
  });
});

describe("merging duplicates", () => {
  it("reads the title to keep from a slug, a path or a full link", () => {
    expect(slugFromTitleRef("dune-2021")).toBe("dune-2021");
    expect(slugFromTitleRef(" /titles/dune-2021/ ")).toBe("dune-2021");
    expect(slugFromTitleRef("https://ismymediaai.com/titles/Dune-2021?x=1#comments")).toBe("dune-2021");
  });

  it("rejects anything that is not a title", () => {
    expect(slugFromTitleRef("")).toBeNull();
    expect(slugFromTitleRef("https://ismymediaai.com/users/someone")).toBeNull();
    expect(slugFromTitleRef("not a slug")).toBeNull();
    expect(slugFromTitleRef("javascript:alert(1)")).toBeNull();
  });

  it("validates the merge request", () => {
    expect(MergeInput.safeParse({ fromId: "00000000-0000-4000-8000-000000000000", into: "dune-2021" }).success).toBe(true);
    expect(MergeInput.safeParse({ fromId: "nope", into: "dune-2021" }).success).toBe(false);
    expect(MergeInput.safeParse({ fromId: "00000000-0000-4000-8000-000000000000", into: " " }).success).toBe(false);
  });

  it("explains merge errors", () => {
    expect(moderationErrorMessage("22023", "both titles must be the same kind")).toMatch(/same kind/);
    expect(moderationErrorMessage("22023", "that title was already merged")).toBe("That title was already merged.");
  });
});
