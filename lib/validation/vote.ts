import { z } from "zod";
import { voteValue } from "./common";

export const VoteInput = z.strictObject({ value: voteValue });
export type VoteInput = z.infer<typeof VoteInput>;
