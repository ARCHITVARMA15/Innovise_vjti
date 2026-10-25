'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  getLearnersOverview,
  getLearnersQuizCards,
  submitLearnersQuiz,
  updateLearnersProgress,
} from '@/lib/api/learners';
import type {
  LearnerInvestor,
  LearnerResource,
  LearnerResourceType,
  LearnersProgress,
  LearnersQuizCard,
  LearnersQuizSubmitResponse,
} from '@/lib/types/learners';

export default function LearnersPage() {
  const [progress, setProgress] = useState<LearnersProgress | null>(null);
  const [investors, setInvestors] = useState<LearnerInvestor[]>([]);
  const [resources, setResources] = useState<LearnerResource[]>([]);
  const [quizCards, setQuizCards] = useState<LearnersQuizCard[]>([]);

  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({});
  const [quizResults, setQuizResults] = useState<Record<string, LearnersQuizSubmitResponse>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const [overview, quiz] = await Promise.all([
          getLearnersOverview({ resourceType: 'all', investorId: 'all', limit: 40 }),
          getLearnersQuizCards(5),
        ]);

        setProgress(overview.progress);
        setInvestors(overview.investors);
        setResources(overview.resources);
        setQuizCards(quiz.cards);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    updateLearnersProgress('daily_visit')
      .then((updated) => setProgress(updated))
      .catch(() => undefined);
  }, []);

  const accuracy = useMemo(() => {
    if (!progress || progress.quizzes_taken === 0) return 0;
    return Math.round((progress.correct_answers / progress.quizzes_taken) * 100);
  }, [progress]);

  async function handleMarkLessonDone(resourceId: string) {
    const updated = await updateLearnersProgress('lesson_completed', resourceId);
    setProgress(updated);
  }

  async function handleOpenResource(item: LearnerResource) {
    if (!item.is_generated) {
      try {
        const updated = await updateLearnersProgress('lesson_started', item.id);
        setProgress(updated);
      } catch {
        // Ignore progress update errors and continue opening resource.
      }
    }
    window.open(item.url, '_blank', 'noopener,noreferrer');
  }

  async function handleSubmitQuiz(cardId: string) {
    const selected = selectedAnswers[cardId];
    if (selected === undefined) return;

    const result = await submitLearnersQuiz(cardId, selected);
    setQuizResults((prev) => ({ ...prev, [cardId]: result }));
    setProgress(result.progress);
  }

  const videos = useMemo(() => resources.filter((r) => r.type === 'video').slice(0, 8), [resources]);
  const podcastsAndInterviews = useMemo(
    () => resources.filter((r) => r.type === 'podcast' || r.type === 'story').slice(0, 8),
    [resources],
  );
  const books = useMemo(() => resources.filter((r) => r.type === 'book').slice(0, 8), [resources]);
  const featuredQuiz = quizCards[0] ?? null;
  const userName = useMemo(() => {
    const raw = (progress?.user_id || 'Investor').trim();
    if (!raw || raw.toLowerCase() === 'default') return 'Investor';
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  }, [progress]);

  const investorImageById = useMemo(() => {
    const out: Record<string, string> = {};
    for (const inv of investors) {
      if (inv.image_url) out[inv.id] = inv.image_url;
    }
    return out;
  }, [investors]);

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border p-5 md:p-6" style={{ borderColor: 'rgba(203,213,225,0.55)', backgroundColor: '#ffffff' }}>
        <h1 className="text-3xl md:text-4xl font-black tracking-tight" style={{ color: '#0f172a', fontFamily: 'Manrope, sans-serif' }}>
          Learners
        </h1>
        <p className="mt-1.5 text-sm md:text-base" style={{ color: '#475569', fontFamily: 'Inter, sans-serif' }}>
          Welcome back, {userName}. Learn from top investors through focused videos, podcasts/interviews, books, and quizzes.
        </p>

        <div className="mt-5 grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
          <article className="xl:col-span-8 rounded-xl border p-4" style={{ borderColor: 'rgba(203,213,225,0.65)', backgroundColor: '#f8fafc' }}>
            <p className="text-xs uppercase tracking-wide font-semibold" style={{ color: '#64748b' }}>Quick Quiz</p>
            {featuredQuiz ? (
              <>
                <h3 className="mt-2 text-lg font-bold" style={{ color: '#111827' }}>{featuredQuiz.question}</h3>
                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                  {featuredQuiz.options.map((option, index) => (
                    <button
                      key={`${featuredQuiz.id}-${index}`}
                      onClick={() => setSelectedAnswers((prev) => ({ ...prev, [featuredQuiz.id]: index }))}
                      className="w-full text-left px-3 py-2 rounded-lg border text-sm"
                      style={{
                        borderColor: selectedAnswers[featuredQuiz.id] === index ? '#2563eb' : 'rgba(148,163,184,0.45)',
                        backgroundColor: selectedAnswers[featuredQuiz.id] === index ? '#eff6ff' : '#ffffff',
                        color: '#0f172a',
                      }}
                    >
                      {option}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => handleSubmitQuiz(featuredQuiz.id)}
                  disabled={selectedAnswers[featuredQuiz.id] === undefined}
                  className="mt-3 px-3 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-40"
                  style={{ backgroundColor: '#0f172a' }}
                >
                  Submit Quiz
                </button>

                {quizResults[featuredQuiz.id] && (
                  <div
                    className="mt-3 rounded-lg p-3 text-sm"
                    style={{
                      backgroundColor: quizResults[featuredQuiz.id].correct ? '#ecfeff' : '#fef2f2',
                      color: quizResults[featuredQuiz.id].correct ? '#155e75' : '#991b1b',
                    }}
                  >
                    <p className="font-semibold">{quizResults[featuredQuiz.id].correct ? 'Correct' : 'Not quite'}.</p>
                    <p className="mt-1">{quizResults[featuredQuiz.id].explanation}</p>
                  </div>
                )}
              </>
            ) : (
              <p className="mt-2 text-sm" style={{ color: '#64748b' }}>Quiz is loading...</p>
            )}
          </article>

          <div className="xl:col-span-4 grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-3">
            <StatCard label="Level" value={progress?.level ?? 'Starter'} />
            <StatCard label="XP" value={String(progress?.xp ?? 0)} />
            <StatCard label="Streak" value={`${progress?.streak_days ?? 0} days`} />
            <StatCard label="Lessons" value={String(progress?.lessons_completed ?? 0)} />
            <StatCard label="Accuracy" value={`${accuracy}%`} />
            <StatCard label="Quizzes" value={String(progress?.quizzes_taken ?? 0)} />
          </div>
        </div>
      </section>

      <SectionGrid
        title="Videos"
        subtitle="Two-row learning lane"
        items={videos}
        loading={loading}
        investorImageById={investorImageById}
        onOpen={handleOpenResource}
        onComplete={handleMarkLessonDone}
      />

      <SectionGrid
        title="Podcasts and Interviews"
        subtitle="Audio + story based lessons"
        items={podcastsAndInterviews}
        loading={loading}
        investorImageById={investorImageById}
        onOpen={handleOpenResource}
        onComplete={handleMarkLessonDone}
      />

      <SectionGrid
        title="Books"
        subtitle="Book summaries and references"
        items={books}
        loading={loading}
        investorImageById={investorImageById}
        onOpen={handleOpenResource}
        onComplete={handleMarkLessonDone}
      />
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <article
      className="rounded-xl border p-3"
      style={{ borderColor: 'rgba(148,163,184,0.35)', backgroundColor: 'rgba(255,255,255,0.76)' }}
    >
      <p className="text-xs uppercase tracking-wide font-semibold" style={{ color: '#64748b' }}>
        {label}
      </p>
      <p className="mt-1 text-lg font-bold" style={{ color: '#0f172a' }}>
        {value}
      </p>
    </article>
  );
}

