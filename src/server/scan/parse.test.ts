
import { parseScanCode } from "./parse";

describe("parseScanCode", () => {
  it("accepts legacy BATCH:<num>", () => {
    expect(parseScanCode("BATCH:2251001")).toEqual({ by: "batchNumber", value: "2251001" });
  });
  it("accepts ht:batch:<num>", () => {
    expect(parseScanCode("ht:batch:2251001")).toEqual({ by: "batchNumber", value: "2251001" });
  });
  it("strips control chars", () => {
    expect(parseScanCode("BATCH:\x1D2251001")).toEqual({ by: "batchNumber", value: "2251001" });
  });
  it("accepts plain numbers and #numbers", () => {
    expect(parseScanCode("2251001")).toEqual({ by: "batchNumber", value: "2251001" });
    expect(parseScanCode("#2251001")).toEqual({ by: "batchNumber", value: "2251001" });
  });
  it("parses URLs", () => {
    expect(parseScanCode("https://app/batches/AbC_def-123456789")).toEqual({ by: "id", value: "AbC_def-123456789" });
    expect(parseScanCode("https://app/batches/2251001")).toEqual({ by: "batchNumber", value: "2251001" });
    expect(parseScanCode("https://app/whatever?batchNumber=2251001")).toEqual({ by: "batchNumber", value: "2251001" });
  });
  it("parses JSON", () => {
    expect(parseScanCode('{"batchNumber":"2251001"}')).toEqual({ by: "batchNumber", value: "2251001" });
    expect(parseScanCode('{"id":"AbC_def-123456789"}')).toEqual({ by: "id", value: "AbC_def-123456789" });
  });
  it("rejects absurdly long inputs", () => {
    expect(parseScanCode("X".repeat(513))).toBeNull();
  });
});
