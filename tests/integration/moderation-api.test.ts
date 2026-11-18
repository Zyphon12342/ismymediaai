import { describe, expect, it } from "vitest";
import { APP_URL, admin, appSessionCookie, namedUser, publishedTitle } from "./env";

const send = (cookie: string | null, path: string, method: string, body?: unknown) =>
  fetch(`${APP_URL}${path}`, {
    method,
    headers: { "Content-Type": "application/json", Origin: APP_URL, ...(cookie ? { Cookie: cookie } : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

/** A moderator whose app session passed 2-step login (aal2). */
async function moderator(prefix: string) {
  const m = await namedUser(prefix);
  await admin().from("profiles").update({ role: "moderator" }).eq("id", m.id);
  return { ...m, cookie: await appSessionCookie(m.email, m.password, { mfa: true }) };
}

type Queue = { items: { targetType: string; targetId: string; reports: { reason: string }[] }[]; pending: { id: string }[] };

describe("reports and the moderator queue", () => {
  it("reports a comment once, shows it in the queue, and a moderator hides it", async () => {
    const id = await publishedTitle(`it-mod-${crypto.randomUUID().slice(0, 8)}`);
    const author = await namedUser("mauthor");
    const reporter = await namedUser("mreporter");
    const mod = await moderator("mmod");
    const { id: cid } = (await (await send(author.cookie, `/api/media/${id}/comments`, "POST", { body: "Buy cheap pills" })).json()) as { id: string };

    expect((await send(author.cookie, "/api/reports", "POST", { targetType: "comment", targetId: cid, reason: "spam" })).status).toBe(404);
    expect((await send(reporter.cookie, "/api/reports", "POST", { targetType: "comment", targetId: cid, reason: "spam", note: "Ad" })).status).toBe(201);
    expect((await send(reporter.cookie, "/api/reports", "POST", { targetType: "comment", targetId: cid, reason: "spam" })).status).toBe(409);

    expect((await send(reporter.cookie, "/api/mod/queue", "GET")).status).toBe(403);
    const queue = (await (await send(mod.cookie, "/api/mod/queue", "GET")).json()) as Queue;
    const item = queue.items.find((i) => i.targetId === cid);
    expect(item?.reports.map((r) => r.reason)).toEqual(["spam"]);

    expect((await send(reporter.cookie, "/api/mod/actions", "POST", { action: "hide", targetType: "comment", targetId: cid })).status).toBe(403);
    expect((await send(mod.cookie, "/api/mod/actions", "POST", { action: "hide", targetType: "comment", targetId: cid, reason: "Spam" })).status).toBe(201);
    const after = (await (await send(mod.cookie, "/api/mod/queue", "GET")).json()) as Queue;
    expect(after.items.find((i) => i.targetId === cid)).toBeUndefined();

    const list = (await (await fetch(`${APP_URL}/api/media/${id}/comments`)).json()) as { items: { id: string }[] };
    expect(list.items.map((c) => c.id)).not.toContain(cid);
    const log = await admin().from("mod_actions").select("action, actor_id, reason").eq("target_id", cid);
    expect(log.data).toEqual([{ action: "hide", actor_id: mod.id, reason: "Spam" }]);
  });

  it("bans a user so they can no longer write", async () => {
    const id = await publishedTitle(`it-mod-${crypto.randomUUID().slice(0, 8)}`);
    const u = await namedUser("mbanned");
    const mod = await moderator("mbanner");
    expect((await send(mod.cookie, "/api/mod/actions", "POST", { action: "ban", targetType: "profile", targetId: u.id, value: 1 })).status).toBe(201);
    expect((await send(u.cookie, `/api/media/${id}/comments`, "POST", { body: "hello" })).status).toBe(403);
    expect((await send(mod.cookie, "/api/mod/actions", "POST", { action: "ban", targetType: "profile", targetId: mod.id })).status).toBe(403);
  });

  it("validates input", async () => {
    const mod = await moderator("mval");
    expect((await send(mod.cookie, "/api/mod/actions", "POST", { action: "merge", targetType: "media", targetId: crypto.randomUUID() })).status).toBe(422);
    expect((await send(mod.cookie, "/api/mod/actions", "POST", { action: "hide", targetType: "media", targetId: crypto.randomUUID() })).status).toBe(404);
    expect((await send(mod.cookie, "/api/mod/actions", "POST", { action: "ban", targetType: "media", targetId: crypto.randomUUID() })).status).toBe(422);
    expect((await send(null, "/api/reports", "POST", { targetType: "media", targetId: crypto.randomUUID(), reason: "spam" })).status).toBe(401);
  });

  it("refuses moderators until their session passes 2-step login", async () => {
    const m = await namedUser("mnomfa");
    await admin().from("profiles").update({ role: "moderator" }).eq("id", m.id);
    const id = await publishedTitle(`it-mod-${crypto.randomUUID().slice(0, 8)}`);

    const refused = await send(m.cookie, "/api/mod/queue", "GET");
    expect(refused.status).toBe(403);
    expect(((await refused.json()) as { error: { details?: { mfa?: boolean } } }).error.details).toEqual({ mfa: true });
    expect((await send(m.cookie, "/api/mod/actions", "POST", { action: "lock_comments", targetType: "media", targetId: id, value: 1 })).status).toBe(403);

    // The moderator page sends them to set up 2-step login first.
    const page = await fetch(`${APP_URL}/mod`, { headers: { Cookie: m.cookie }, redirect: "manual" });
    expect(page.headers.get("location") ?? "").toContain("/settings/security?next=%2Fmod");

    const stepped = await appSessionCookie(m.email, m.password, { mfa: true });
    expect((await send(stepped, "/api/mod/queue", "GET")).status).toBe(200);
    expect((await send(stepped, "/api/mod/actions", "POST", { action: "lock_comments", targetType: "media", targetId: id })).status).toBe(422);
    expect((await send(stepped, "/api/mod/actions", "POST", { action: "lock_comments", targetType: "media", targetId: id, value: 1 })).status).toBe(201);

    // A new password-only session after that is asked for the code instead.
    const again = await appSessionCookie(m.email, m.password);
    const challenge = await fetch(`${APP_URL}/mod`, { headers: { Cookie: again }, redirect: "manual" });
    expect(challenge.headers.get("location") ?? "").toContain("/auth/mfa?next=%2Fmod");
  });
});
