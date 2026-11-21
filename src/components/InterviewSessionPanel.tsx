"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ScoreBar } from "./ScoreBar";

export interface SessionFeedback {
  answerText: string;
  feedbackText: string;
  generationMode: string;
  scores: {
    checks: string[];
    clarity: number;
    completeness: number;
    overall: number;
    relevance: number;
  };
}

export interface SessionQuestion {
  feedback: SessionFeedback | null;
  id: string;
  order: number;
  questionText: string;
  topic: string;
}

export interface SessionReport {
  answeredCount: number;
  averageClarity: number | null;
  averageCompleteness: number | null;
  averageOverall: number | null;
  averageRelevance: number | null;
  questionCount: number;
  strengths: string[];
  studyTopics: string[];
  weaknesses: string[];
}

export interface SessionView {
  generationMode: string;
  id: string;
  questions: SessionQuestion[];
  report: SessionReport;
  status: string;
}

const DISCLAIMER =
  "This feedback is practice guidance based on your typed answers. " +
  "It does not measure your personality or employability, and it " +
  "cannot predict how a real interview will go.";

function FeedbackBlock({ feedback }: { feedback: SessionFeedback }) {
  return (
    <div className="mt-4 rounded-lg bg-[var(--color-accent-soft)] p-4">
      <p className="text-sm font-semibold">
        Feedback{" "}
        <span className="font-normal text-[var(--color-muted)]">
          (
          {feedback.generationMode === "live"
            ? "AI"
            : "Basic checks (Demo AI, no API key set)"}
          )
        </span>
      </p>
      <div className="mt-3 space-y-3">
        <ScoreBar label="Overall" score={feedback.scores.overall} />
        <ScoreBar label="Clarity" score={feedback.scores.clarity} />
        <ScoreBar label="Completeness" score={feedback.scores.completeness} />
        <ScoreBar label="Relevance" score={feedback.scores.relevance} />
      </div>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-[var(--color-muted)]">
        {feedback.scores.checks.map((check) => (
          <li key={check}>{check}</li>
        ))}
      </ul>
      <p className="mt-3 text-sm">{feedback.feedbackText}</p>
    </div>
  );
}

function ReportBlock({ report }: { report: SessionReport }) {
  return (
    <section className="card mt-6">
      <h2 className="font-semibold">Session report</h2>
      <p className="mt-2 text-sm text-[var(--color-muted)]">
        You answered {report.answeredCount} of {report.questionCount}{" "}
        questions.
        {report.averageOverall !== null
          ? ` Average answer score: ${report.averageOverall}/100.`
          : ""}
      </p>
      <div className="mt-4 space-y-3">
        {report.averageClarity !== null && (
          <ScoreBar label="Clarity (average)" score={report.averageClarity} />
        )}
        {report.averageCompleteness !== null && (
          <ScoreBar
            label="Completeness (average)"
            score={report.averageCompleteness}
          />
        )}
        {report.averageRelevance !== null && (
          <ScoreBar label="Relevance (average)" score={report.averageRelevance} />
        )}
      </div>
      {report.strengths.length > 0 && (
        <div className="mt-4">
          <h3 className="text-sm font-semibold">Strengths</h3>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-[var(--color-muted)]">
            {report.strengths.map((strength) => (
              <li key={strength}>{strength}</li>
            ))}
          </ul>
        </div>
      )}
      {report.weaknesses.length > 0 && (
        <div className="mt-4">
          <h3 className="text-sm font-semibold">Areas to improve</h3>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-[var(--color-muted)]">
            {report.weaknesses.map((weakness) => (
              <li key={weakness}>{weakness}</li>
            ))}
          </ul>
        </div>
      )}
      {report.studyTopics.length > 0 && (
        <div className="mt-4">
          <h3 className="text-sm font-semibold">Suggested study topics</h3>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-[var(--color-muted)]">
            {report.studyTopics.map((topic) => (
              <li key={topic}>{topic}</li>
            ))}
          </ul>
        </div>
      )}
      <p className="note-box mt-4">{DISCLAIMER}</p>
    </section>
  );
}

/**
 * One mock interview session: questions in order, an answer box
 * for the first unanswered question, feedback under each answered
 * question, and the final report once the session completes.
 */
export function InterviewSessionPanel({
  initialSession,
}: {
  initialSession: SessionView;
}) {
  const router = useRouter();
  const [session, setSession] = useState(initialSession);
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentQuestion = session.questions.find(
    (question) => question.feedback === null,
  );

  async function submitAnswer() {
    if (!currentQuestion) return;
    setError(null);
    if (!answer.trim()) {
      setError("Write an answer first.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(`/api/interviews/${session.id}/answer`, {
        body: JSON.stringify({
          answerText: answer,
          questionId: currentQuestion.id,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const data = (await response.json().catch(() => null)) as {
        errors?: { form?: string };
        session?: SessionView;
      } | null;
      if (!response.ok || !data?.session) {
        setError(data?.errors?.form ?? "Something went wrong. Try again.");
        return;
      }
      setSession(data.session);
      setAnswer("");
      router.refresh();
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <p className="note-box">{DISCLAIMER}</p>
      <div className="mt-6 space-y-4">
        {session.questions.map((question) => (
          <section className="card" key={question.id}>
            <p className="text-sm font-semibold">
              Question {question.order}
              {question.topic ? (
                <span className="ml-2 font-normal text-[var(--color-muted)]">
                  {question.topic}
                </span>
              ) : null}
            </p>
            <p className="mt-2">{question.questionText}</p>
            {question.feedback ? (
              <>
                <div className="mt-3 rounded-lg border border-[var(--color-line)] p-3">
                  <p className="text-sm font-medium">Your answer</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm">
                    {question.feedback.answerText}
                  </p>
                </div>
                <FeedbackBlock feedback={question.feedback} />
              </>
            ) : question.id === currentQuestion?.id ? (
              <div className="mt-3">
                <label className="block text-sm">
                  <span className="mb-1 block font-medium">Your answer</span>
                  <textarea
                    className="field"
                    onChange={(event) => setAnswer(event.target.value)}
                    placeholder="Type your answer as you would say it in an interview…"
                    rows={6}
                    value={answer}
                  />
                </label>
                {error && <p className="error-text mt-2">{error}</p>}
                <button
                  className="btn-primary mt-3"
                  disabled={busy}
                  onClick={submitAnswer}
                  type="button"
                >
                  {busy ? "Checking your answer…" : "Submit answer"}
                </button>
              </div>
            ) : (
              <p className="mt-2 text-sm text-[var(--color-muted)]">
                Answer the previous question first.
              </p>
            )}
          </section>
        ))}
      </div>
      {session.status === "completed" && <ReportBlock report={session.report} />}
    </div>
  );
}
