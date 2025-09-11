
import { calculateLosses } from "./losses";

it("handles undefined safely", () => {
  const m = calculateLosses(undefined);
  expect(m.totalLost).toBe(0);
  expect(m.lossByFamily).toEqual([]);
});

it("coerces quantities and groups by family", () => {
  const m = calculateLosses([
    { family: "Aster", quantity: "2", happenedAt: "2025-08-01" },
    { family: "Aster", quantity: 3, createdAt: "2025-08-01" },
    { family: null, quantity: 1, timestamp: "2025-08-02" },
  ]);
  expect(m.totalLost).toBe(6);
  expect(m.lossByFamily.find(x => x.label === "Aster")?.value).toBe(5);
  expect(m.lossByFamily.find(x => x.label === "Unknown")?.value).toBe(1);
});
