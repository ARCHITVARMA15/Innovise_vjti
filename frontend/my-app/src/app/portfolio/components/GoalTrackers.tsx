'use client';

import { useState } from 'react';
import type { GoalTracker } from '@/lib/types/portfolio';
import GoalSettingModal from './GoalSettingModal';

interface Props {
  data: GoalTracker[];
}

function formatValue(n: number): string {
  if (n >= 1_000_000) return `₹${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `₹${(n / 1_000).toFixed(0)}K`;
  return `₹${n.toLocaleString('en-IN')}`;
}

export default function GoalTrackers({ data }: Props) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [goals, setGoals] = useState<GoalTracker[]>(data);
  const [showPlaceholder, setShowPlaceholder] = useState(data.length === 0);

  const handleAddGoal = (newGoal: { id: string; label: string; icon: string; iconColor: string; iconBg: string; targetValue: number; currentValue: number }) => {
    const goalTracker: GoalTracker = {
      id: newGoal.id,
      label: newGoal.label,
      icon: newGoal.icon,
      iconColor: newGoal.iconColor,
      iconBg: newGoal.iconBg,
      currentValue: newGoal.currentValue,
      targetValue: newGoal.targetValue,
      progressPercent: 0,
      progressBarColor: newGoal.iconColor,
      status: 'Early stage' as const,
      statusColor: '#94a3b8',
      ctaLabel: 'Increase contributions',
    };
    
    setGoals(prev => [...prev, goalTracker]);
    setShowPlaceholder(false);
  };

  const displayGoals: GoalTracker[] = showPlaceholder ? [
    {
      id: 'example-1',
      label: 'RETIREMENT 2065 (Example)',
      icon: 'savings',
      iconColor: '#006591',
      iconBg: '#e5eeff',
      currentValue: 303000,
      targetValue: 3500000,
      progressPercent: 8.7,
      progressBarColor: '#006591',
      status: 'Early stage' as const,
      statusColor: '#94a3b8',
    },
    {
      id: 'example-2',
      label: 'EDUCATION FUND (Example)',
      icon: 'school',
      iconColor: '#0891b2',
      iconBg: '#cffafe',
      currentValue: 101000,
      targetValue: 250000,
      progressPercent: 40.4,
      progressBarColor: '#0891b2',
      status: 'On Track' as const,
      statusColor: '#009668',
      ctaLabel: 'Increase contributions',
    },
    {
      id: 'example-3',
      label: 'VACATION HOME (Example)',
      icon: 'home',
      iconColor: '#009668',
      iconBg: '#d7f4e8',
      currentValue: 101000,
      targetValue: 150000,
      progressPercent: 67.4,
      progressBarColor: '#009668',
      status: 'On Track' as const,
      statusColor: '#009668',
    },
  ] : goals;

  return (
    <>
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <h3
            className="text-xl font-extrabold tracking-tight"
            style={{ color: '#0f172a', fontFamily: 'Manrope, sans-serif' }}
          >
            Goal Trackers
          </h3>
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 rounded-lg text-sm font-bold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: '#006591', fontFamily: 'Inter, sans-serif' }}
          >
            Set Your Goals
          </button>
        </div>

        {showPlaceholder && (
          <div
            className="px-4 py-2 rounded-lg"
            style={{ backgroundColor: '#fef3c7', borderLeft: '4px solid #C9A84C' }}
          >
            <p
              className="text-xs font-semibold"
              style={{ color: '#92400e', fontFamily: 'Inter, sans-serif' }}
            >
              📌 These are example goals. Click &quot;Set Your Goals&quot; to create your own!
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {displayGoals.map(goal => (
          <div
            key={goal.id}
            className="p-8 rounded-xl flex flex-col gap-5"
            style={{ backgroundColor: '#ffffff', boxShadow: '0 24px 40px rgba(11,28,48,0.05)' }}
          >
            {/* Icon + label */}
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                style={{ backgroundColor: goal.iconBg }}
              >
                <span
                  className="material-symbols-outlined"
                  style={{
                    fontSize: '20px',
                    color: goal.iconColor,
                    fontVariationSettings: "'FILL' 1, 'wght' 400",
                  }}
                >
                  {goal.icon}
                </span>
              </div>
              <span
                className="text-[10px] font-bold uppercase tracking-[0.15em]"
                style={{ color: '#94a3b8', fontFamily: 'Inter, sans-serif' }}
              >
                {goal.label}
              </span>
            </div>

            {/* Value display */}
            <div>
              {goal.currentValue > 0 ? (
                <div className="flex items-baseline gap-1.5">
                  <span
                    className="text-2xl font-extrabold"
                    style={{ color: '#0f172a', fontFamily: 'Manrope, sans-serif' }}
                  >
                    {formatValue(goal.currentValue)}
                  </span>
                  <span
                    className="text-sm font-medium"
                    style={{ color: '#94a3b8', fontFamily: 'Inter, sans-serif' }}
                  >
                    / {formatValue(goal.targetValue)}
                  </span>
                </div>
              ) : (
                <div>
                  <div className="flex items-baseline gap-1.5">
                    <span
                      className="text-2xl font-extrabold"
                      style={{ color: '#006591', fontFamily: 'Manrope, sans-serif' }}
                    >
                      {formatValue(goal.targetValue)}
                    </span>
                  </div>
                  <span
                    className="text-[10px] font-bold uppercase tracking-widest"
                    style={{ color: '#94a3b8', fontFamily: 'Inter, sans-serif' }}
                  >
                    Target Amount
                  </span>
                </div>
              )}
            </div>

            {/* Progress bar */}
            <div className="space-y-2">
              <div
                className="h-1.5 w-full rounded-full overflow-hidden"
                style={{ backgroundColor: '#f1f5f9' }}
              >
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${Math.min(goal.progressPercent, 100)}%`,
                    backgroundColor: goal.progressBarColor,
                  }}
                />
              </div>

              {/* Progress % + status / CTA */}
              <div className="flex items-center justify-between">
                <span
                  className="text-xs font-medium"
                  style={{ color: '#64748b', fontFamily: 'Inter, sans-serif' }}
                >
                  {goal.progressPercent}% complete
                </span>
                {goal.ctaLabel ? (
                  <button
                    className="text-xs font-bold transition-opacity hover:opacity-70"
                    style={{ color: '#006591', fontFamily: 'Inter, sans-serif' }}
                  >
                    {goal.ctaLabel}
                  </button>
                ) : (
                  <span
                    className="text-xs font-semibold"
                    style={{ color: goal.statusColor, fontFamily: 'Inter, sans-serif' }}
                  >
                    {goal.status}
                  </span>
                )}
              </div>
            </div>
            </div>
          ))}
        </div>
      </section>

      {/* Goal Setting Modal */}
      <GoalSettingModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onAddGoal={handleAddGoal}
      />
    </>
  );
}
