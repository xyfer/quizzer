export interface QuizOption {
  id: string;
  text: string;
}

export interface QuizQuestion {
  id: string;
  prompt: string;
  required: boolean;
  pointValue: number;
  options: QuizOption[];
  correctAnswerId: string;
}

export enum QuizStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
}

export interface Quiz {
  id: string;
  title: string;
  description: string;
  timeLimitValue: number;
  shuffleQuestions: boolean;
  questions: QuizQuestion[];
  status: QuizStatus;
  createdAt: number;
  updatedAt: number;
}

export enum Status {
  NOT_STARTED = 'NOT STARTED',
  IN_PROGRESS = 'IN PROGRESS',
  COMPLETED = 'COMPLETED',
}

export interface UserAnswer {
  questionId: string;
  selectedOptionId: string;
}

export interface QuizSession {
  id: string;
  quizId: string;
  status: Status;
  startTime: number;
  deadline: number;
  // answers that are recorded but not yet submitted
  userAnswers: UserAnswer[];
  // ids of questions that have been explicitly submitted
  submittedQuestionIds: string[];
}

export interface QuestionScore {
  questionId: string;
  userAnswerId: string;
  correctAnswerId: string;
  isCorrect: boolean;
}

export interface QuizResults {
  sessionId: string;
  quizId: string;
  score: number;
  maxScore: number;
  percentage: number;
  questionScores: QuestionScore[];
}

export interface QuizMetadata {
  quiz: Quiz;
  session?: QuizSession;
  results?: QuizResults;
  displayStatus: Status;
}