function SectionGrid({
  title,
  subtitle,
  items,
  loading,
  investorImageById,
  onOpen,
  onComplete,
}: {
  title: string;
  subtitle: string;
  items: LearnerResource[];
  loading: boolean;
  investorImageById: Record<string, string>;
  onOpen: (item: LearnerResource) => void;
  onComplete: (resourceId: string) => void;
}) {
  return (
    <section className="rounded-2xl border p-5" style={{ borderColor: 'rgba(203,213,225,0.55)', backgroundColor: '#ffffff' }}>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: '#111827', fontFamily: 'Manrope, sans-serif' }}>{title}</h2>
          <p className="text-sm mt-0.5" style={{ color: '#64748b' }}>{subtitle}</p>
        </div>
        <span className="text-sm" style={{ color: '#64748b' }}>
          {loading ? 'Loading...' : `${items.length} items`}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {items.map((item) => (
          <MaterialCard
            key={item.id}
            item={item}
            investorImageUrl={investorImageById[item.investor_id]}
            compact={false}
            onOpen={onOpen}
            onComplete={onComplete}
          />
        ))}
      </div>
    </section>
  );
}

function MaterialCard({
  item,
  investorImageUrl,
  compact,
  onOpen,
  onComplete,
}: {
  item: LearnerResource;
  investorImageUrl?: string;
  compact: boolean;
  onOpen: (item: LearnerResource) => void;
  onComplete: (resourceId: string) => void;
}) {
  return (
    <article
      className={`rounded-xl border overflow-hidden ${compact ? 'flex items-stretch' : 'block'}`}
      style={{ borderColor: 'rgba(203,213,225,0.65)', backgroundColor: '#ffffff' }}
    >
      <div className={compact ? 'w-44 shrink-0' : 'w-full h-28'} style={getResourceMediaStyle(item, investorImageUrl)} />
      <div className="p-3 flex flex-col gap-2 flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs px-2 py-1 rounded-full" style={{ backgroundColor: '#e2e8f0', color: '#334155' }}>
            {item.topics.length > 0 ? `${item.topics.length} Topics` : 'Open Lesson'}
          </span>
          <span className="text-xs font-semibold" style={{ color: '#64748b' }}>{getMaterialKindLabel(item.type)}</span>
        </div>

        <h3 className="text-xl font-bold leading-tight" style={{ color: '#0f172a' }}>{item.title}</h3>

        <div className="flex gap-1.5 flex-wrap">
          <span className="text-xs px-2 py-1 rounded-full inline-flex items-center gap-1.5" style={{ backgroundColor: '#f1f5f9', color: '#475569' }}>
            <span className="w-4 h-4 rounded-full border" style={getInvestorAvatarStyle(investorImageUrl)} />
            {item.investor_name || 'Open Topic'}
          </span>
          <span className="text-xs px-2 py-1 rounded-full" style={{ backgroundColor: '#f1f5f9', color: '#475569' }}>
            {item.duration_minutes} min
          </span>
          <span className="text-xs px-2 py-1 rounded-full" style={{ backgroundColor: '#f1f5f9', color: '#475569' }}>
            {item.status.replace('_', ' ')}
          </span>
        </div>

        <p className="text-sm" style={{ color: '#64748b' }}>{item.summary}</p>

        {item.status !== 'not_started' && (
          <>
            <p className="text-xs" style={{ color: '#64748b' }}>Progress: {item.progress_percent}%</p>
            <div className="w-full h-2 rounded-full" style={{ backgroundColor: '#e2e8f0' }}>
              <div className="h-2 rounded-full" style={{ width: `${item.progress_percent}%`, backgroundColor: '#14b8a6' }} />
            </div>
          </>
        )}

        <div className="flex items-center gap-2 mt-auto">
          <button
            type="button"
            onClick={() => onOpen(item)}
            className="px-3 py-2 rounded-lg text-sm font-semibold"
            style={{ backgroundColor: '#0f172a', color: '#ffffff' }}
          >
            {item.status === 'not_started' ? 'Start' : 'Continue'}
          </button>
          {!item.is_generated && item.status !== 'completed' && (
            <button
              type="button"
              onClick={() => onComplete(item.id)}
              className="px-3 py-2 rounded-lg text-sm font-semibold"
              style={{ backgroundColor: '#e2e8f0', color: '#0f172a' }}
            >
              Mark Completed
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

function getMaterialKindLabel(type: LearnerResourceType | LearnerResource['type']): string {
  if (type === 'video') return 'Course';
  if (type === 'book') return 'Page';
  if (type === 'podcast') return 'Audio';
  if (type === 'story') return 'Learning Path';
  return 'Material';
}

function getBannerStyle(type: LearnerResourceType | LearnerResource['type']): React.CSSProperties {
  if (type === 'video') {
    return {
      background: 'linear-gradient(135deg, #7dd3fc 0%, #38bdf8 45%, #93c5fd 100%)',
      boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.3)',
    };
  }
  if (type === 'book') {
    return {
      background: 'linear-gradient(135deg, #fde68a 0%, #fbbf24 50%, #fcd34d 100%)',
      boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.3)',
    };
  }
  if (type === 'podcast') {
    return {
      background: 'linear-gradient(135deg, #c4b5fd 0%, #a78bfa 45%, #93c5fd 100%)',
      boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.3)',
    };
  }
  return {
    background: 'linear-gradient(135deg, #93c5fd 0%, #60a5fa 50%, #c4b5fd 100%)',
    boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.3)',
  };
}

