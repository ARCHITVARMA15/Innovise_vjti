'use client';

import type {
  SourceReference,
  DataSnapshot,
  EvidenceItem,
  IterationOutput,
  LayerTrace,
  RegulatoryResult,
  VerificationResult,
  WorkflowSummary,
} from '@/lib/types/agent';
import SourceCard from './SourceCard';
import DataCard from './DataCard';
import VerificationBadge from './VerificationBadge';
import RegulatoryBadge from './RegulatoryBadge';
import IterationTimeline from './IterationTimeline';
import EvidenceLedger from './EvidenceLedger';
import ModePlanCard from './ModePlanCard';
import StrategyWorkspace from './StrategyWorkspace';
import { getTheme } from '../theme';

interface Props {
  sources: SourceReference[];
  dataSnapshots: DataSnapshot[];
  evidenceItems: EvidenceItem[];
  layerTraces: LayerTrace[];
  iterationOutputs: IterationOutput[];
  workflowSummary: WorkflowSummary | null;
  verification: VerificationResult | null;
  regulatory: RegulatoryResult | null;
  activeIntent: string;
}

export default function ContextPanel({
  sources,
  dataSnapshots,
  evidenceItems,
  layerTraces,
  iterationOutputs,
  workflowSummary,
  verification,
  regulatory,
  activeIntent,
}: Props) {
  const theme = getTheme(activeIntent);
  const isEmpty =
    sources.length === 0 &&
    dataSnapshots.length === 0 &&
    evidenceItems.length === 0 &&
    layerTraces.length === 0 &&
    iterationOutputs.length === 0 &&
    !verification &&
    !regulatory;

  return (
    <div
      className="flex flex-col flex-1 min-h-0 rounded-xl overflow-hidden"
      style={{
        backgroundColor: '#f8f9ff',
        border: `1px solid ${theme.softBorder}`,
        boxShadow: '0 8px 32px rgba(11,28,48,0.04)',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2 px-5 py-3"
        style={{ borderBottom: `1px solid ${theme.softBorder}`, backgroundColor: theme.softBg }}
      >
        <span
          className="material-symbols-outlined"
          style={{ fontSize: '16px', color: theme.accent, fontVariationSettings: "'FILL' 0, 'wght' 400" }}
        >
          hub
        </span>
        <span
          className="text-sm font-bold"
          style={{ color: '#0f172a', fontFamily: 'Manrope, sans-serif' }}
        >
          Research Context
        </span>
        {!isEmpty && (
          <span
            className="text-[10px] font-bold px-2 py-0.5 rounded-full ml-auto"
            style={{ backgroundColor: '#ffffff', color: theme.accent, fontFamily: 'Inter, sans-serif', border: `1px solid ${theme.softBorder}` }}
          >
            {sources.length + dataSnapshots.length + evidenceItems.length} items
          </span>
        )}
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {isEmpty && (
          <div className="flex flex-col items-center justify-center h-full text-center py-16">
            <span
              className="material-symbols-outlined mb-3"
              style={{ fontSize: '36px', color: '#cbd5e1', fontVariationSettings: "'FILL' 0, 'wght' 200" }}
            >
              hub
            </span>
            <p
              className="text-sm"
              style={{ color: '#94a3b8', fontFamily: 'Inter, sans-serif' }}
            >
              Sources and data will appear here as Veritas researches your query.
            </p>
          </div>
        )}

        {/* Verification badge */}
        {verification && (
          <div>
            <SectionLabel icon="verified" label="Verification Result" />
            <VerificationBadge result={verification} />
          </div>
        )}

        {regulatory && (
          <div>
            <SectionLabel icon="gavel" label="Regulatory Result" />
            <RegulatoryBadge result={regulatory} />
          </div>
        )}

        <IterationTimeline traces={layerTraces} outputs={iterationOutputs} summary={workflowSummary} />

        <ModePlanCard outputs={iterationOutputs} activeIntent={activeIntent} workflowSummary={workflowSummary} />

        <EvidenceLedger evidence={evidenceItems} />

        <StrategyWorkspace
          activeIntent={activeIntent}
          dataSnapshots={dataSnapshots}
          iterationOutputs={iterationOutputs}
        />

        {/* Data snapshots */}
        {dataSnapshots.length > 0 && (
          <div>
            <SectionLabel icon="monitoring" label={`Live Data (${dataSnapshots.length})`} />
            <div className="space-y-2">
              {dataSnapshots.map((snapshot, i) => (
                <DataCard key={i} snapshot={snapshot} />
              ))}
            </div>
          </div>
        )}

        {/* Sources */}
        {sources.length > 0 && (
          <div>
            <SectionLabel icon="link" label={`Sources (${sources.length})`} />
            <div className="space-y-2">
              {sources.map((source, i) => (
                <SourceCard key={i} source={source} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SectionLabel({ icon, label }: { icon: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5 mb-2">
      <span
        className="material-symbols-outlined"
        style={{ fontSize: '14px', color: '#64748b', fontVariationSettings: "'FILL' 0, 'wght' 400" }}
      >
        {icon}
      </span>
      <span
        className="text-[11px] font-bold uppercase tracking-wider"
        style={{ color: '#64748b', fontFamily: 'Inter, sans-serif' }}
      >
        {label}
      </span>
    </div>
  );
}
