/** Labels for correction requests, shared by the form, the queue and tests. */
import type { RELATIONSHIPS } from "@/lib/validation/corrections";

export const RELATIONSHIP_LABELS: Record<(typeof RELATIONSHIPS)[number], string> = {
  rights_holder: "I hold the rights (studio, publisher, distributor)",
  creator: "I made or worked on it",
  representative: "I represent the rights holder or a creator",
  other: "Something else",
};

export const CORRECTION_POLICY_PATH = "/corrections";

export function correctionPath(slug: string): string {
  return `/titles/${slug}/correction`;
}
