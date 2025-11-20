import { Injectable, signal, computed } from '@angular/core';
import { Quiz, QuizStatus, QuizQuestion, TimeUnit, QuizOption } from '../models/types';

// responsible for the state of all quizzes, both drafted and published
@Injectable({
  providedIn: 'root',
})
export class QuizService {
  // all quizzes, private signal
  private quizzesSignal = signal<Quiz[]>([]);
  // public computed signal, readonly
  quizzes = computed(() => this.quizzesSignal());
  // currently editing quiz, private signal
  private currentEditingQuizSignal = signal<Quiz | null>(null);
  // public computed signal, readonly
  currentEditingQuiz = computed(() => this.currentEditingQuizSignal());

  // only published quizzes
  publishedQuizzes = computed(() =>
    this.quizzesSignal().filter((q) => q.status === QuizStatus.PUBLISHED),
  );

  // only draft quizzes
  draftQuizzes = computed(() => this.quizzesSignal().filter((q) => q.status === QuizStatus.DRAFT));

  isQuizValid = computed(() => {
    const quiz = this.currentEditingQuizSignal();
    if (!quiz) return false;
    return this.validateQuiz(quiz).length === 0;
  });

  constructor() {
    this.loadQuizzesFromStorage();
  }

  createNewQuiz(): Quiz {
    const quiz: Quiz = {
      id: this.generateId(),
      title: '',
      description: '',
      timeLimitValue: 30,
      timeLimitUnit: TimeUnit.MINUTES,
      shuffleQuestions: false,
      questions: [],
      status: QuizStatus.DRAFT,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.currentEditingQuizSignal.set(quiz);
    return quiz;
  }

  loadQuizForEditing(quizId: string): Quiz | null {
    const quiz = this.quizzesSignal().find((q) => q.id === quizId);
    if (!quiz) return null;

    if (quiz.status === QuizStatus.PUBLISHED) {
      throw new Error('Cannot edit a published quiz');
    }

    // use this json trick to create a deep copy
    const editableCopy: Quiz = JSON.parse(JSON.stringify(quiz));
    this.currentEditingQuizSignal.set(editableCopy);
    return editableCopy;
  }

  saveDraftQuiz(quiz: Quiz): void {
    const updated = { ...quiz, status: QuizStatus.DRAFT, updatedAt: Date.now() };
    const index = this.quizzesSignal().findIndex((q) => q.id === quiz.id);

    const quizzes = [...this.quizzesSignal()];
    if (index >= 0) {
      quizzes[index] = updated;
    } else {
      quizzes.push(updated);
    }

    this.quizzesSignal.set(quizzes);
    this.saveQuizzesToStorage();
    this.currentEditingQuizSignal.set(updated);
  }

  publishQuiz(quiz: Quiz): { success: boolean; errors: string[] } {
    const errors = this.validateQuiz(quiz);
    if (errors.length > 0) {
      return { success: false, errors };
    }

    const published = { ...quiz, status: QuizStatus.PUBLISHED, updatedAt: Date.now() };
    const index = this.quizzesSignal().findIndex((q) => q.id === quiz.id);

    const quizzes = [...this.quizzesSignal()];
    if (index >= 0) {
      quizzes[index] = published;
    } else {
      quizzes.push(published);
    }

    this.quizzesSignal.set(quizzes);
    this.saveQuizzesToStorage();
    this.currentEditingQuizSignal.set(null);
    return { success: true, errors: [] };
  }

  // only available if we are editing a quiz
  discardQuiz(): void {
    this.currentEditingQuizSignal.set(null);
  }

  getQuizById(id: string): Quiz | undefined {
    return this.quizzesSignal().find((q) => q.id === id);
  }

  deleteQuiz(quizId: string): boolean {
    const quiz = this.getQuizById(quizId);
    if (!quiz) return false;

    if (quiz.status !== QuizStatus.DRAFT) {
      throw new Error('Can only delete draft quizzes');
    }

    this.quizzesSignal.set(this.quizzesSignal().filter((q) => q.id !== quizId));
    this.saveQuizzesToStorage();

    if (this.currentEditingQuizSignal()?.id === quizId) {
      this.currentEditingQuizSignal.set(null);
    }

    return true;
  }

  addQuestion(prompt: string = '', required: boolean = true): void {
    const quiz = this.currentEditingQuizSignal();
    if (!quiz) return;

    const newQuestion: QuizQuestion = {
      id: this.generateId(),
      prompt,
      required,
      pointValue: 1,
      options: [
        { id: this.generateId(), text: '' },
        { id: this.generateId(), text: '' },
      ],
      correctAnswerId: '',
    };

    const updated: Quiz = {
      ...quiz,
      questions: [...quiz.questions, newQuestion],
      updatedAt: Date.now(),
    };

    this.currentEditingQuizSignal.set(updated);
  }

  removeQuestion(questionId: string): void {
    const quiz = this.currentEditingQuizSignal();
    if (!quiz) return;

    const updated: Quiz = {
      ...quiz,
      questions: quiz.questions.filter((q) => q.id !== questionId),
      updatedAt: Date.now(),
    };

    this.currentEditingQuizSignal.set(updated);
  }

  updateQuestion(questionId: string, updates: Partial<QuizQuestion>): void {
    const quiz = this.currentEditingQuizSignal();
    if (!quiz) return;

    const updated: Quiz = {
      ...quiz,
      questions: quiz.questions.map((q) => (q.id === questionId ? { ...q, ...updates } : q)),
      updatedAt: Date.now(),
    };

    this.currentEditingQuizSignal.set(updated);
  }

  addOptionToQuestion(questionId: string): void {
    const quiz = this.currentEditingQuizSignal();
    if (!quiz) return;

    const updated: Quiz = {
      ...quiz,
      questions: quiz.questions.map((q) => {
        if (q.id === questionId) {
          return {
            ...q,
            options: [...q.options, { id: this.generateId(), text: '' }],
          };
        }
        return q;
      }),
      updatedAt: Date.now(),
    };

    this.currentEditingQuizSignal.set(updated);
  }

  removeOptionFromQuestion(questionId: string, optionId: string): void {
    const quiz = this.currentEditingQuizSignal();
    if (!quiz) return;

    const updated: Quiz = {
      ...quiz,
      questions: quiz.questions.map((q) => {
        if (q.id === questionId && q.options.length > 2) {
          return {
            ...q,
            options: q.options.filter((o) => o.id !== optionId),
          };
        }
        return q;
      }),
      updatedAt: Date.now(),
    };

    this.currentEditingQuizSignal.set(updated);
  }

  updateOption(questionId: string, optionId: string, text: string): void {
    const quiz = this.currentEditingQuizSignal();
    if (!quiz) return;

    const updated: Quiz = {
      ...quiz,
      questions: quiz.questions.map((question) => {
        if (question.id === questionId) {
          return {
            ...question,
            options: question.options.map((option) =>
              option.id === optionId ? { ...option, text } : option,
            ),
          };
        }
        return question;
      }),
      updatedAt: Date.now(),
    };

    this.currentEditingQuizSignal.set(updated);
  }

  validateQuiz(quiz: Quiz): string[] {
    const errors: string[] = [];

    if (!quiz.title?.trim()) {
      errors.push('Quiz title is required');
    }

    if (quiz.questions.length === 0) {
      errors.push('Quiz must have at least one question');
    }

    quiz.questions.forEach((question, index) => {
      const questionNum = index + 1;
      if (!question.prompt?.trim()) {
        errors.push(`Question ${questionNum}: Prompt is required`);
      }

      if (question.options.length < 2) {
        errors.push(`Question ${questionNum}: Must have at least 2 options`);
      }

      if (!question.correctAnswerId) {
        errors.push(`Question ${questionNum}: Correct answer is required`);
      }

      const hasCorrectOption = question.options.some(
        (option) => option.id === question.correctAnswerId,
      );
      if (!hasCorrectOption) {
        errors.push(`Question ${questionNum}: Correct answer must be one of the options`);
      }

      question.options.forEach((option, optionIndex) => {
        const optionNum = optionIndex + 1;
        if (!option.text?.trim()) {
          errors.push(`Question ${questionNum}, Option ${optionNum}: Text is required`);
        }
      });
    });

    return errors;
  }

  getValidationErrors(): string[] {
    const quiz = this.currentEditingQuizSignal();
    if (!quiz) return [];
    return this.validateQuiz(quiz);
  }

  updateQuizMetadata(updates: {
    title?: string;
    description?: string;
    timeLimitValue?: number;
    timeLimitUnit?: TimeUnit;
    shuffleQuestions?: boolean;
  }): void {
    const quiz = this.currentEditingQuizSignal();
    if (!quiz) return;

    const updated: Quiz = {
      ...quiz,
      ...updates,
      updatedAt: Date.now(),
    };

    this.currentEditingQuizSignal.set(updated);
  }

  private generateId(): string {
    return crypto.randomUUID();
  }

  private initSampleQuiz(): void {
    const sampleQuiz: Quiz = {
      id: this.generateId(),
      title: 'Astro Quiz',
      description: 'What do you know about astronomy?',
      timeLimitValue: 10,
      timeLimitUnit: TimeUnit.MINUTES,
      shuffleQuestions: false,
      questions: [
        {
          id: this.generateId(),
          prompt: 'What is the largest moon in the Solar System?',
          required: true,
          pointValue: 1,
          options: [
            { id: this.generateId(), text: 'Titan' },
            { id: this.generateId(), text: 'Europa' },
            { id: this.generateId(), text: 'Ganymede' },
            { id: this.generateId(), text: 'Io' },
          ],
          correctAnswerId: '',
        },
      ],
      status: QuizStatus.PUBLISHED,
      createdAt: Date.now() - 86400000,
      updatedAt: Date.now() - 86400000,
    };

    // set the right answer since we don't know the id beforehand
    if (sampleQuiz.questions[0].options.length > 0) {
      sampleQuiz.questions[0].correctAnswerId = sampleQuiz.questions[0].options[2].id;
    }

    this.quizzesSignal.set([sampleQuiz]);
    this.saveQuizzesToStorage(); // persist sample quiz
  }

  private loadQuizzesFromStorage(): void {
    const stored = localStorage.getItem('quizzer-quizzes');
    if (stored) {
      try {
        const quizzes = JSON.parse(stored);
        this.quizzesSignal.set(quizzes);
        return; // we found some quizzes, don't init sample
      } catch {
        console.warn('Failed to load quizzes from storage');
      }
    }
    // if no quizzes found in storage, populate with sample quiz
    this.initSampleQuiz();
  }

  private saveQuizzesToStorage(): void {
    const quizzes = this.quizzesSignal();
    localStorage.setItem('quizzer-quizzes', JSON.stringify(quizzes));
  }
}
