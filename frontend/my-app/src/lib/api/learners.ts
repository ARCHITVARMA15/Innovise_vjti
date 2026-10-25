import { apiFetch, apiPost, REVALIDATE } from '@/lib/api/client';
import type {
  LearnersOverview,
  LearnersProgress,
  LearnersQuizCardsResponse,
  LearnersQuizSubmitResponse,
  LearnerResourceType,
} from '@/lib/types/learners';

interface OverviewParams {
  query?: string;
  resourceType?: LearnerResourceType;
  investorId?: string;
  limit?: number;
}

export async function getLearnersOverview(params?: OverviewParams): Promise<LearnersOverview> {
  const query = new URLSearchParams();
  if (params?.query) query.set('query', params.query);
  query.set('resource_type', params?.resourceType ?? 'all');
  query.set('investor_id', params?.investorId ?? 'all');
  query.set('limit', String(params?.limit ?? 24));

  return apiFetch<LearnersOverview>(`/learners/overview?${query.toString()}`, {
    revalidate: REVALIDATE.SLOW,
  });
}

export async function getLearnersQuizCards(limit = 5): Promise<LearnersQuizCardsResponse> {
  return apiFetch<LearnersQuizCardsResponse>(`/learners/quiz/cards?limit=${limit}`, {
    revalidate: REVALIDATE.SLOW,
  });
}

export async function submitLearnersQuiz(cardId: string, selectedIndex: number): Promise<LearnersQuizSubmitResponse> {
  return apiPost<LearnersQuizSubmitResponse>('/learners/quiz/submit', {
    card_id: cardId,
    selected_index: selectedIndex,
  });
}

export async function updateLearnersProgress(
  action: 'lesson_started' | 'lesson_completed' | 'daily_visit',
  resourceId?: string,
): Promise<LearnersProgress> {
  return apiPost<LearnersProgress>('/learners/progress', {
    action,
    resource_id: resourceId ?? null,
  });
}
