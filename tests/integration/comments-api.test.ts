import { describe, expect, it } from "vitest";
import { APP_URL, admin, appSessionCookie, namedUser, publishedTitle } from "./env";

const send = (cookie: string | null, path: string, method: string, body?: unknown, origin = APP_URL) =>
  fetch(`${APP_URL}${path}`, {
    method,
    headers: { "Content-Type": "application/json", Origin: origin, ...(cookie ? { Cookie: cookie } : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

type ListBody = {
  items: { id: string; body: string; evidenceUrl: string | null; deleted: boolean; author: { handle: string } | null; replies: { id: string; body: string }[] }[];
  total: number;
  nextCursor: string | null;
};

const list = async (id: string, query = "") =>
  (await (await fetch(`${APP_URL}/api/media/${id}/comments${query}`)).json()) as ListBody;

describe("comments API", () => {
  it("posts, replies, lists evidence first, edits and deletes", async () => {
    const id = await publishedTitle(`it-cmt-${crypto.randomUUID().slice(0, 8)}`);
    const u = await namedUser("cmt");
    const plain = await send(u.cookie, `/api/media/${id}/comments`, "POST", { body: "No evidence, just a hunch." });
    expect(plain.status).toBe(201);
    const withLink = await send(u.cookie, `/api/media/${id}/comments`, "POST", {
      body: "The credits name an AI studio.",
      evidenceUrl: "https://News.Example/credits#top",
      aiAreas: ["visuals"],
    });
    expect(withLink.status).toBe(201);
    const { id: evidenceId } = (await withLink.json()) as { id: string };

    let page = await list(id);
    expect(page.total).toBe(2);
    expect(page.items[0]!.id).toBe(evidenceId);
    expect(page.items[0]!.evidenceUrl).toBe("https://news.example/credits");
    expect(page.items[0]!.author?.handle).toBe(u.handle);
    expect((await list(id, "?sort=newest")).items[0]!.id).toBe(evidenceId);

    const reply = await send(u.cookie, `/api/media/${id}/comments`, "POST", { body: "Which studio?", parentId: evidenceId });
    expect(reply.status).toBe(201);
    const { id: replyId } = (await reply.json()) as { id: string };
    const nested = await send(u.cookie, `/api/media/${id}/comments`, "POST", { body: "Deeper", parentId: replyId });
    expect(nested.status).toBe(422);

    expect((await send(u.cookie, `/api/comments/${evidenceId}`, "PATCH", { body: "The end credits name an AI studio." })).status).toBe(200);
    page = await list(id);
    expect(page.items[0]!.body).toBe("The end credits name an AI studio.");
    expect(page.items[0]!.replies.map((r) => r.id)).toEqual([replyId]);

    // Deleting a comment with replies keeps its place; deleting one without hides it.
    expect((await send(u.cookie, `/api/comments/${evidenceId}`, "DELETE")).status).toBe(204);
    page = await list(id);
    const kept = page.items.find((c) => c.id === evidenceId)!;
    expect(kept.deleted).toBe(true);
    expect(kept.body).toBe("");
    expect((await send(u.cookie, `/api/comments/${evidenceId}`, "PATCH", { body: "back" })).status).toBe(404);
  });

  it("only lets the author edit, and moderators delete", async () => {
    const id = await publishedTitle(`it-cmt-${crypto.randomUUID().slice(0, 8)}`);
    const author = await namedUser("cauth");
    const other = await namedUser("cother");
    const m = await namedUser("cmod");
    await admin().from("profiles").update({ role: "moderator" }).eq("id", m.id);
    const mod = { ...m, cookie: await appSessionCookie(m.email, m.password, { mfa: true }) };
    const { id: cid } = (await (await send(author.cookie, `/api/media/${id}/comments`, "POST", { body: "Mine" })).json()) as { id: string };
    expect((await send(other.cookie, `/api/comments/${cid}`, "PATCH", { body: "Hijack" })).status).toBe(404);
    expect((await send(other.cookie, `/api/comments/${cid}`, "DELETE")).status).toBe(404);
    expect((await send(mod.cookie, `/api/comments/${cid}`, "DELETE")).status).toBe(204);
  });

  it("rejects bad input, signed-out callers, locked titles and cross-site requests", async () => {
    const id = await publishedTitle(`it-cmt-${crypto.randomUUID().slice(0, 8)}`);
    const u = await namedUser("cbad");
    expect((await send(null, `/api/media/${id}/comments`, "POST", { body: "hi" })).status).toBe(401);
    expect((await send(u.cookie, `/api/media/${id}/comments`, "POST", { body: "" })).status).toBe(422);
    expect((await send(u.cookie, `/api/media/${id}/comments`, "POST", { body: "hi", evidenceUrl: "javascript:alert(1)" })).status).toBe(422);
    expect((await send(u.cookie, `/api/media/${id}/comments`, "POST", { body: "hi", userId: u.id })).status).toBe(422);
    expect((await send(u.cookie, `/api/media/${id}/comments`, "POST", { body: "hi" }, "https://evil.example")).status).toBe(403);
    expect((await send(u.cookie, `/api/media/not-a-uuid/comments`, "POST", { body: "hi" })).status).toBe(404);
    await admin().from("media").update({ comments_locked: true }).eq("id", id);
    expect((await send(u.cookie, `/api/media/${id}/comments`, "POST", { body: "hi" })).status).toBe(403);
  });
});
