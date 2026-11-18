import { describe, expect, it } from "vitest";
import { ACTIONS_FOR, MOD_ACTION_LABELS, REASONS_FOR, REPORT_REASON_LABELS, moderationErrorMessage } from "@/lib/services/moderation";
import { ModActionInput, ReportInput } from "@/lib/validation/moderation";

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
