export function aggregateReviewLabel(states?: string[]): string {
  if (!states) return "Report review status unavailable";
  if (!states.length) return "No individual report review recorded";
  const decisions = [...new Set(states.map((state) => state || "submitted"))];
  if (decisions.includes("submitted"))
    return `Community report — not yet reviewed${decisions.length > 1 ? " · mixed review decisions" : ""}`;
  if (decisions.length > 1)
    return "Mixed report review decisions · see the source record";
  const labels: Record<string, string> = {
    accepted_for_investigation: "Report accepted for investigation",
    needs_information: "Report needs information",
    duplicate: "Report reviewed as duplicate",
    rejected: "Report rejected · see recorded reason",
  };
  return labels[decisions[0]] || "Report review status unavailable";
}
