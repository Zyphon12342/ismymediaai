import { describe, expect, it } from "vitest";
import { anon, publishedTitle, signedInUser } from "./env";

// Exercises the vote rules through the real Data API (PostgREST + RLS),
// the same path the app's service functions use.
describe("votes through the Data API", () => {
  it("keeps one vote per user, updates the tally, and keeps votes private", async () => {
    const mediaId = await publishedTitle(`it-film-${crypto.randomUUID().slice(0, 8)}`);
    const alice = await signedInUser("alice", 1);
    const bob = await signedInUser("bob", 1);

    expect((await alice.client.from("votes").insert({ media_id: mediaId, value: "uses_ai" })).error).toBeNull();
    const dup = await alice.client.from("votes").insert({ media_id: mediaId, value: "no_ai" });
    expect(dup.error?.code).toBe("23505");

    expect((await bob.client.from("votes").insert({ media_id: mediaId, value: "no_ai" })).error).toBeNull();
    expect((await alice.client.from("votes").update({ value: "no_ai" }).eq("media_id", mediaId)).error).toBeNull();

    const { data: tally } = await anon()
      .from("vote_tallies")
      .select("uses_ai, no_ai, unsure, counted_total")
      .eq("media_id", mediaId)
      .single();
    expect(tally).toEqual({ uses_ai: 0, no_ai: 2, unsure: 0, counted_total: 2 });

    const { data: seenByBob } = await bob.client.from("votes").select("user_id").eq("media_id", mediaId);
    expect(seenByBob).toEqual([{ user_id: bob.id }]);
  });

  it("cannot vote on someone else's behalf", async () => {
    const mediaId = await publishedTitle(`it-film-${crypto.randomUUID().slice(0, 8)}`);
    const alice = await signedInUser("alice", 1);
    const bob = await signedInUser("bob", 1);
    const res = await alice.client.from("votes").insert({ media_id: mediaId, value: "uses_ai", user_id: bob.id });
    expect(res.error).not.toBeNull();
  });

  it("anonymous visitors cannot vote", async () => {
    const mediaId = await publishedTitle(`it-film-${crypto.randomUUID().slice(0, 8)}`);
    const res = await anon().from("votes").insert({ media_id: mediaId, value: "uses_ai" });
    expect(res.error).not.toBeNull();
  });
});
