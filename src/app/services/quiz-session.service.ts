import { Injectable, signal, computed, effect } from '@angular/core';
import {
  QuizSession,
  Status,
  UserAnswer,
  QuizResults,
  QuestionScore,
  Quiz,
  TimeUnit,
} from '../models/types';
import { QuizService } from './quiz.service';

// responsible for the state of an active quiz session
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

  timeTickSignal = signal<number>(0);

  timeRemaining = computed(() => {
    this.timeTickSignal();

    const session = this.currentSessionSignal();
    if (!session || session.status === Status.NOT_STARTED || session.status === Status.COMPLETED) {
      return 0;
    }

    const remaining = Math.max(0, session.deadline - Date.now());
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
        this.completeSessionDueToTimeout();
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

    const existingSession = this.sessionsSignal().find(
      (s) => s.quizId === quizId && s.status === Status.IN_PROGRESS,
    );

    if (existingSession) {
      this.currentSessionSignal.set(existingSession);
      return existingSession;
    }

    const timeLimitMs = this.convertTimeLimit(quiz.timeLimitValue, quiz.timeLimitUnit);
    const now = Date.now();
    const deadline = now + timeLimitMs;

    const session: QuizSession = {
      id: this.generateId(),
      quizId,
      status: Status.IN_PROGRESS,
      startTime: now,
      deadline,
      userAnswers: [],
    };

    this.sessionsSignal.set([...this.sessionsSignal(), session]);
    this.currentSessionSignal.set(session);
    this.saveSessionsToStorage();

    return session;
  }

  recordAnswer(questionId: string, selectedOptionId: string): void {
    const session = this.currentSessionSignal();
    if (!session || session.status !== Status.IN_PROGRESS) return;

    const existingAnswerIndex = session.userAnswers.findIndex((a) => a.questionId === questionId);

    let updatedAnswers: UserAnswer[];
    if (existingAnswerIndex >= 0) {
      updatedAnswers = [
        ...session.userAnswers.slice(0, existingAnswerIndex),
        { questionId, selectedOptionId },
        ...session.userAnswers.slice(existingAnswerIndex + 1),
      ];
    } else {
      updatedAnswers = [...session.userAnswers, { questionId, selectedOptionId }];
    }

    const updated: QuizSession = {
      ...session,
      userAnswers: updatedAnswers,
    };

    this.currentSessionSignal.set(updated);
    this.saveSessionsToStorage();
  }

  completeSession(): QuizResults | null {
    const session = this.currentSessionSignal();
    if (!session) return null;

    const quiz = this.quizStateService.getQuizById(session.quizId);
    if (!quiz) return null;

    const results = this.calculateResults(session, quiz);

    const updatedSession: QuizSession = {
      ...session,
      status: Status.COMPLETED,
    };

    const sessions = this.sessionsSignal().map((s) => (s.id === session.id ? updatedSession : s));
    this.sessionsSignal.set(sessions);

    const updatedResults = new Map(this.resultsSignal());
    updatedResults.set(session.quizId, results);
    this.resultsSignal.set(updatedResults);

    this.currentSessionSignal.set(null);
    this.saveSessionsToStorage();

    return results;
  }

  private completeSessionDueToTimeout(): void {
    const session = this.currentSessionSignal();
    if (!session) return;

    const quiz = this.quizStateService.getQuizById(session.quizId);
    if (!quiz) return;

    const results = this.calculateResults(session, quiz);

    const updatedSession: QuizSession = {
      ...session,
      status: Status.COMPLETED,
    };

    const sessions = this.sessionsSignal().map((s) => (s.id === session.id ? updatedSession : s));
    this.sessionsSignal.set(sessions);

    const updatedResults = new Map(this.resultsSignal());
    updatedResults.set(session.quizId, results);
    this.resultsSignal.set(updatedResults);

    this.currentSessionSignal.set(null);
    this.saveSessionsToStorage();
  }

  leaveSession(): void {
    this.currentSessionSignal.set(null);
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

  getResultsForQuiz(quizId: string): QuizResults | undefined {
    return this.resultsSignal().get(quizId);
  }

  private convertTimeLimit(value: number, unit: TimeUnit): number {
    if (unit === TimeUnit.MINUTES) {
      return value * 60 * 1000;
    }
    return value * 1000;
  }

  private generateId(): string {
    return crypto.randomUUID();
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
        this.sessionsSignal.set(data.sessions || []);

        const resultsArray = data.results || [];
        const resultsMap = new Map<string, QuizResults>();
        resultsArray.forEach((result: QuizResults) => {
          resultsMap.set(result.quizId, result);
        });
        this.resultsSignal.set(resultsMap);

        const activeSession = (data.sessions || []).find(
          (s: QuizSession) => s.status === Status.IN_PROGRESS,
        );
        if (activeSession) {
          this.currentSessionSignal.set(activeSession);
        }
      } catch {
        console.warn('Failed to load sessions from storage');
      }
    }
  }
}
