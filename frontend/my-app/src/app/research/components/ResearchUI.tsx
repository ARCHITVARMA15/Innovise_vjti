import { AlertCircle, Beaker } from 'lucide-react';

export function ResearchHeading() {
  return <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#006591]"><Beaker size={16} aria-hidden="true" /> Research Lab</p>;
}

export function ErrorNotice({ message }: { message: string }) {
  return <div role="alert" className="rl-error flex items-start gap-2"><AlertCircle size={18} className="mt-0.5 shrink-0" aria-hidden="true" /><span>{message}</span></div>;
}

export function formatTimestamp(value: string) {
  return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export function errorText(error: unknown) {
  return error instanceof Error ? error.message : 'The request failed. Please try again.';
}
