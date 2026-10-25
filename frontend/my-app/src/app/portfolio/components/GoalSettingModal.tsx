'use client';

import { useState, useEffect } from 'react';

interface Goal {
  id: string;
  label: string;
  icon: string;
  iconColor: string;
  iconBg: string;
  targetValue: number;
  currentValue: number;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onAddGoal: (goal: Goal) => void;
}

const GOAL_RECOMMENDATIONS = [
  { label: 'Retirement 2045', icon: 'savings', iconColor: '#006591', iconBg: '#e5eeff', targetValue: 3500000 },
  { label: 'Emergency Fund', icon: 'shield', iconColor: '#009668', iconBg: '#d7f4e8', targetValue: 500000 },
  { label: 'Dream Home', icon: 'home', iconColor: '#7c3aed', iconBg: '#f3e8ff', targetValue: 5000000 },
  { label: 'Child Education', icon: 'school', iconColor: '#0891b2', iconBg: '#cffafe', targetValue: 2500000 },
  { label: 'Vacation Fund', icon: 'flight', iconColor: '#009668', iconBg: '#d7f4e8', targetValue: 150000 },
  { label: 'New Car', icon: 'directions_car', iconColor: '#ba1a1a', iconBg: '#ffdad6', targetValue: 1200000 },
  { label: 'Wedding Fund', icon: 'celebration', iconColor: '#C9A84C', iconBg: '#fef3c7', targetValue: 1000000 },
  { label: 'Business Startup', icon: 'business_center', iconColor: '#006591', iconBg: '#e5eeff', targetValue: 2000000 },
];

export default function GoalSettingModal({ isOpen, onClose, onAddGoal }: Props) {
  const [customGoalName, setCustomGoalName] = useState('');
  const [customGoalTarget, setCustomGoalTarget] = useState('');
  const [selectedRecommendation, setSelectedRecommendation] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const handleAddCustomGoal = () => {
    if (!customGoalName.trim() || !customGoalTarget) return;

    const newGoal: Goal = {
      id: `goal-${Date.now()}`,
      label: customGoalName,
      icon: 'flag',
      iconColor: '#006591',
      iconBg: '#e5eeff',
      targetValue: parseFloat(customGoalTarget),
      currentValue: 0,
    };

    onAddGoal(newGoal);
    setCustomGoalName('');
    setCustomGoalTarget('');
    onClose();
  };

  const handleAddRecommendedGoal = (rec: typeof GOAL_RECOMMENDATIONS[0]) => {
    const newGoal: Goal = {
      id: `goal-${Date.now()}`,
      label: rec.label,
      icon: rec.icon,
      iconColor: rec.iconColor,
      iconBg: rec.iconBg,
      targetValue: rec.targetValue,
      currentValue: 0,
    };

    onAddGoal(newGoal);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{
          backgroundColor: 'rgba(11, 28, 48, 0.6)',
          backdropFilter: 'blur(8px)',
        }}
      />

      {/* Modal Content */}
      <div
        className="relative w-full max-w-3xl max-h-[90vh] overflow-hidden rounded-2xl"
        style={{
          backgroundColor: '#f8f9ff',
          boxShadow: '0 32px 64px rgba(11, 28, 48, 0.25)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="px-8 py-6 border-b flex items-center justify-between"
          style={{
            backgroundColor: '#ffffff',
            borderColor: 'rgba(226, 232, 240, 0.6)',
          }}
        >
          <div>
            <h2
              className="text-2xl font-bold tracking-tight"
              style={{ color: '#0f172a', fontFamily: 'Manrope, sans-serif' }}
            >
              Set Your Goals
            </h2>
            <p
              className="text-sm mt-1"
              style={{ color: '#64748b', fontFamily: 'Inter, sans-serif' }}
            >
              Create custom goals or choose from recommendations
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full transition-colors hover:bg-slate-100"
            style={{ color: '#475569' }}
          >
            <span
              className="material-symbols-outlined"
              style={{ fontSize: '24px', fontVariationSettings: "'FILL' 0, 'wght' 300" }}
            >
              close
            </span>
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-120px)] px-8 py-6 space-y-8">
          {/* Custom Goal Input */}
          <div
            className="p-6 rounded-xl"
            style={{ backgroundColor: '#ffffff', boxShadow: '0 4px 16px rgba(11, 28, 48, 0.06)' }}
          >
            <h3
              className="text-lg font-bold mb-4"
              style={{ color: '#0f172a', fontFamily: 'Manrope, sans-serif' }}
            >
              Create Custom Goal
            </h3>
            
            <div className="space-y-4">
              <div>
                <label
                  className="block text-xs font-bold uppercase tracking-widest mb-2"
                  style={{ color: '#64748b', fontFamily: 'Inter, sans-serif' }}
                >
                  Goal Name
                </label>
                <input
                  type="text"
                  value={customGoalName}
                  onChange={(e) => setCustomGoalName(e.target.value)}
                  placeholder="e.g., Dream Vacation, New Laptop, etc."
                  className="w-full px-4 py-3 rounded-lg border outline-none focus:ring-2"
                  style={{
                    borderColor: '#e2e8f0',
                    fontFamily: 'Inter, sans-serif',
                    backgroundColor: '#ffffff',
                  }}
                />
              </div>

              <div>
                <label
                  className="block text-xs font-bold uppercase tracking-widest mb-2"
                  style={{ color: '#64748b', fontFamily: 'Inter, sans-serif' }}
                >
                  Target Amount (₹)
                </label>
                <input
                  type="number"
                  value={customGoalTarget}
                  onChange={(e) => setCustomGoalTarget(e.target.value)}
                  placeholder="e.g., 50000"
                  className="w-full px-4 py-3 rounded-lg border outline-none focus:ring-2"
                  style={{
                    borderColor: '#e2e8f0',
                    fontFamily: 'Inter, sans-serif',
                    backgroundColor: '#ffffff',
                  }}
                />
              </div>

              <button
                onClick={handleAddCustomGoal}
                disabled={!customGoalName.trim() || !customGoalTarget}
                className="w-full py-3 rounded-lg text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: '#0f172a', fontFamily: 'Inter, sans-serif' }}
              >
                Add Custom Goal
              </button>
            </div>
          </div>

          {/* Recommended Goals */}
          <div>
            <h3
              className="text-lg font-bold mb-4"
              style={{ color: '#0f172a', fontFamily: 'Manrope, sans-serif' }}
            >
              Recommended Goals
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              {GOAL_RECOMMENDATIONS.map((rec) => (
                <button
                  key={rec.label}
                  onClick={() => handleAddRecommendedGoal(rec)}
                  className="p-5 rounded-xl text-left transition-all hover:scale-105"
                  style={{
                    backgroundColor: '#ffffff',
                    boxShadow: '0 4px 16px rgba(11, 28, 48, 0.06)',
                  }}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                      style={{ backgroundColor: rec.iconBg }}
                    >
                      <span
                        className="material-symbols-outlined"
                        style={{
                          fontSize: '20px',
                          color: rec.iconColor,
                          fontVariationSettings: "'FILL' 1, 'wght' 400",
                        }}
                      >
                        {rec.icon}
                      </span>
                    </div>
                    <span
                      className="text-sm font-bold"
                      style={{ color: '#0f172a', fontFamily: 'Inter, sans-serif' }}
                    >
                      {rec.label}
                    </span>
                  </div>
                  
                  <div
                    className="text-lg font-bold"
                    style={{ color: '#006591', fontFamily: 'Manrope, sans-serif' }}
                  >
                    ₹{(rec.targetValue / 1000).toFixed(0)}K
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
