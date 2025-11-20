import { Component, OnInit, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { ConfirmationService, MessageService } from 'primeng/api';

import { QuizService } from '../../services/quiz.service';
import { QuizSessionService } from '../../services/quiz-session.service';
import { Status, QuizMetadata } from '../../models/types';

@Component({
  selector: 'app-quiz-list',
  standalone: true,
  imports: [
    CommonModule,
    ButtonModule,
    CardModule,
    ConfirmDialogModule,
    TableModule,
    TagModule,
    ToastModule,
    TooltipModule,
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './quiz-list.component.html',
  styleUrl: './quiz-list.component.scss',
})
export class QuizListComponent implements OnInit {
  private quizStateService = inject(QuizService);
  private sessionStateService = inject(QuizSessionService);
  private router = inject(Router);
  private messageService = inject(MessageService);
  private confirmationService = inject(ConfirmationService);

  DisplayStatus = Status;

  quizzes = this.quizStateService.quizzes;
  sessions = this.sessionStateService.sessions;

  quizzesWithStatus = computed(() => {
    const quizzes = this.quizzes();
    const sessions = this.sessions();

    return quizzes.map((quiz) => {
      const session = sessions.find((s) => s.quizId === quiz.id);
      const result = this.sessionStateService.getResultsForQuiz(quiz.id);

      let displayStatus: Status = Status.NOT_STARTED;

      if (session) {
        if (session.status === Status.IN_PROGRESS) {
          displayStatus = Status.IN_PROGRESS;
        } else if (session.status === Status.COMPLETED) {
          displayStatus = Status.COMPLETED;
        }
      } else if (result) {
        displayStatus = Status.COMPLETED;
      }

      return { quiz, session, results: result, displayStatus } as QuizMetadata;
    });
  });

  ngOnInit(): void {}

  createNewQuiz(): void {
    this.quizStateService.createNewQuiz();
    this.router.navigate(['/builder']);
  }

  editQuiz(quizId: string): void {
    const quiz = this.quizStateService.loadQuizForEditing(quizId);
    if (quiz) {
      this.router.navigate(['/builder']);
    } else {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Cannot edit this quiz',
      });
    }
  }

  startQuiz(quizId: string): void {
    const session = this.sessionStateService.startSession(quizId);
    if (session) {
      this.router.navigate(['/quiz', quizId]);
    }
  }

  resumeQuiz(quizId: string): void {
    const quiz = this.quizStateService.getQuizById(quizId);
    if (quiz) {
      this.router.navigate(['/quiz', quizId]);
    }
  }

  viewResults(quizId: string): void {
    this.router.navigate(['/results', quizId]);
  }

  retakeQuiz(quizId: string): void {
    this.sessionStateService.startSession(quizId);
    this.router.navigate(['/quiz', quizId]);
  }

  deleteQuiz(quizId: string): void {
    this.confirmationService.confirm({
      message: 'Are you sure you want to delete this quiz? This action cannot be undone.',
      header: 'Confirm',
      icon: 'pi pi-exclamation-triangle',
      accept: () => {
        this.quizStateService.deleteQuiz(quizId);
        this.messageService.add({
          severity: 'success',
          summary: 'Deleted',
          detail: 'Quiz has been deleted',
        });
      },
    });
  }

  getStatusSeverity(status: Status): any {
    switch (status) {
      case Status.NOT_STARTED:
        return 'info';
      case Status.IN_PROGRESS:
        return 'warn';
      case Status.COMPLETED:
        return 'success';
      default:
        return 'secondary';
    }
  }
}
