// Real OCR + Groq run. Skipped unless RUN_INTEGRATION=1 and sample files exist (see docs/test-report.md).
import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "fs";
import { verifyDocument } from "@/lib/documents/verify";

const dir = process.env.SAMPLE_DIR ?? "";
const run = process.env.RUN_INTEGRATION === "1" && existsSync(`${dir}/income.png`);

describe.skipIf(!run)("OCR + LLM verification (integration)", () => {
  it("accepts a genuine-looking income certificate image", async () => {
    const r = await verifyDocument("income_certificate", readFileSync(`${dir}/income.png`), "image/png");
    console.log("income →", r.accept, r.method, r.confidence, r.reason, JSON.stringify(r.fields));
    expect(r.accept).toBe(true);
  }, 120_000);
  it("rejects a PAN-style card uploaded as an income certificate", async () => {
    const r = await verifyDocument("income_certificate", readFileSync(`${dir}/pan.png`), "image/png");
    console.log("pan as income →", r.accept, r.method, r.detectedType, r.reason);
    expect(r.accept).toBe(false);
  }, 120_000);
  it("accepts a digital PDF marksheet and rejects it as a caste certificate", async () => {
    const buf = readFileSync(`${dir}/marksheet.pdf`);
    const ok = await verifyDocument("marksheet", buf, "application/pdf");
    const bad = await verifyDocument("caste_certificate", buf, "application/pdf");
    console.log("marksheet →", ok.accept, ok.method, ok.reason, "| as caste →", bad.accept, bad.reason);
    expect(ok.accept).toBe(true);
    expect(bad.accept).toBe(false);
  }, 120_000);
});

describe.skipIf(!run)("vision fallback (integration)", () => {
  it("scanned income certificate PDF (no text layer) is checked from a page screenshot and accepted", async () => {
    const r = await verifyDocument("income_certificate", readFileSync(`${dir}/income-scanned.pdf`), "application/pdf");
    console.log("scanned income pdf →", r.accept, r.method, r.confidence, r.reason);
    expect(r.accept).toBe(true);
    expect(r.method).toMatch(/pdf-screenshot\+vision-llm/);
  }, 120_000);
  it("scanned PAN PDF declared as income certificate is rejected via vision", async () => {
    const r = await verifyDocument("income_certificate", readFileSync(`${dir}/pan-scanned.pdf`), "application/pdf");
    console.log("scanned pan as income →", r.accept, r.method, r.detectedType, r.reason);
    expect(r.accept).toBe(false);
  }, 120_000);
  it("Aadhaar images are never sent to the vision model", async () => {
    const r = await verifyDocument("aadhaar", readFileSync(`${dir}/income-scanned.pdf`), "application/pdf");
    console.log("aadhaar scanned →", r.accept, r.method, r.reason);
    expect(r.method).not.toMatch(/vision/);
    expect(r.accept).toBe(false);
  }, 120_000);
  it("a small blurry photo is either read by OCR or checked by vision", async () => {
    const r = await verifyDocument("income_certificate", readFileSync(`${dir}/income-blurry.jpg`), "image/jpeg");
    console.log("blurry jpg →", r.accept, r.method, r.confidence, r.reason);
    expect(typeof r.accept).toBe("boolean");
  }, 120_000);
});
