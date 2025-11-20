import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { RadioButtonModule } from 'primeng/radiobutton';
import { ProgressBarModule } from 'primeng/progressbar';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { DialogModule } from 'primeng/dialog';

import { QuizService } from '../../services/quiz.service';
import { QuizSessionService } from '../../services/quiz-session.service';
import { Quiz, QuestionScore } from '../../models/types';

@Component({
  selector: 'app-quiz-taker',
  standalone: true,
  imports: [
    CommonModule,
    ButtonModule,
    CardModule,
    RadioButtonModule,
    ProgressBarModule,
    ToastModule,
    DialogModule,
  ],
  providers: [MessageService],
  templateUrl: './quiz-taker.component.html',
  styleUrl: './quiz-taker.component.scss',
})
export class QuizTakerComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private quizStateService = inject(QuizService);
  private sessionStateService = inject(QuizSessionService);
  private messageService = inject(MessageService);

  currentSession = this.sessionStateService.currentSession;
  timeRemaining = this.sessionStateService.timeRemaining;
  isTimeRunningOut = this.sessionStateService.isTimeRunningOut;
  isTimeExpired = this.sessionStateService.isTimeExpired;

  // map of questionId to QuestionScore
  submittedAnswers = signal<Map<string, QuestionScore>>(new Map());
  currentQuestion = signal<any>(null);
  quiz = signal<Quiz | null>(null);
  currentQuestionIndex = signal(0);

  showPauseDialog = false;
  showSubmitDialog = false;

  ngOnInit(): void {
    const quizId = this.route.snapshot.paramMap.get('id');
    if (!quizId) {
      this.router.navigate(['/quizzes']);
      return;
    }

    const quiz = this.quizStateService.getQuizById(quizId);
    if (!quiz) {
      this.messageService.add({
        severity: 'error',
        summary: 'Quiz Not Found',
        detail: 'The quiz you are looking for does not exist',
      });
      this.router.navigate(['/quizzes']);
      return;
    }

    let session = this.sessionStateService.startSession(quizId);
    if (!session) {
      session = this.sessionStateService.currentSession();
    }

    if (!session) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Could not start quiz session',
      });
      this.router.navigate(['/quizzes']);
      return;
    }

    this.quiz.set(quiz);
    this.updateCurrentQuestion();
  }

  ngOnDestroy(): void {
    if (this.currentSession()?.id) {
      this.sessionStateService.leaveSession();
    }
  }

  goToQuestion(index: number): void {
    this.currentQuestionIndex.set(index);
    this.updateCurrentQuestion();
  }

  previousQuestion(): void {
    if (this.currentQuestionIndex() > 0) {
      this.currentQuestionIndex.update((i) => i - 1);
      this.updateCurrentQuestion();
    }
  }

  nextQuestion(): void {
    if (this.currentQuestionIndex() < (this.quiz()?.questions.length || 0) - 1) {
      this.currentQuestionIndex.update((i) => i + 1);
      this.updateCurrentQuestion();
    }
  }

  selectOption(optionId: string): void {
    const currentQuestion = this.currentQuestion();
    if (!currentQuestion) return;

    this.sessionStateService.recordAnswer(currentQuestion.id, optionId);
  }

  getCurrentAnswer(): string {
    const session = this.currentSession();
    const currentQuestion = this.currentQuestion();
    if (!session || !currentQuestion) return '';

    const answer = session.userAnswers.find((a) => a.questionId === currentQuestion.id);
    return answer?.selectedOptionId || '';
  }

  isQuizComplete(): boolean {
    const quiz = this.quiz();
    if (!quiz) return false;
    // check if all questions marked as required have been answered
    return quiz.questions.every((q) => {
      if (!q.required) return true;
      return this.hasSubmittedAnswer(q.id);
    });
  }

  pauseQuiz(): void {
    this.showPauseDialog = true;
  }

  confirmPauseQuiz(): void {
    this.sessionStateService.leaveSession();
    this.showPauseDialog = false;
    this.messageService.add({
      severity: 'info',
      summary: 'Quiz Paused',
      detail: 'Your progress has been saved',
    });
    this.router.navigate(['/quizzes']);
  }

  submitQuiz(): void {
    this.showSubmitDialog = true;
  }

  confirmSubmitQuiz(): void {
    const results = this.sessionStateService.completeSession();
    this.showSubmitDialog = false;

    if (results) {
      this.messageService.add({
        severity: 'success',
        summary: 'Quiz Submitted',
        detail: 'Your quiz has been submitted',
      });
      this.router.navigate(['/results', results.quizId]);
    }
  }

  formatTime(seconds: number): string {
    if (seconds <= 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  getTimeProgressPercent(): number {
    const session = this.currentSession();
    const quiz = this.quiz();
    if (!session || !quiz) return 0;

    const timeLimitMs = session.deadline - session.startTime;
    const timeRemainingSecs = this.timeRemaining();
    const totalTimeSecs = timeLimitMs / 1000;

    return Math.max(0, Math.min(100, (1 - timeRemainingSecs / totalTimeSecs) * 100));
  }

  private updateCurrentQuestion(): void {
    const quiz = this.quiz();
    if (!quiz) return;

    this.currentQuestion.set(quiz.questions[this.currentQuestionIndex()]);
  }

  hasSubmittedAnswer(questionId: string): boolean {
    return this.submittedAnswers().has(questionId);
  }

  getQuestionFeedback(questionId: string): QuestionScore | null {
    return this.submittedAnswers().get(questionId) || null;
  }

  getOptionText(optionId: string): string {
    const quiz = this.quiz();
    // shouldn't happen
    if (!quiz || !optionId) return '';

    for (const question of quiz.questions) {
      const option = question.options.find((o) => o.id === optionId);
      if (option) return option.text;
    }
    return '';
  }

  submitAnswer(): void {
    const currentQuestion = this.currentQuestion();
    const session = this.currentSession();
    const quiz = this.quiz();

    if (!currentQuestion || !session || !quiz) return;

    const currentAnswer = this.getCurrentAnswer();
    if (!currentAnswer) {
      this.messageService.add({
        severity: 'warn',
        summary: 'No Answer Selected',
        detail: 'Please select an answer before submitting',
        life: 2000,
      });
      return;
    }

    // evaluate answer
    const isCorrect = currentAnswer === currentQuestion.correctAnswerId;

    const feedback: QuestionScore = {
      questionId: currentQuestion.id,
      userAnswerId: currentAnswer,
      correctAnswerId: currentQuestion.correctAnswerId,
      isCorrect,
    };

    // store submitted answers
    const updated = new Map(this.submittedAnswers());
    updated.set(currentQuestion.id, feedback);
    this.submittedAnswers.set(updated);
  }
}
