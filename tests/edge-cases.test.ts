import { describe, it, expect } from "vitest";
import { scoreQuiz } from "../src/lib/scoring";
import { roadmapSchema, levelSchema, quizQuestionSchema } from "../src/lib/schemas";

describe("scoreQuiz edge cases", () => {
  it("returns 0/0 for an empty quiz (not passed)", () => {
    const r = scoreQuiz([], []);
    expect(r).toEqual({ correct: 0, total: 0, score: 0, passed: false });
  });

  it("treats missing answers as wrong", () => {
    const quiz = [
      { options: ["A", "B"], answer_index: 0 },
      { options: ["A", "B"], answer_index: 1 },
    ];
    const r = scoreQuiz(quiz, [0]); // only the first answered
    expect(r.correct).toBe(1);
    expect(r.total).toBe(2);
    expect(r.passed).toBe(false);
  });

  it("passes at exactly 70%", () => {
    const quiz = Array.from({ length: 10 }, () => ({ options: ["A", "B"], answer_index: 0 }));
    const answers = quiz.map((_, i) => (i < 7 ? 0 : 1));
    const r = scoreQuiz(quiz, answers);
    expect(r.correct).toBe(7);
    expect(r.score).toBe(0.7);
    expect(r.passed).toBe(true);
  });

  it("fails just below 70%", () => {
    const quiz = Array.from({ length: 10 }, () => ({ options: ["A", "B"], answer_index: 0 }));
    const answers = quiz.map((_, i) => (i < 6 ? 0 : 1));
    const r = scoreQuiz(quiz, answers);
    expect(r.correct).toBe(6);
    expect(r.score).toBe(0.6);
    expect(r.passed).toBe(false);
  });
});

describe("schema edge cases", () => {
  const validLevel = {
    index: 0,
    title: "T",
    description: "D",
    lessons: [{ title: "L", content: "C", key_points: ["p"], resources: [] }],
    quiz: [{ question: "Q", options: ["A", "B"], answer_index: 0, explanation: "E" }],
    study_sheet: "S",
    projects: [],
  };

  it("rejects a quiz question with fewer than 2 options", () => {
    expect(() =>
      quizQuestionSchema.parse({
        question: "Q",
        options: ["A"],
        answer_index: 0,
        explanation: "E",
      }),
    ).toThrow();
  });

  it("rejects 2 levels (below the 3 minimum)", () => {
    expect(() =>
      roadmapSchema.parse({ target_role: "X", levels: [validLevel, validLevel] }),
    ).toThrow();
  });

  it("rejects 9 levels (above the 8 maximum)", () => {
    const nine = Array.from({ length: 9 }, () => validLevel);
    expect(() => roadmapSchema.parse({ target_role: "X", levels: nine })).toThrow();
  });

  it("rejects non-contiguous level indices", () => {
    const levels = [
      { ...validLevel, index: 0 },
      { ...validLevel, index: 2 },
      { ...validLevel, index: 3 },
    ];
    expect(() => roadmapSchema.parse({ target_role: "X", levels })).toThrow();
  });

  it("rejects duplicate level indices", () => {
    const levels = [
      { ...validLevel, index: 0 },
      { ...validLevel, index: 1 },
      { ...validLevel, index: 1 },
    ];
    expect(() => roadmapSchema.parse({ target_role: "X", levels })).toThrow();
  });

  it("rejects an empty target_role", () => {
    const levels = [0, 1, 2].map((i) => ({ ...validLevel, index: i }));
    expect(() => roadmapSchema.parse({ target_role: "", levels })).toThrow();
  });

  it("accepts contiguous zero-based indices", () => {
    const levels = [0, 1, 2].map((i) => ({ ...validLevel, index: i }));
    expect(() => roadmapSchema.parse({ target_role: "X", levels })).not.toThrow();
  });

  it("rejects a level with an empty quiz", () => {
    expect(() => levelSchema.parse({ ...validLevel, quiz: [] })).toThrow();
  });

  it("rejects a negative answer_index", () => {
    expect(() =>
      levelSchema.parse({
        ...validLevel,
        quiz: [
          { question: "Q", options: ["A", "B"], answer_index: -1, explanation: "E" },
        ],
      }),
    ).toThrow();
  });
});
