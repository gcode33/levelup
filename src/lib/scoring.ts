export type QuizQuestion = { options: string[]; answer_index: number };

export function scoreQuiz(quiz: QuizQuestion[], answers: number[]) {
  const total = quiz.length;
  let correct = 0;
  quiz.forEach((q, i) => {
    if (answers[i] === q.answer_index) correct++;
  });
  const score = total > 0 ? correct / total : 0;
  return { correct, total, score, passed: score >= 0.7 };
}
