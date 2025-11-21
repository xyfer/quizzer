import { computed, effect, Injectable, signal } from '@angular/core';
import { QuestionScore, Quiz, QuizResults, QuizSession, Status } from '../models/types';
import { QuizService } from './quiz.service';

// responsible for the state of quiz sessions both currently active and paused
@Injectable({
  providedIn: 'root',
})
export class QuizSessionService {
  // private signal
  private sessionsSignal = signal<QuizSession[]>([]);
  // public computed signal, readonly
  sessions = computed(() => this.sessionsSignal());

  // private signal for current session
  private currentSessionSignal = signal<QuizSession | null>(null);
  // public computed signal, readonly
  currentSession = computed(() => this.currentSessionSignal());

  // private signal for results, map of quizId to QuizResults
  private resultsSignal = signal<Map<string, QuizResults>>(new Map());
  // public computed signal, readonly
  results = computed(() => this.resultsSignal());

  // private signal to track quiz ID due to timeout
  private timedOutQuizIdSignal = signal<string | null>(null);
  // public computed signal, readonly
  timedOutQuizId = computed(() => this.timedOutQuizIdSignal());

  timeTickSignal = signal<number>(0);

  timeRemaining = computed(() => {
    this.timeTickSignal();

    const currSession = this.currentSessionSignal();
    if (
      !currSession ||
      currSession.status === Status.NOT_STARTED ||
      currSession.status === Status.COMPLETED
    ) {
      return 0;
    }

    const remaining = Math.max(0, currSession.deadline - Date.now());
    return Math.ceil(remaining / 1000);
  });

  isTimeRunningOut = computed(() => this.timeRemaining() < 60 && this.timeRemaining() > 0);
  isTimeExpired = computed(() => this.timeRemaining() === 0);

  private constructor(private quizStateService: QuizService) {
    this.loadSessionsFromStorage();
    this.initializeTimeTracking();
  }

  private initializeTimeTracking(): void {
    const interval = setInterval(() => {
      this.timeTickSignal.set(this.timeTickSignal() + 1);

      const session = this.currentSessionSignal();
      if (session && this.isTimeExpired()) {
        const quizId = session.quizId;
        this.completeSession();
        this.timedOutQuizIdSignal.set(quizId);
        clearInterval(interval);
      }
    }, 1000);

    effect(() => {
      return () => clearInterval(interval);
    });
  }

  startSession(quizId: string): QuizSession | null {
    const quiz = this.quizStateService.getQuizById(quizId);
    if (!quiz) return null;

    // Reset the auto-completed signal when starting a new session
    this.timedOutQuizIdSignal.set(null);

    const existingSession = this.sessionsSignal().find(
      (session) => session.quizId === quizId && session.status === Status.IN_PROGRESS,
    );

    if (existingSession) {
      this.updateCurrentSession(existingSession);
      this.saveSessionsToStorage();
      return existingSession;
    }

    const timeLimitMs = this.convertTimeLimit(quiz.timeLimitValue);
    const now = Date.now();
    const deadline = now + timeLimitMs;

    const session: QuizSession = {
      id: this.generateId(),
      quizId,
      status: Status.IN_PROGRESS,
      startTime: now,
      deadline,
      userAnswers: [],
      submittedQuestionIds: [],
    };

    this.addSession(session);
    this.updateCurrentSession(session);
    this.saveSessionsToStorage();

    return session;
  }

  recordAnswer(questionId: string, selectedOptionId: string): void {
    const currSession = this.currentSessionSignal();
    if (!currSession || currSession.status !== Status.IN_PROGRESS) return;

    // if we already have an answer for this question, update it; otherwise add new answer
    const updatedAnswers = currSession.userAnswers.find((a) => a.questionId === questionId)
      ? currSession.userAnswers.map((answer) =>
          answer.questionId === questionId ? { questionId, selectedOptionId } : answer,
        )
      : [...currSession.userAnswers, { questionId, selectedOptionId }];

    const updated: QuizSession = {
      ...currSession,
      userAnswers: updatedAnswers,
    };

    this.updateCurrentSession(updated);
    this.updateSession(currSession.id, updated);
    this.saveSessionsToStorage();
  }

