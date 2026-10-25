export type LearnerResourceType = 'all' | 'video' | 'book' | 'podcast' | 'story';

export interface LearnerInvestor {
  id: string;
  name: string;
  country: string;
  style: string;
  bio: string;
  image_url?: string;
  image_source?: string;
  image_license?: string;
  image_credit?: string;
}

export interface LearnersProgress {
  user_id: string;
  xp: number;
  streak_days: number;
  level: string;
  lessons_completed: number;
  quizzes_taken: number;
  correct_answers: number;
  completed_resource_ids: string[];
  in_progress_resource_ids: string[];
  last_active: string;
}

export interface LearnerResource {
  id: string;
  title: string;
  type: Exclude<LearnerResourceType, 'all'>;
  investor_id: string;
  investor_name: string;
  topics: string[];
  level: string;
  duration_minutes: number;
  source: string;
  url: string;
  summary: string;
  is_generated: boolean;
  status: 'not_started' | 'in_progress' | 'completed';
  progress_percent: number;
  thumbnail_url?: string;
  image_source?: string;
  image_license?: string;
  image_credit?: string;
}

export interface LearnerAttribution {
  entity_type: 'investor' | 'resource';
  title: string;
  source: string;
  license: string;
  credit: string;
}

export interface LearnersOverview {
  progress: LearnersProgress;
  investors: LearnerInvestor[];
  resources: LearnerResource[];
  quiz_count: number;
  attributions: LearnerAttribution[];
}

export interface LearnersQuizCard {
  id: string;
  question: string;
  options: string[];
  topic: string;
  level: string;
}

export interface LearnersQuizCardsResponse {
  cards: LearnersQuizCard[];
}

export interface LearnersQuizSubmitResponse {
  card_id: string;
  selected_index: number;
  correct_index: number;
  correct: boolean;
  explanation: string;
  progress: LearnersProgress;
}
