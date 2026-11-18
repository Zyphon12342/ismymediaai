import { describe, expect, it } from "vitest";
import {
  canEditComment,
  commentAnchor,
  commentErrorMessage,
  commentPermalink,
  linkify,
  needsCommentTurnstile,
  toCommentRow,
} from "@/lib/services/comments";
import { CommentInput, CommentListQuery, CommentUpdate } from "@/lib/validation/comment";

describe("linkify", () => {
  it("keeps plain text as one part", () => {
    expect(linkify("no links here\nat all")).toEqual([{ type: "text", value: "no links here\nat all" }]);
  });
  it("detects links and strips trailing punctuation", () => {
    expect(linkify("See https://example.com/a?b=1. Thanks")).toEqual([
      { type: "text", value: "See " },
      { type: "link", value: "https://example.com/a?b=1", href: "https://example.com/a?b=1" },
      { type: "text", value: ". Thanks" },
    ]);
  });
  it("handles links in brackets", () => {
    const parts = linkify("(https://example.com/x)");
    expect(parts).toEqual([
      { type: "text", value: "(" },
      { type: "link", value: "https://example.com/x", href: "https://example.com/x" },
      { type: "text", value: ")" },
    ]);
  });
  it("never links other schemes or junk", () => {
    for (const t of ["javascript:alert(1)", "data:text/html,hi", "https://", "http://nodot", "<b>https</b>"]) {
      expect(linkify(t).every((p) => p.type === "text")).toBe(true);
    }
  });
  it("leaves HTML as text", () => {
    expect(linkify('<img src=x onerror="alert(1)">')).toEqual([{ type: "text", value: '<img src=x onerror="alert(1)">' }]);
  });
  it("stays fast on long input", () => {
    const t = `${"a.".repeat(5000)} https://x.test/${")".repeat(5000)}`;
    const start = performance.now();
    linkify(t);
    expect(performance.now() - start).toBeLessThan(200);
  });
});

describe("comment rules", () => {
  it("allows edits for 15 minutes", () => {
    const created = new Date("2026-01-01T00:00:00Z");
    expect(canEditComment(created, new Date("2026-01-01T00:14:59Z"))).toBe(true);
    expect(canEditComment(created, new Date("2026-01-01T00:15:01Z"))).toBe(false);
  });
  it("asks for Turnstile on the first 3 comments", () => {
    expect(needsCommentTurnstile(0)).toBe(true);
    expect(needsCommentTurnstile(2)).toBe(true);
    expect(needsCommentTurnstile(3)).toBe(false);
  });
  it("builds anchors and permalinks", () => {
    expect(commentAnchor("abc")).toBe("comment-abc");
    expect(commentPermalink("die-hard-1988", "abc")).toBe("/titles/die-hard-1988#comment-abc");
  });
  it("maps rows", () => {
    expect(toCommentRow({ body: "x", evidenceUrl: null, aiAreas: ["music"] })).toEqual({
      body: "x",
      evidence_url: null,
      ai_areas: ["music"],
    });
    expect(toCommentRow({ body: "y" })).toEqual({ body: "y" });
  });
  it("explains database errors", () => {
    expect(commentErrorMessage("RL429", "")).toMatch(/hour/);
    expect(commentErrorMessage("23514", "comment contains a blocked word")).toMatch(/word/);
    expect(commentErrorMessage("23514", "evidence link domain is blocked")).toMatch(/site/);
    expect(commentErrorMessage("23514", "comments can only be edited for 15 minutes")).toMatch(/15 minutes/);
    expect(commentErrorMessage("23514", "replies can only be one level deep")).toMatch(/top-level/);
    expect(commentErrorMessage("23514", "reply must be on the same title")).toMatch(/another title/);
    expect(commentErrorMessage("42501", "comments are locked on this title")).toMatch(/locked/);
    expect(commentErrorMessage("42501", "new row violates row-level security")).toMatch(/can't comment/);
    expect(commentErrorMessage("23505", "dup")).toBeNull();
  });
});

describe("comment validation", () => {
  it("trims and normalises line endings", () => {
    const r = CommentInput.parse({ body: "  hi\r\nthere  " });
    expect(r.body).toBe("hi\nthere");
  });
  it("rejects empty, long and control-character bodies", () => {
    expect(CommentInput.safeParse({ body: "   " }).success).toBe(false);
    expect(CommentInput.safeParse({ body: "x".repeat(2001) }).success).toBe(false);
    expect(CommentInput.safeParse({ body: "bad\u0007" }).success).toBe(false);
  });
  it("normalises evidence links and treats an empty one as none", () => {
    expect(CommentInput.parse({ body: "x", evidenceUrl: "https://Example.COM/a#frag" }).evidenceUrl).toBe("https://example.com/a");
    expect(CommentInput.parse({ body: "x", evidenceUrl: "" }).evidenceUrl).toBeNull();
    expect(CommentInput.safeParse({ body: "x", evidenceUrl: "http://example.com" }).success).toBe(false);
    expect(CommentInput.safeParse({ body: "x", evidenceUrl: "javascript:alert(1)" }).success).toBe(false);
  });
  it("dedupes AI areas and rejects unknown ones and unknown fields", () => {
    expect(CommentInput.parse({ body: "x", aiAreas: ["music", "music"] }).aiAreas).toEqual(["music"]);
    expect(CommentInput.safeParse({ body: "x", aiAreas: ["smell"] }).success).toBe(false);
    expect(CommentInput.safeParse({ body: "x", userId: "someone" }).success).toBe(false);
  });
  it("needs something to update", () => {
    expect(CommentUpdate.safeParse({}).success).toBe(false);
    expect(CommentUpdate.safeParse({ body: "new" }).success).toBe(true);
  });
  it("falls back to evidence-first for an unknown sort", () => {
    expect(CommentListQuery.parse({ sort: "weird" }).sort).toBe("evidence");
    expect(CommentListQuery.parse({}).limit).toBe(20);
  });
});
