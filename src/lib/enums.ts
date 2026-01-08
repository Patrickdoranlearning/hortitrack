export const PRODUCTION_PHASE = ["propagation","plug","potting"] as const;
export const PRODUCTION_STATUS = [
  "Propagation",
  "Plugs/Liners",
  "Potted",
  "Ready for Sale",
  "Looking Good",
  "Archived",
  "Incoming",
  "Planned",
] as const;
// keep in sync with DB enums. :contentReference[oaicite:5]{index=5}
