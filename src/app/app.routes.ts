import { Routes } from '@angular/router';
import { QuizListComponent } from './components/quiz-list/quiz-list.component';
import { QuizBuilderComponent } from './components/quiz-builder/quiz-builder.component';
import { QuizTakerComponent } from './components/quiz-taker/quiz-taker.component';
import { ResultsComponent } from './components/results/results.component';

export const routes: Routes = [
  { path: '', redirectTo: 'quizzes', pathMatch: 'full' },
  { path: 'quizzes', component: QuizListComponent },
  { path: 'builder', component: QuizBuilderComponent },
  { path: 'quiz/:id', component: QuizTakerComponent },
  { path: 'results/:id', component: ResultsComponent },
  { path: '**', redirectTo: 'quizzes' },
];
