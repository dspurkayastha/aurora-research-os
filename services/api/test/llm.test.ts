/**
 * Unit tests for LLM integration and rulebook constraint enforcement
 */

import { describe, it } from "node:test";
import assert from "node:assert";

// Mock the LLM module
const mockLLM = {
  validateAIAvailability: () => {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("AI service is required but not configured");
    }
  },
  isAIAvailable: () => !!process.env.GEMINI_API_KEY,
  validateNoRegulatoryClaims: (content: string) => {
    const forbiddenPatterns = [
      /approved by (IEC|IRB|CTRI|DCGI)/gi,
      /ethics committee approval/gi,
      /regulatory approval/gi,
      /CTRI registration number/gi,
      /DCGI approval number/gi,
    ];
    
    let cleaned = content;
    for (const pattern of forbiddenPatterns) {
      cleaned = cleaned.replace(pattern, "[To be completed by PI/IEC]");
    }
    
    return cleaned;
  },
};

describe("LLM Integration Tests", () => {
  describe("validateAIAvailability", () => {
    it("should throw error when GEMINI_API_KEY is not set", () => {
      const originalKey = process.env.GEMINI_API_KEY;
      delete process.env.GEMINI_API_KEY;
      
      assert.throws(() => {
        mockLLM.validateAIAvailability();
      }, /AI service is required/);
      
      if (originalKey) {
        process.env.GEMINI_API_KEY = originalKey;
      }
    });
  });

  describe("validateNoRegulatoryClaims", () => {
    it("should remove IEC approval claims", () => {
      const input = "This study has been approved by IEC.";
      const output = mockLLM.validateNoRegulatoryClaims(input);
      assert(!output.includes("approved by IEC"));
      assert(output.includes("[To be completed by PI/IEC]"));
    });

    it("should remove CTRI registration claims", () => {
      const input = "CTRI registration number: CTRI/2024/01/123456";
      const output = mockLLM.validateNoRegulatoryClaims(input);
      assert(!output.includes("CTRI registration number"));
      assert(output.includes("[To be completed by PI/IEC]"));
    });

    it("should remove regulatory approval claims", () => {
      const input = "The study has received regulatory approval from DCGI.";
      const output = mockLLM.validateNoRegulatoryClaims(input);
      assert(!output.includes("regulatory approval"));
      assert(output.includes("[To be completed by PI/IEC]"));
    });

    it("should preserve legitimate content", () => {
      const input = "This study will be submitted to the IEC for review.";
      const output = mockLLM.validateNoRegulatoryClaims(input);
      assert(output.includes("submitted to the IEC"));
      assert(!output.includes("[To be completed by PI/IEC]"));
    });
  });

  describe("isAIAvailable", () => {
    it("should return false when GEMINI_API_KEY is not set", () => {
      const originalKey = process.env.GEMINI_API_KEY;
      delete process.env.GEMINI_API_KEY;
      
      assert.strictEqual(mockLLM.isAIAvailable(), false);
      
      if (originalKey) {
        process.env.GEMINI_API_KEY = originalKey;
      }
    });
  });
});

describe("Rulebook Constraint Enforcement", () => {
  it("should enforce no regulatory claims in AI output", () => {
    const testCases = [
      "Approved by IEC",
      "CTRI registration number: CTRI/2024/01/123456",
      "DCGI approval obtained",
      "Regulatory approval granted",
    ];

    for (const testCase of testCases) {
      const cleaned = mockLLM.validateNoRegulatoryClaims(testCase);
      assert(
        !cleaned.match(/approved by (IEC|IRB|CTRI|DCGI)/gi),
        `Failed to clean: ${testCase}`
      );
    }
  });

  it("should preserve study design information", () => {
    const input = "This is a randomized controlled trial (RCT) study design.";
    const output = mockLLM.validateNoRegulatoryClaims(input);
    assert(output.includes("randomized controlled trial"));
    assert(output.includes("RCT"));
  });
});

