import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import test from "node:test";

import {
  buildBaselinePackageFromIdea,
  type SampleSizeAssumptionsBase,
} from "@aurora/core";

import {
  buildBaselinePackZip,
  getBlockingIssues,
} from "../lib/export-baseline-pack";
import { POST } from "../app/api/baseline-pack/download/route";

const IDEA =
  "We want to study 30-day mortality after emergency laparotomy in adult patients treated at our tertiary care hospital.";

const ASSUMPTIONS: Partial<SampleSizeAssumptionsBase> = {
  alpha: 0.05,
  power: 0.8,
  twoSided: true,
  hypothesisType: "superiority",
  expectedControlEventRate: 0.3,
  expectedTreatmentEventRate: 0.18,
};

type ZipEntries = Map<string, any>;

function parseZip(data: Uint8Array): ZipEntries {
  const raw: any = typeof Buffer !== "undefined" ? Buffer.from(data) : data;
  const entries = new Map<string, any>();
  let offset = 0;

  while (offset + 30 <= raw.length && raw.readUInt32LE(offset) === 0x04034b50) {
    const nameLength = raw.readUInt16LE(offset + 26);
    const extraLength = raw.readUInt16LE(offset + 28);
    const compressedSize = raw.readUInt32LE(offset + 18);
    const nameStart = offset + 30;
    const nameEnd = nameStart + nameLength;
    const dataStart = nameEnd + extraLength;
    const dataEnd = dataStart + compressedSize;

    const name = raw.slice(nameStart, nameEnd).toString("utf8");
    const entry = raw.slice(dataStart, dataEnd);

    entries.set(name, entry);
    offset = dataEnd;
  }

  return entries;
}

test("baseline pack zip includes deterministic drafts with disclaimers", async () => {
  const baseline = buildBaselinePackageFromIdea(IDEA, ASSUMPTIONS);
  const zipBytes = await buildBaselinePackZip(baseline);
  assert.ok(zipBytes.byteLength > 0, "zip should not be empty");

  const entries = parseZip(Buffer.from(zipBytes));
  const expectedFiles = [
    "01_Protocol.docx",
    "02_SAP.docx",
    "03_PIS_ICF.docx",
    "04_IEC_Cover_Note.docx",
    "05_CRF_Spec.json",
    "06_Registry_Mapping.csv",
    "07_Regulatory_Checklist.md",
    "08_Literature_Plan.md",
  ];

  for (const file of expectedFiles) {
    assert.ok(entries.has(file), `expected ${file} in baseline pack`);
  }

  const protocolDoc = entries.get("01_Protocol.docx");
  assert.ok(protocolDoc);
  const protocolXml = parseZip(protocolDoc).get("word/document.xml");
  assert.ok(protocolXml, "protocol doc should contain document.xml");
  const protocolText = protocolXml.toString("utf8");
  assert.match(protocolText, /Aurora Research OS deterministic engine/);
  assert.match(protocolText, /Study Overview/);

  const checklist = entries.get("07_Regulatory_Checklist.md")?.toString("utf8");
  assert.ok(checklist);
  assert.match(checklist, /Regulatory Checklist/);
  assert.match(checklist, /Aurora Research OS deterministic engine/);

  const registryCsv = entries.get("06_Registry_Mapping.csv")?.toString("utf8");
  assert.ok(registryCsv);
  assert.match(registryCsv, /field_id,label,value,source,notes/);
  assert.match(registryCsv, /Aurora Research OS deterministic engine/);
});

test("getBlockingIssues returns critical issues only", () => {
  const baseline = buildBaselinePackageFromIdea("Retrospective audit", {} as any);
  const critical = getBlockingIssues(baseline);
  for (const issue of critical) {
    assert.equal(issue.severity, "critical");
  }
});

test("download route enforces compliance gate", async () => {
  const missingIdeaResponse = await POST(
    new Request("http://localhost/api/baseline-pack/download", {
      method: "POST",
      body: JSON.stringify({}),
      headers: { "Content-Type": "application/json" },
    })
  );
  assert.equal(missingIdeaResponse.status, 400);

  const okResponse = await POST(
    new Request("http://localhost/api/baseline-pack/download", {
      method: "POST",
      body: JSON.stringify({ idea: IDEA, assumptions: ASSUMPTIONS, acknowledgeCritical: true }),
      headers: { "Content-Type": "application/json" },
    })
  );
  assert.equal(okResponse.status, 200);
  const arrayBuffer = await okResponse.arrayBuffer();
  assert.ok(arrayBuffer.byteLength > 0);
});