function getResourceMediaStyle(item: LearnerResource, investorImageUrl?: string): React.CSSProperties {
  const fallback = getBannerStyle(item.type);
  const typePlaceholder = getTypePlaceholder(item.type);

  const investorFirst = item.type === 'video' || item.type === 'podcast';
  const ordered = investorFirst
    ? [item.thumbnail_url, investorImageUrl, typePlaceholder, '/learners/placeholders/investor-generic.svg']
    : [item.thumbnail_url, typePlaceholder, investorImageUrl, '/learners/placeholders/investor-generic.svg'];

  const sources = ordered
    .filter((src): src is string => Boolean(src));

  return {
    ...fallback,
    backgroundImage: [
      'linear-gradient(135deg, rgba(15,23,42,0.08) 0%, rgba(15,23,42,0.08) 100%)',
      ...sources.map((src) => `url(${src})`),
    ].join(', '),
    backgroundSize: ['auto', ...sources.map(() => 'cover')].join(', '),
    backgroundPosition: ['center', ...sources.map(() => 'center')].join(', '),
  };
}

function getTypePlaceholder(type: LearnerResourceType | LearnerResource['type']): string {
  if (type === 'video') return '/learners/placeholders/video-card.svg';
  if (type === 'book') return '/learners/placeholders/book-card.svg';
  if (type === 'podcast') return '/learners/placeholders/podcast-card.svg';
  return '/learners/placeholders/story-card.svg';
}

function getInvestorAvatarStyle(imageUrl?: string): React.CSSProperties {
  if (!imageUrl) {
    return {
      borderColor: 'rgba(203,213,225,0.9)',
      backgroundImage: 'url(/learners/placeholders/investor-generic.svg)',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundColor: '#e2e8f0',
    };
  }

  return {
    borderColor: 'rgba(203,213,225,0.9)',
    backgroundImage: `url(${imageUrl})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundColor: '#e2e8f0',
  };
}
