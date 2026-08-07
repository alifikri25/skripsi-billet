import { describe, it, expect } from "vitest";
import {
  formatIDRX,
  formatIDRXShort,
  truncateAddress,
  getCategoryName,
  getCategoryGradient,
  getCategoryColor,
} from "./format";

describe("Blockchain Format Helpers", () => {
  describe("formatIDRX", () => {
    it("should format large amounts in wei (18 decimals) to standard Indonesian Rupiah", () => {
      // 500,000 IDRX represented in 18 decimal wei
      const amount = 500000000000000000000000n;
      expect(formatIDRX(amount)).toBe("Rp 500.000");
    });

    it("should handle zero amounts correctly", () => {
      expect(formatIDRX(0n)).toBe("Rp 0");
    });

    it("should handle smaller amounts correctly", () => {
      const amount = 1500000000000000000n; // 1.5 IDRX
      expect(formatIDRX(amount)).toBe("Rp 2"); // formatted with maxFractionDigits: 0
    });
  });

  describe("formatIDRXShort", () => {
    it("should format amounts over 1 million with 'jt' shorthand and Indonesian comma decimal", () => {
      const amount = 2500000000000000000000000n; // 2.5 million
      expect(formatIDRXShort(amount)).toBe("2,5jt");
    });

    it("should format amounts over 10 thousand with 'rb' shorthand", () => {
      const amount = 35000000000000000000000n; // 35k
      expect(formatIDRXShort(amount)).toBe("35rb");

      const fractionalAmount = 10500000000000000000000n; // 10.5k
      expect(formatIDRXShort(fractionalAmount)).toBe("10,5rb");
    });

    it("should disable 'rb' shorthand for amounts under 10 thousand for accuracy", () => {
      const amount = 1500000000000000000000n; // 1.500
      expect(formatIDRXShort(amount)).toBe("1.500");
    });

    it("should transition smoothly to 1jt for values close to 1 million (like 999.950)", () => {
      const boundaryValue = 999950000000000000000000n; // 999.950
      expect(formatIDRXShort(boundaryValue)).toBe("1jt");

      const boundaryValueRb = 999000000000000000000000n; // 999.000
      expect(formatIDRXShort(boundaryValueRb)).toBe("999rb");
    });

    it("should format small amounts with standard localized numbering", () => {
      const amount = 250000000000000000000n; // 250
      expect(formatIDRXShort(amount)).toBe("250");
    });
  });

  describe("truncateAddress", () => {
    it("should truncate long ethereum addresses to 0x1234...5678 format", () => {
      const address = "0x742d35Cc6634C0532925a3b844Bc454e4438f44e";
      expect(truncateAddress(address)).toBe("0x742d...f44e");
    });

    it("should support custom character length for truncation", () => {
      const address = "0x742d35Cc6634C0532925a3b844Bc454e4438f44e";
      expect(truncateAddress(address, 6)).toBe("0x742d35...38f44e");
    });

    it("should handle empty addresses gracefully", () => {
      expect(truncateAddress("")).toBe("");
    });
  });

  describe("getCategoryName", () => {
    it("should return the correct display names for predefined tokenIds", () => {
      expect(getCategoryName(1)).toBe("Reguler");
      expect(getCategoryName(2n)).toBe("VIP");
      expect(getCategoryName(3)).toBe("VVIP");
    });

    it("should return default category label for unknown tokenIds", () => {
      expect(getCategoryName(99)).toBe("Kategori #99");
    });
  });

  describe("getCategoryGradient", () => {
    it("should return predefined gradient classes for visual layout styling", () => {
      expect(getCategoryGradient(1)).toContain("from-amber-200");
      expect(getCategoryGradient(2)).toContain("from-orange-300");
      expect(getCategoryGradient(3)).toContain("from-amber-300");
      expect(getCategoryGradient(999)).toBe("from-stone-300 to-stone-400");
    });
  });

  describe("getCategoryColor", () => {
    it("should return correct solid color strings", () => {
      expect(getCategoryColor(1)).toBe("#FF8A50");
      expect(getCategoryColor(2)).toBe("#E85A2A");
      expect(getCategoryColor(3)).toBe("#C44A22");
      expect(getCategoryColor(100)).toBe("#8A8078");
    });
  });
});
