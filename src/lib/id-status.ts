/**
 * The four states of a sighting's name, and the one rule for which state a naming leads to.
 *   needs_id        no name yet
 *   suggested       "Named": named but not sure; waits for a researcher
 *   self_confirmed  "Self-confirmed": the owner is sure
 *   verified        "Verified": checked by a researcher or the admin
 * The database enforces that only researchers/admins can verify (migration 0011).
 */
export const ID_STATUSES = ["needs_id", "suggested", "self_confirmed", "verified"] as const;
export type IdStatus = (typeof ID_STATUSES)[number];

export const STATUS_LABEL: Record<IdStatus, string> = {
  needs_id: "Needs ID",
  suggested: "Named",
  self_confirmed: "Self-confirmed",
  verified: "Verified",
};

export const STATUS_HINT: Record<IdStatus, string> = {
  needs_id: "No name yet",
  suggested: "Named, but not sure yet: waiting for a researcher to check",
  self_confirmed: "Named by someone who is sure of it",
  verified: "Checked by a researcher",
};

/** True for researchers and admins: they can verify and review anyone's sighting. */
export const isReviewerRole = (role: string) => role === "researcher" || role === "admin";

/**
 * The state after the owner names (or re-saves) their own sighting.
 * - no name -> Needs ID; "Not sure" -> Named
 * - "I'm sure" -> Self-confirmed, or Verified straight away for a researcher/admin
 * - an already Verified sighting stays Verified if the name didn't change and they're still sure
 */
export function statusAfterNaming(o: {
  named: boolean;
  sure: boolean;
  reviewer: boolean;
  current?: IdStatus | null;
  speciesChanged: boolean;
}): IdStatus {
  if (!o.named) return "needs_id";
  if (!o.sure) return "suggested";
  if (o.current === "verified" && !o.speciesChanged) return "verified";
  return o.reviewer ? "verified" : "self_confirmed";
}
