import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { ToastModule } from 'primeng/toast';

import { QuizQuestion, TimeUnit } from '../../models/types';
import { QuizService } from '../../services/quiz.service';
import { QuestionEditorComponent } from '../question-editor/question-editor.component';

@Component({
  selector: 'app-quiz-builder',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    InputTextModule,
    InputNumberModule,
    SelectModule,
    CardModule,
    ToastModule,
    DialogModule,
    QuestionEditorComponent,
  ],
  providers: [MessageService],
  templateUrl: './quiz-builder.component.html',
  styleUrl: './quiz-builder.component.scss',
})
export class QuizBuilderComponent implements OnInit {
  private quizStateService = inject(QuizService);
  private messageService = inject(MessageService);
  private router = inject(Router);

  currentQuiz = this.quizStateService.currentEditingQuiz;
  isValid = this.quizStateService.isQuizValid;

  timeUnits = [
    { label: 'Seconds', value: TimeUnit.SECONDS },
    { label: 'Minutes', value: TimeUnit.MINUTES },
  ];

  showValidationDialog = signal(false);
  validationErrorsList: string[] = [];

  ngOnInit(): void {
    if (!this.currentQuiz()) {
      this.quizStateService.createNewQuiz();
    }
  }

  updateQuizTitle(title: string): void {
    this.quizStateService.updateQuizMetadata({ title });
  }

  updateQuizDescription(description: string): void {
    this.quizStateService.updateQuizMetadata({ description });
  }

  updateTimeLimitValue(value: number): void {
    this.quizStateService.updateQuizMetadata({ timeLimitValue: value });
  }

  updateTimeLimitUnit(unit: TimeUnit): void {
    this.quizStateService.updateQuizMetadata({ timeLimitUnit: unit });
  }

  updateShuffleQuestions(shuffle: boolean): void {
    this.quizStateService.updateQuizMetadata({ shuffleQuestions: shuffle });
  }

  addQuestion(): void {
    this.quizStateService.addQuestion();
  }

  removeQuestion(questionId: string): void {
    this.quizStateService.removeQuestion(questionId);
    this.messageService.add({
      severity: 'info',
      summary: 'Question Removed',
      life: 2000,
    });
  }

  updateQuestion(questionId: string, question: QuizQuestion): void {
    this.quizStateService.updateQuestion(questionId, question);
  }

  saveDraft(): void {
    const quiz = this.currentQuiz();
    if (!quiz) return;

    this.quizStateService.saveDraftQuiz(quiz);
    this.messageService.add({
      severity: 'success',
      summary: 'Draft Saved',
      detail: 'Your quiz has been saved as draft',
      life: 3000,
    });
  }

  publishQuiz(): void {
    const quiz = this.currentQuiz();
    if (!quiz) return;

    const errors = this.quizStateService.getValidationErrors();
    if (errors.length > 0) {
      this.validationErrorsList = errors;
      this.showValidationDialog.set(true);
      return;
    }

    const result = this.quizStateService.publishQuiz(quiz);
    if (result.success) {
      this.messageService.add({
        severity: 'success',
        summary: 'Quiz Published',
        detail: 'Your quiz is now published and locked',
        life: 3000,
      });
      this.router.navigate(['/quizzes']);
    } else {
      this.validationErrorsList = result.errors;
      this.showValidationDialog.set(true);
    }
  }

  cancelEditing(): void {
    this.quizStateService.discardQuiz();
    this.router.navigate(['/quizzes']);
  }
}
