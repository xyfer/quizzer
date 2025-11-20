import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { SelectModule } from 'primeng/select';
import { CardModule } from 'primeng/card';

import { QuizQuestion, QuizOption } from '../../models/types';

@Component({
  selector: 'app-question-editor',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    InputTextModule,
    InputNumberModule,
    SelectModule,
    CardModule,
  ],
  templateUrl: './question-editor.component.html',
  styleUrl: './question-editor.component.scss',
})
export class QuestionEditorComponent implements OnInit {
  @Input() question!: QuizQuestion;
  @Output() questionChanged = new EventEmitter<QuizQuestion>();
  @Output() questionRemoved = new EventEmitter<string>();

  ngOnInit(): void {
    if (!this.question) {
      throw new Error('Question must be provided');
    }
  }

  onQuestionChange(): void {
    this.questionChanged.emit(this.question);
  }

  addOption(): void {
    const newOption: QuizOption = {
      id: this.generateId(),
      text: '',
    };
    this.question.options.push(newOption);
    this.onQuestionChange();
  }

  removeOption(optionId: string): void {
    if (this.question.options.length <= 2) return;
    this.question.options = this.question.options.filter((option) => option.id !== optionId);

    if (this.question.correctAnswerId === optionId) {
      this.question.correctAnswerId = '';
    }

    this.onQuestionChange();
  }

  removeQuestion(): void {
    this.questionRemoved.emit(this.question.id);
  }

  private generateId(): string {
    return crypto.randomUUID();
  }
}
