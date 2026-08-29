import { describe, it, expect } from "vitest";
import { roadmapSchema, levelSchema } from "../src/lib/schemas";

const validLevel = {
  index: 0,
  title: "Fundamentals",
  description: "Learn the basics",
  lessons: [{ title: "Intro", content: "body", key_points: ["a"], resources: [] }],
  quiz: [
    { question: "Q?", options: ["A", "B"], answer_index: 0, explanation: "why" },
  ],
  study_sheet: "summary",
  projects: [{ title: "P", description: "d", skills_used: ["x"] }],
};

describe("roadmapSchema", () => {
  it("accepts a valid roadmap with 3 levels", () => {
    const levels = [0, 1, 2].map((i) => ({ ...validLevel, index: i }));
    expect(() => roadmapSchema.parse({ target_role: "X", levels })).not.toThrow();
  });

  it("rejects fewer than 3 levels", () => {
    expect(() =>
      roadmapSchema.parse({ target_role: "X", levels: [validLevel, validLevel] }),
    ).toThrow();
  });

  it("rejects an out-of-bounds answer_index", () => {
    const bad = {
      ...validLevel,
      quiz: [
        { question: "Q?", options: ["A", "B"], answer_index: 5, explanation: "why" },
      ],
    };
    expect(() => levelSchema.parse(bad)).toThrow();
  });

  it("rejects a level with no lessons", () => {
    expect(() => levelSchema.parse({ ...validLevel, lessons: [] })).toThrow();
  });
});
