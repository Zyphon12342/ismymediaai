import { getModQueue } from "@/lib/data/moderation";
import { withHandler } from "@/lib/http/handler";

/** Open reports and pending entries. */
export const GET = withHandler({ auth: "moderator" }, async ({ db }) => getModQueue(db));
