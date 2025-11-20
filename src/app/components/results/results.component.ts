import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { TagModule } from 'primeng/tag';
import { ProgressBarModule } from 'primeng/progressbar';
import { signal } from '@angular/core';

import { QuizService } from '../../services/quiz.service';
import { QuizSessionService } from '../../services/quiz-session.service';
import { QuizResults, Quiz } from '../../models/types';

@Component({
  selector: 'app-results',
  standalone: true,
  imports: [
    CommonModule,
    ButtonModule,
    CardModule,
    TableModule,
    ToastModule,
    TagModule,
    ProgressBarModule,
  ],
  providers: [MessageService],
  templateUrl: './results.component.html',
  styleUrl: './results.component.scss',
})
export class ResultsComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private quizStateService = inject(QuizService);
  private sessionStateService = inject(QuizSessionService);
  private messageService = inject(MessageService);

  results = signal<QuizResults | null>(null);
  quiz = signal<Quiz | null>(null);

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

    const results = this.sessionStateService.getResultsForQuiz(quizId);

    if (!results) {
      this.messageService.add({
        severity: 'error',
        summary: 'Results Not Found',
        detail: 'No results found for this quiz',
      });
      this.router.navigate(['/quizzes']);
      return;
    }

    this.quiz.set(quiz);
    this.results.set(results);
  }

  getQuestionText(questionId: string): string {
    const quiz = this.quiz();
    if (!quiz) return '';

    const question = quiz.questions.find((q) => q.id === questionId);
    return question?.prompt || '';
  }

  getOptionText(questionId: string, optionId: string): string {
    const quiz = this.quiz();
    if (!quiz || !optionId) return '';

    const question = quiz.questions.find((q) => q.id === questionId);
    if (!question) return '';

    const option = question.options.find((o) => o.id === optionId);
    return option?.text || '';
  }

  getQuestionPointValue(questionId: string): number {
    const quiz = this.quiz();
    if (!quiz) return 0;

    const question = quiz.questions.find((q) => q.id === questionId);
    return question?.pointValue || 0;
  }

  backToQuizzes(): void {
    this.router.navigate(['/quizzes']);
  }

  retakeQuiz(): void {
    const results = this.results();
    if (results) {
      this.router.navigate(['/quiz', results.quizId]);
    }
  }
}