  submitAnswer(questionId: string): void {
    const currSession = this.currentSessionSignal();
    if (!currSession || currSession.status !== Status.IN_PROGRESS) return;

    // mark this question as submitted if not already
    if (!currSession.submittedQuestionIds.includes(questionId)) {
      const updated: QuizSession = {
        ...currSession,
        submittedQuestionIds: [...currSession.submittedQuestionIds, questionId],
      };

      this.updateCurrentSession(updated);
      this.updateSession(currSession.id, updated);
      this.saveSessionsToStorage();
    }
  }

  completeSession(): QuizResults | null {
    const currSession = this.currentSessionSignal();
    if (!currSession) return null;

    const quiz = this.quizStateService.getQuizById(currSession.quizId);
    if (!quiz) return null;

    const results = this.calculateResults(currSession, quiz);

    // mark session as completed
    const updatedSession: QuizSession = {
      ...currSession,
      status: Status.COMPLETED,
    };

    // update all our signals and storage
    this.updateSession(currSession.id, updatedSession);
    this.updateResults(currSession.quizId, results);
    this.saveSessionsToStorage();
    this.leaveSession();

    return results;
  }

  private calculateResults(session: QuizSession, quiz: Quiz): QuizResults {
    const questionScores: QuestionScore[] = quiz.questions.map((question) => {
      const userAnswer = session.userAnswers.find((a) => a.questionId === question.id);
      const isCorrect = userAnswer?.selectedOptionId === question.correctAnswerId;

      return {
        questionId: question.id,
        userAnswerId: userAnswer?.selectedOptionId || '',
        correctAnswerId: question.correctAnswerId,
        isCorrect,
      };
    });

    const score = questionScores.reduce(
      (sum, qs, index) => sum + (qs.isCorrect ? quiz.questions[index].pointValue : 0),
      0,
    );
    const maxScore = quiz.questions.reduce((sum, q) => sum + q.pointValue, 0);
    const percentage = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;

    return {
      sessionId: session.id,
      quizId: quiz.id,
      score,
      maxScore,
      percentage,
      questionScores,
    };
  }

  private addSession(session: QuizSession): void {
    this.sessionsSignal.set([...this.sessionsSignal(), session]);
  }

  private updateSession(sessionId: string, updatedSession: QuizSession): void {
    // create new array with updated session
    const sessions = this.sessionsSignal().map((session) =>
      session.id === sessionId ? updatedSession : session,
    );
    this.sessionsSignal.set(sessions);
  }

  private updateResults(quizId: string, results: QuizResults): void {
    // create new map with updated results
    const updatedResults = new Map(this.resultsSignal());
    updatedResults.set(quizId, results);
    this.resultsSignal.set(updatedResults);
  }

  private updateCurrentSession(session: QuizSession | null): void {
    this.currentSessionSignal.set(session);
  }

  leaveSession(): void {
    this.currentSessionSignal.set(null);
  }

  private saveSessionsToStorage(): void {
    const data = {
      sessions: this.sessionsSignal(),
      results: Array.from(this.resultsSignal().values()),
    };
    localStorage.setItem('quizzer-sessions', JSON.stringify(data));
  }

  private loadSessionsFromStorage(): void {
    const stored = localStorage.getItem('quizzer-sessions');
    if (stored) {
      try {
        const data = JSON.parse(stored);
        const sessions = (data.sessions || []).map((session: QuizSession) => ({
          ...session,
          submittedQuestionIds: session.submittedQuestionIds || [],
        }));
        this.sessionsSignal.set(sessions);

        const resultsArray = data.results || [];
        const resultsMap = new Map<string, QuizResults>();
        resultsArray.forEach((result: QuizResults) => {
          resultsMap.set(result.quizId, result);
        });
        this.resultsSignal.set(resultsMap);

        const activeSession = sessions.find(
          (session: QuizSession) => session.status === Status.IN_PROGRESS,
        );
        if (activeSession) {
          this.currentSessionSignal.set(activeSession);
        }
      } catch {
        console.warn('Failed to load sessions from storage');
      }
    }
  }

  getResultsForQuiz(quizId: string): QuizResults | undefined {
    return this.resultsSignal().get(quizId);
  }

  private convertTimeLimit(value: number): number {
    // Time limit is always in minutes
    return value * 60 * 1000;
  }

  private generateId(): string {
    return crypto.randomUUID();
  }
}
