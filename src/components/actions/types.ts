export type ActionMode = "MOVE" | "DUMP" | "CHECKIN";

export const ACTION_MODE_LABELS: Record<ActionMode, { title: string; description: string }> = {
  MOVE: {
    title: "Move batch",
    description: "Update the destination and optionally move a partial quantity.",
  },
  DUMP: {
    title: "Log dump / loss",
    description: "Write off units with a reason and optional quantity.",
  },
  CHECKIN: {
    title: "Grower check-in",
    description: "Capture notes, status changes, and photos.",
  },
};

export function getActionLabel(mode: ActionMode) {
  switch (mode) {
    case "MOVE":
      return "Move batch";
    case "DUMP":
      return "Log dump";
    case "CHECKIN":
      return "Check-in note";
    default:
      return "Action";
  }
}





