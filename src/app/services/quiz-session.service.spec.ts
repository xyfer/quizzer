import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { QuizSessionService } from './quiz-session.service';
import { QuizService } from './quiz.service';
import { Quiz, QuizStatus, Status } from '../models/types';

describe('QuizSessionService', () => {
  let service: QuizSessionService;
  let quizService: QuizService;
  let testQuiz: Quiz;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), QuizService, QuizSessionService],
    });
    service = TestBed.inject(QuizSessionService);
    quizService = TestBed.inject(QuizService);
    localStorage.clear();

    // test quiz to be used in tests
    testQuiz = {
      id: 'test-quiz-1',
      title: 'Test Quiz',
      description: 'A test quiz',
      timeLimitValue: 1,
      shuffleQuestions: false,
      questions: [
        {
          id: 'q1',
          prompt: 'What is 2+2?',
          required: true,
          pointValue: 1,
          options: [
            { id: 'opt1', text: '3' },
            { id: 'opt2', text: '4' },
          ],
          correctAnswerId: 'opt2',
        },
        {
          id: 'q2',
          prompt: 'What is 3+3?',
          required: true,
          pointValue: 2,
          options: [
            { id: 'opt3', text: '5' },
            { id: 'opt4', text: '6' },
          ],
          correctAnswerId: 'opt4',
        },
      ],
      status: QuizStatus.PUBLISHED,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    // add quiz to quizService by saving it
    quizService.saveDraftQuiz(testQuiz);
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('Session Management', () => {
    it('should start a new session', () => {
      const session = service.startSession('test-quiz-1');
      expect(session).not.toBeNull();
      expect(session?.status).toBe(Status.IN_PROGRESS);
      expect(session?.quizId).toBe('test-quiz-1');
      expect(session?.userAnswers).toEqual([]);
    });

    it('should return null when starting session with non-existent quiz', () => {
      const session = service.startSession('non-existent-quiz');
      expect(session).toBeNull();
    });

    it('should return existing in-progress session', () => {
      const session1 = service.startSession('test-quiz-1');
      const session2 = service.startSession('test-quiz-1');
      expect(session1?.id).toBe(session2?.id);
    });

    it('should set current session when starting', () => {
      service.startSession('test-quiz-1');
      expect(service.currentSession()).not.toBeNull();
      expect(service.currentSession()?.quizId).toBe('test-quiz-1');
    });

    it('should leave session', () => {
      service.startSession('test-quiz-1');
      service.leaveSession();
      expect(service.currentSession()).toBeNull();
    });
  });

  describe('answers', () => {
    beforeEach(() => {
      service.startSession('test-quiz-1');
    });

    it('should record an answer', () => {
      service.recordAnswer('q1', 'opt2');
      const session = service.currentSession();
      expect(session?.userAnswers).toEqual(
        jasmine.arrayContaining([
          {
            questionId: 'q1',
            selectedOptionId: 'opt2',
          },
        ])
      );
    });

    it('should update an existing answer', () => {
      service.recordAnswer('q1', 'opt1');
      service.recordAnswer('q1', 'opt2');
      const session = service.currentSession();
      expect(session?.userAnswers.length).toBe(1);
      expect(session?.userAnswers[0].selectedOptionId).toBe('opt2');
    });

    it('should record multiple different answers', () => {
      service.recordAnswer('q1', 'opt1');
      service.recordAnswer('q2', 'opt3');
      const session = service.currentSession();
      expect(session?.userAnswers.length).toBe(2);
    });

    it('should not record answer when no active session', () => {
      service.leaveSession();
      service.recordAnswer('q1', 'opt1');
      expect(service.currentSession()).toBeNull();
    });
  });

  describe('submitting', () => {
    beforeEach(() => {
      service.startSession('test-quiz-1');
    });

    it('should mark question as submitted', () => {
      service.submitAnswer('q1');
      const session = service.currentSession();
      expect(session?.submittedQuestionIds).toContain('q1');
    });

    it('should not add duplicate submitted questions', () => {
      service.submitAnswer('q1');
      service.submitAnswer('q1');
      const session = service.currentSession();
      expect(session?.submittedQuestionIds.length).toBe(1);
    });

    it('should not submit answer when no active session', () => {
      service.leaveSession();
      service.submitAnswer('q1');
      expect(service.currentSession()).toBeNull();
    });
  });

  describe('quiz completion', () => {
    it('should calculate correct results for all correct answers', () => {
      service.startSession('test-quiz-1');
      service.recordAnswer('q1', 'opt2');
      service.recordAnswer('q2', 'opt4');
      const results = service.completeSession();

      expect(results).not.toBeNull();
      expect(results?.score).toBe(3);
      expect(results?.maxScore).toBe(3);
      expect(results?.percentage).toBe(100);
      expect(results?.questionScores.every((qs) => qs.isCorrect)).toBe(true);
    });

    it('should calculate correct results for partial correct answers', () => {
      service.startSession('test-quiz-1');
      service.recordAnswer('q1', 'opt1'); // incorrect
      service.recordAnswer('q2', 'opt4'); // correct
      const results = service.completeSession();

      expect(results?.score).toBe(2);
      expect(results?.maxScore).toBe(3);
      expect(results?.percentage).toBe(67);
      expect(results?.questionScores[0].isCorrect).toBe(false);
      expect(results?.questionScores[1].isCorrect).toBe(true);
    });

    it('should calculate correct results for all incorrect answers', () => {
      service.startSession('test-quiz-1');
      service.recordAnswer('q1', 'opt1');
      service.recordAnswer('q2', 'opt3'); 
      const results = service.completeSession();

      expect(results?.score).toBe(0);
      expect(results?.maxScore).toBe(3);
      expect(results?.percentage).toBe(0);
    });

    it('should handle unanswered questions', () => {
      service.startSession('test-quiz-1');
      service.recordAnswer('q1', 'opt2');
      // q2 is not answered
      const results = service.completeSession();

      expect(results?.score).toBe(1);
      expect(results?.questionScores[1].isCorrect).toBe(false);
      expect(results?.questionScores[1].userAnswerId).toBe('');
    });

    it('should return null when completing with no active session', () => {
      const results = service.completeSession();
      expect(results).toBeNull();
    });

    it('should store results in resultsSignal', () => {
      service.startSession('test-quiz-1');
      service.recordAnswer('q1', 'opt2');
      service.completeSession();

      const results = service.getResultsForQuiz('test-quiz-1');
      expect(results).toBeDefined();
      expect(results?.quizId).toBe('test-quiz-1');
    });

    it('should clear current session after completion', () => {
      service.startSession('test-quiz-1');
      service.completeSession();
      expect(service.currentSession()).toBeNull();
    });
  });

  describe('local storage', () => {
    it('should persist session to localStorage', () => {
      service.startSession('test-quiz-1');
      service.recordAnswer('q1', 'opt2');

      const stored = localStorage.getItem('quizzer-sessions');
      expect(stored).toBeTruthy();
      const data = JSON.parse(stored || '{}');
      expect(data.sessions.length).toBe(1);
      expect(data.sessions[0].userAnswers).toEqual(
        jasmine.arrayContaining([
          {
            questionId: 'q1',
            selectedOptionId: 'opt2',
          },
        ])
      );
    });

    it('should load sessions from localStorage on initialization', () => {
      localStorage.clear();
      sessionStorage.clear();

      const mockSession = {
        id: 'session-1',
        quizId: 'test-quiz-1',
        status: Status.IN_PROGRESS,
        startTime: Date.now(),
        deadline: Date.now() + 60000,
        userAnswers: [],
        submittedQuestionIds: [],
      };

      const data = {
        sessions: [mockSession],
        results: [],
      };

      localStorage.setItem('quizzer-sessions', JSON.stringify(data));

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [provideZonelessChangeDetection(), QuizService, QuizSessionService],
      });

      const newService = TestBed.inject(QuizSessionService);
      expect(newService.sessions().length).toBe(1);
      expect(newService.sessions()[0].id).toBe('session-1');
    });

    it('should restore active session from localStorage', () => {
      localStorage.clear();
      sessionStorage.clear();

      const mockSession = {
        id: 'session-1',
        quizId: 'test-quiz-1',
        status: Status.IN_PROGRESS,
        startTime: Date.now(),
        deadline: Date.now() + 60000,
        userAnswers: [],
        submittedQuestionIds: [],
      };

      const data = {
        sessions: [mockSession],
        results: [],
      };

      localStorage.setItem('quizzer-sessions', JSON.stringify(data));

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [provideZonelessChangeDetection(), QuizService, QuizSessionService],
      });

      const newService = TestBed.inject(QuizSessionService);
      expect(newService.currentSession()?.id).toBe('session-1');
    });

    it('should persist results to localStorage', () => {
      service.startSession('test-quiz-1');
      service.recordAnswer('q1', 'opt2');
      service.completeSession();

      const stored = localStorage.getItem('quizzer-sessions');
      const data = JSON.parse(stored || '{}');
      expect(data.results.length).toBe(1);
      expect(data.results[0].quizId).toBe('test-quiz-1');
    });
  });
});
