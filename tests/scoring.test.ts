import { describe, it, expect } from "vitest";
import { scoreQuiz } from "../src/lib/scoring";

const quiz = [
  { options: ["A", "B"], answer_index: 0 },
  { options: ["A", "B"], answer_index: 1 },
  { options: ["A", "B"], answer_index: 0 },
  { options: ["A", "B"], answer_index: 1 },
];

describe("scoreQuiz", () => {
  it("passes at >= 70% (3 of 4)", () => {
    const r = scoreQuiz(quiz, [0, 1, 0, 0]);
    expect(r.correct).toBe(3);
    expect(r.score).toBe(0.75);
    expect(r.passed).toBe(true);
  });

  it("fails below 70% (2 of 4)", () => {
    const r = scoreQuiz(quiz, [0, 1, 1, 0]);
    expect(r.correct).toBe(2);
    expect(r.passed).toBe(false);
  });

  it("scores all correct", () => {
    const r = scoreQuiz(quiz, [0, 1, 0, 1]);
    expect(r.correct).toBe(4);
    expect(r.score).toBe(1);
    expect(r.passed).toBe(true);
  });
});
