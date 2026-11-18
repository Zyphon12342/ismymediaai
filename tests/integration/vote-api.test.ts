import { describe, expect, it } from "vitest";
import { APP_URL, anon, namedUser, publishedTitle } from "./env";

const vote = (cookie: string | null, id: string, method: "PUT" | "DELETE", value?: string) =>
  fetch(`${APP_URL}/api/media/${id}/vote`, {
    method,
    headers: { "Content-Type": "application/json", Origin: APP_URL, ...(cookie ? { Cookie: cookie } : {}) },
    ...(value ? { body: JSON.stringify({ value }) } : {}),
  });

const tally = async (id: string) =>
  (await anon().from("vote_tallies").select("uses_ai, no_ai, unsure").eq("media_id", id).single()).data;

describe("PUT/DELETE /api/media/{id}/vote", () => {
  it("sets, changes and withdraws a vote, and the tally follows", async () => {
    const id = await publishedTitle(`it-vote-${crypto.randomUUID().slice(0, 8)}`);
    const u = await namedUser("vapi");
    expect((await vote(u.cookie, id, "PUT", "uses_ai")).status).toBe(200);
    expect(await tally(id)).toEqual({ uses_ai: 1, no_ai: 0, unsure: 0 });
    expect((await vote(u.cookie, id, "PUT", "unsure")).status).toBe(200);
    expect(await tally(id)).toEqual({ uses_ai: 0, no_ai: 0, unsure: 1 });
    expect((await vote(u.cookie, id, "DELETE")).status).toBe(204);
    expect(await tally(id)).toEqual({ uses_ai: 0, no_ai: 0, unsure: 0 });
  });

  it("saves but does not count votes from trust level 0", async () => {
    const id = await publishedTitle(`it-vote-${crypto.randomUUID().slice(0, 8)}`);
    const u = await namedUser("vnew", 0);
    const res = await vote(u.cookie, id, "PUT", "no_ai");
    expect(res.status).toBe(200);
    expect(((await res.json()) as { counted: boolean }).counted).toBe(false);
    expect(await tally(id)).toEqual({ uses_ai: 0, no_ai: 0, unsure: 0 });
  });

  it("rejects bad input, strangers and cross-site requests", async () => {
    const id = await publishedTitle(`it-vote-${crypto.randomUUID().slice(0, 8)}`);
    const u = await namedUser("vbad");
    expect((await vote(null, id, "PUT", "uses_ai")).status).toBe(401);
    expect((await vote(u.cookie, id, "PUT", "maybe")).status).toBe(422);
    expect((await vote(u.cookie, "not-a-uuid", "PUT", "uses_ai")).status).toBe(404);
    expect((await vote(u.cookie, crypto.randomUUID(), "PUT", "uses_ai")).status).toBe(403);
    const cross = await fetch(`${APP_URL}/api/media/${id}/vote`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Origin: "https://evil.example", Cookie: u.cookie },
      body: JSON.stringify({ value: "uses_ai" }),
    });
    expect(cross.status).toBe(403);
  });
});
