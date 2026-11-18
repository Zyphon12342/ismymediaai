import { describe, expect, it } from "vitest";
import { afterCursorFilter, decodeCursor, encodeCursor } from "@/lib/services/cursor";

const c = { at: "2026-11-18T01:02:03.456789+00:00", id: "0b6e8d8e-3c5a-4f7e-9a51-1f2e3d4c5b6a" };

describe("cursors", () => {
  it("round-trips", () => {
    expect(decodeCursor(encodeCursor(c))).toEqual(c);
  });

  it.each([null, "", "!!!", btoa("x|y"), btoa(`${c.at}|${c.id}|extra`), btoa(`${c.at}),or(x|${c.id}`), "a".repeat(201)])(
    "rejects %s",
    (token) => {
      expect(decodeCursor(token)).toBeNull();
    },
  );

  it("builds a keyset filter", () => {
    expect(afterCursorFilter(c, "created_at", "id")).toBe(
      `created_at.lt."${c.at}",and(created_at.eq."${c.at}",id.lt.${c.id})`,
    );
  });
});
