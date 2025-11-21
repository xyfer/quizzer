import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { QuizService } from './quiz.service';
import { Quiz, QuizStatus } from '../models/types';

describe('QuizService', () => {
  let service: QuizService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), QuizService],
    });
    service = TestBed.inject(QuizService);
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('quiz creation', () => {
    it('should create a new draft quiz', () => {
      const quiz = service.createNewQuiz();
      expect(quiz.status).toBe(QuizStatus.DRAFT);
      expect(quiz.title).toBe('');
      expect(quiz.questions).toEqual([]);
    });

    it('should set currentEditingQuiz when creating a new quiz', () => {
      service.createNewQuiz();
      expect(service.currentEditingQuiz()).not.toBeNull();
    });
  });

  describe('validations', () => {
    it('should return errors for invalid quiz', () => {
      const quiz = service.createNewQuiz();
      const errors = service.validateQuiz(quiz);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors).toContain('Quiz title is required');
    });

    it('should validate a complete quiz successfully', () => {
      const quiz = service.createNewQuiz();
      quiz.title = 'Test Quiz';
      const questionId = 'q1';
      quiz.questions = [
        {
          id: questionId,
          prompt: 'What is 2+2?',
          required: true,
          pointValue: 1,
          options: [
            { id: '123', text: '3' },
            { id: '456', text: '4' },
          ],
          correctAnswerId: '456',
        },
      ];

      const errors = service.validateQuiz(quiz);
      expect(errors).toEqual([]);
    });
  });

  describe('publishing', () => {
    it('should publish a valid quiz', () => {
      const quiz = service.createNewQuiz();
      quiz.title = 'Test Quiz';
      quiz.questions = [
        {
          id: 'q1',
          prompt: 'Test?',
          required: true,
          pointValue: 1,
          options: [
            { id: 'opt1', text: 'A' },
            { id: 'opt2', text: 'B' },
          ],
          correctAnswerId: 'opt2',
        },
      ];

      const result = service.publishQuiz(quiz);
      expect(result.success).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should not publish an invalid quiz', () => {
      const quiz = service.createNewQuiz();
      const result = service.publishQuiz(quiz);
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('questions', () => {
    beforeEach(() => {
      service.createNewQuiz();
    });

    it('should add a question to current quiz', () => {
      service.addQuestion('I am a question?');
      const quiz = service.currentEditingQuiz();
      expect(quiz?.questions.length).toBe(1);
      expect(quiz?.questions[0].prompt).toBe('I am a question?');
    });

    it('should remove a question from current quiz', () => {
      service.addQuestion('Question 1');
      service.addQuestion('Question 2');
      const quiz = service.currentEditingQuiz();
      const firstQuestionId = quiz?.questions[0].id || '';

      service.removeQuestion(firstQuestionId);
      const updatedQuiz = service.currentEditingQuiz();
      expect(updatedQuiz?.questions.length).toBe(1);
      expect(updatedQuiz?.questions[0].prompt).toBe('Question 2');
    });

    it('should update a question', () => {
      service.addQuestion('Original Question');
      const quiz = service.currentEditingQuiz();
      const questionId = quiz?.questions[0].id || '';

      service.updateQuestion(questionId, { prompt: 'Updated prompt' });
      const updatedQuiz = service.currentEditingQuiz();
      expect(updatedQuiz?.questions[0].prompt).toBe('Updated prompt');
    });
  });

  describe('options', () => {
    beforeEach(() => {
      service.createNewQuiz();
      service.addQuestion('Test question?');
    });

    it('should add an option to a question', () => {
      const quiz = service.currentEditingQuiz();
      const questionId = quiz?.questions[0].id || '';

      service.addOptionToQuestion(questionId);
      const updatedQuiz = service.currentEditingQuiz();
      expect(updatedQuiz?.questions[0].options.length).toBe(3);
    });

    it('should update option text', () => {
      const quiz = service.currentEditingQuiz();
      const questionId = quiz?.questions[0].id || '';
      const optionId = quiz?.questions[0].options[0].id || '';

      service.updateOption(questionId, optionId, 'Updated option');
      const updatedQuiz = service.currentEditingQuiz();
      expect(updatedQuiz?.questions[0].options[0].text).toBe('Updated option');
    });

    it('should not remove option if fewer than 2 remain', () => {
      const quiz = service.currentEditingQuiz();
      const questionId = quiz?.questions[0].id || '';
      const option1 = quiz?.questions[0].options[0].id || '';
      const option2 = quiz?.questions[0].options[1].id || '';

      service.removeOptionFromQuestion(questionId, option1);
      service.removeOptionFromQuestion(questionId, option2);
      const updatedQuiz = service.currentEditingQuiz();
      expect(updatedQuiz?.questions[0].options.length).toBe(2);
    });
  });
});
