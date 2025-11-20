import { TestBed, fakeAsync } from '@angular/core/testing';
import { Status, TimeUnit } from '../models/types';
import { QuizSessionService } from './quiz-session.service';
import { QuizService } from './quiz.service';

describe('QuizSessionService', () => {
  let service: QuizSessionService;
  let quizStateService: QuizService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [QuizSessionService, QuizService],
    });
    service = TestBed.inject(QuizSessionService);
    quizStateService = TestBed.inject(QuizService);

    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('Session Lifecycle', () => {
    it('should start a new session', () => {
      quizStateService.createNewQuiz();
      quizStateService.updateQuizMetadata({
        title: 'Test Quiz',
        timeLimitValue: 1,
        timeLimitUnit: TimeUnit.MINUTES,
      });
      quizStateService.addQuestion();

      const quiz = quizStateService.currentEditingQuiz()!;
      const question = quiz.questions[0];
      question.prompt = 'Q?';
      question.options[0].text = 'O1';
      question.options[1].text = 'O2';
      question.correctAnswerId = question.options[0].id;
      quizStateService.updateQuestion(question.id, question);
      quizStateService.publishQuiz(quiz);

      const session = service.startSession(quiz.id);
      expect(session).toBeTruthy();
      expect(session?.status).toBe(Status.IN_PROGRESS);
      expect(session?.userAnswers.length).toBe(0);
    });

    it('should resume existing session', () => {
      quizStateService.createNewQuiz();
      quizStateService.updateQuizMetadata({
        title: 'Test',
        timeLimitValue: 1,
        timeLimitUnit: TimeUnit.MINUTES,
      });
      quizStateService.addQuestion();

      const quiz = quizStateService.currentEditingQuiz()!;
      const question = quiz.questions[0];
      question.prompt = 'Q?';
      question.options[0].text = 'O1';
      question.options[1].text = 'O2';
      question.correctAnswerId = question.options[0].id;
      quizStateService.updateQuestion(question.id, question);
      quizStateService.publishQuiz(quiz);

      const session1 = service.startSession(quiz.id);
      service.leaveSession();

      const session2 = service.startSession(quiz.id);
      expect(session2?.id).toBe(session1?.id);
    });

    it('should not start session for non-existent quiz', () => {
      const session = service.startSession('non-existent');
      expect(session).toBeNull();
    });
  });

  describe('Answer Recording', () => {
    let quizId: string;
    let questionId: string;

    beforeEach(() => {
      quizStateService.createNewQuiz();
      quizStateService.updateQuizMetadata({
        title: 'Test',
        timeLimitValue: 5,
        timeLimitUnit: TimeUnit.MINUTES,
      });
      quizStateService.addQuestion();

      const quiz = quizStateService.currentEditingQuiz()!;
      const question = quiz.questions[0];
      question.prompt = 'Q?';
      question.options[0].text = 'O1';
      question.options[1].text = 'O2';
      question.correctAnswerId = question.options[0].id;
      quizStateService.updateQuestion(question.id, question);
      quizStateService.publishQuiz(quiz);
      quizId = quiz.id;
      questionId = quiz.questions[0].id;

      service.startSession(quizId);
    });

    it('should record an answer', () => {
      const session = service.currentSession()!;
      const optionId = quizStateService.getQuizById(quizId)!.questions[0].options[0].id;

      service.recordAnswer(questionId, optionId);

      const updated = service.currentSession()!;
      expect(updated.userAnswers.length).toBe(1);
      expect(updated.userAnswers[0].questionId).toBe(questionId);
      expect(updated.userAnswers[0].selectedOptionId).toBe(optionId);
    });

    it('should update existing answer', () => {
      const quiz = quizStateService.getQuizById(quizId)!;
      const optionId1 = quiz.questions[0].options[0].id;
      const optionId2 = quiz.questions[0].options[1].id;

      service.recordAnswer(questionId, optionId1);
      service.recordAnswer(questionId, optionId2);

      const session = service.currentSession()!;
      expect(session.userAnswers.length).toBe(1);
      expect(session.userAnswers[0].selectedOptionId).toBe(optionId2);
    });

    it('should not record answer if session not in progress', () => {
      // currentSession is null
      const quiz = quizStateService.getQuizById(quizId)!;
      const optionId = quiz.questions[0].options[0].id;

      service.recordAnswer(questionId, optionId);

      const session = service.currentSession();
      expect(session).toBeNull();
    });
  });

  describe('Scoring and Results', () => {
    let quizId: string;

    beforeEach(() => {
      const newQuiz = quizStateService.createNewQuiz();
      quizStateService.updateQuizMetadata({
        title: 'Scoring Test',
        timeLimitValue: 5,
        timeLimitUnit: TimeUnit.MINUTES,
      });

      quizStateService.addQuestion();
      quizStateService.addQuestion();

      const quiz = quizStateService.currentEditingQuiz()!;
      quizId = quiz.id;

      const q1 = quiz.questions[0];
      q1.prompt = 'Q1?';
      q1.pointValue = 2;
      q1.options[0].text = 'Correct';
      q1.options[1].text = 'Wrong';
      q1.correctAnswerId = q1.options[0].id;
      quizStateService.updateQuestion(q1.id, q1);

      const q2 = quiz.questions[1];
      q2.prompt = 'Q2?';
      q2.pointValue = 3;
      q2.options[0].text = 'Wrong';
      q2.options[1].text = 'Correct';
      q2.correctAnswerId = q2.options[1].id;
      quizStateService.updateQuestion(q2.id, q2);

      quizStateService.publishQuiz(quiz);
    });

    it('should calculate correct scores', () => {
      const quiz = quizStateService.getQuizById(quizId)!;
      service.startSession(quizId);

      service.recordAnswer(quiz.questions[0].id, quiz.questions[0].correctAnswerId);
      service.recordAnswer(quiz.questions[1].id, quiz.questions[1].correctAnswerId);

      const results = service.completeSession();

      expect(results?.score).toBe(5);
      expect(results?.maxScore).toBe(5);
      expect(results?.percentage).toBe(100);
    });

    it('should calculate partial scores', () => {
      const quiz = quizStateService.getQuizById(quizId)!;
      service.startSession(quizId);

      service.recordAnswer(quiz.questions[0].id, quiz.questions[0].correctAnswerId);
      service.recordAnswer(quiz.questions[1].id, quiz.questions[1].options[0].id);

      const results = service.completeSession();

      expect(results?.score).toBe(2);
      expect(results?.maxScore).toBe(5);
      expect(results?.percentage).toBe(40);
    });

    it('should calculate zero scores', () => {
      const quiz = quizStateService.getQuizById(quizId)!;
      service.startSession(quizId);

      service.recordAnswer(quiz.questions[0].id, quiz.questions[0].options[1].id);
      service.recordAnswer(quiz.questions[1].id, quiz.questions[1].options[0].id);

      const results = service.completeSession();

      expect(results?.score).toBe(0);
      expect(results?.percentage).toBe(0);
    });

    it('should handle unanswered questions as zero score', () => {
      service.startSession(quizId);

      const results = service.completeSession();

      expect(results?.score).toBe(0);
      expect(results?.percentage).toBe(0);
    });

    it('should provide per-question breakdown', () => {
      const quiz = quizStateService.getQuizById(quizId)!;
      service.startSession(quizId);

      service.recordAnswer(quiz.questions[0].id, quiz.questions[0].correctAnswerId);
      service.recordAnswer(quiz.questions[1].id, quiz.questions[1].options[0].id);

      const results = service.completeSession();

      expect(results?.questionScores.length).toBe(2);
      expect(results?.questionScores[0].isCorrect).toBe(true);
      expect(results?.questionScores[1].isCorrect).toBe(false);
    });
  });

  describe('Persistence', () => {
    it('should persist sessions to localStorage', () => {
      quizStateService.createNewQuiz();
      quizStateService.updateQuizMetadata({
        title: 'Test',
        timeLimitValue: 5,
        timeLimitUnit: TimeUnit.MINUTES,
      });
      quizStateService.addQuestion();

      const quiz = quizStateService.currentEditingQuiz()!;
      const question = quiz.questions[0];
      question.prompt = 'Q?';
      question.options[0].text = 'O1';
      question.options[1].text = 'O2';
      question.correctAnswerId = question.options[0].id;
      quizStateService.updateQuestion(question.id, question);
      quizStateService.publishQuiz(quiz);

      service.startSession(quiz.id);

      const stored = localStorage.getItem('quizzer-sessions');
      expect(stored).toBeTruthy();

      const data = JSON.parse(stored!);
      expect(data.sessions.length).toBeGreaterThan(0);
    });

    it('should restore sessions from localStorage', () => {
      const sessions = [
        {
          id: 'session-1',
          quizId: 'quiz-1',
          status: Status.IN_PROGRESS,
          startTime: Date.now(),
          deadline: Date.now() + 60000,
          userAnswers: [],
        },
      ];

      localStorage.setItem('quizzer-sessions', JSON.stringify({ sessions, results: [] }));

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [QuizSessionService, QuizService],
      });
      service = TestBed.inject(QuizSessionService);

      expect(service.sessions().length).toBeGreaterThan(0);
    });
  });

  describe('Time Tracking', () => {
    it('should compute time remaining', fakeAsync(() => {
      quizStateService.createNewQuiz();
      quizStateService.updateQuizMetadata({
        title: 'Test',
        timeLimitValue: 2,
        timeLimitUnit: TimeUnit.SECONDS,
      });
      quizStateService.addQuestion();

      const quiz = quizStateService.currentEditingQuiz()!;
      const question = quiz.questions[0];
      question.prompt = 'Q?';
      question.options[0].text = 'O1';
      question.options[1].text = 'O2';
      question.correctAnswerId = question.options[0].id;
      quizStateService.updateQuestion(question.id, question);
      quizStateService.publishQuiz(quiz);

      service.startSession(quiz.id);

      expect(service.timeRemaining()).toBeGreaterThan(0);
      expect(service.timeRemaining()).toBeLessThanOrEqual(2);
    }));
  });

  describe('Query Methods', () => {
    it('should get results for quiz', () => {
      quizStateService.createNewQuiz();
      quizStateService.updateQuizMetadata({
        title: 'Test',
        timeLimitValue: 5,
        timeLimitUnit: TimeUnit.MINUTES,
      });
      quizStateService.addQuestion();

      const quiz = quizStateService.currentEditingQuiz()!;
      const question = quiz.questions[0];
      question.prompt = 'Q?';
      question.options[0].text = 'O1';
      question.options[1].text = 'O2';
      question.correctAnswerId = question.options[0].id;
      quizStateService.updateQuestion(question.id, question);
      quizStateService.publishQuiz(quiz);

      service.startSession(quiz.id);
      const results = service.completeSession();

      if (results) {
        const retrieved = service.getResultsForQuiz(results.quizId);
        expect(retrieved).toEqual(results);
      }
    });
  });
});
