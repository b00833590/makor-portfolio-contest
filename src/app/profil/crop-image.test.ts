import { describe, expect, test } from "vitest";
import { computeAvatarOutputSize } from "./crop-image";

describe("computeAvatarOutputSize", () => {
  test("downscales a crop larger than the max dimension", () => {
    expect(computeAvatarOutputSize(1200, 256)).toBe(256);
  });

  test("keeps the native crop size when it is already below the max dimension", () => {
    expect(computeAvatarOutputSize(120, 256)).toBe(120);
  });

  test("never upscales a small crop", () => {
    expect(computeAvatarOutputSize(50, 256)).toBe(50);
  });

  test("rounds fractional crop sizes to the nearest pixel", () => {
    expect(computeAvatarOutputSize(199.6, 256)).toBe(200);
  });
});
