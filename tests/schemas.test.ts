import { describe, it, expect } from "vitest";
import { parsedProfileSchema } from "../src/lib/schemas";

describe("parsedProfileSchema", () => {
  it("accepts a valid profile", () => {
    const profile = {
      current_title: "Frontend Developer",
      level_band: "Mid",
      skills: ["React", "TypeScript"],
      years_exp: 4,
      current_pay: 85000,
    };
    expect(() => parsedProfileSchema.parse(profile)).not.toThrow();
  });

  it("accepts nulls for optional fields", () => {
    const profile = {
      current_title: null,
      level_band: "Junior",
      skills: [],
      years_exp: null,
      current_pay: null,
    };
    expect(parsedProfileSchema.parse(profile)).toEqual(profile);
  });

  it("rejects an invalid level_band", () => {
    expect(() =>
      parsedProfileSchema.parse({
        current_title: "Dev",
        level_band: "Principal",
        skills: [],
        years_exp: 1,
        current_pay: null,
      }),
    ).toThrow();
  });

  it("rejects non-array skills", () => {
    expect(() =>
      parsedProfileSchema.parse({
        current_title: "Dev",
        level_band: "Mid",
        skills: "React",
        years_exp: 1,
        current_pay: null,
      }),
    ).toThrow();
  });
});
