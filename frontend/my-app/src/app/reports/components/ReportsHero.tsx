'use client';

import { useState } from 'react';

export default function ReportsHero() {
  const [activePeriod, setActivePeriod] = useState('1M');
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const periods = ['1M', '3M', '6M', '1Y', 'All'];
  const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

  const today = new Date().toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const playSuccessSound = () => {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const playNote = (freq: number, startTime: number, duration: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle'; // Triangular wave is much louder/brighter than sine
        osc.frequency.setValueAtTime(freq, ctx.currentTime + startTime);
        
        gain.gain.setValueAtTime(0, ctx.currentTime + startTime);
        gain.gain.linearRampToValueAtTime(1.0, ctx.currentTime + startTime + 0.05); // Max volume
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startTime + duration);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + startTime);
        osc.stop(ctx.currentTime + startTime + duration);
      };
      
      // Play a louder, longer triumphant arpeggio (C5 -> E5 -> G5 -> C6)
      playNote(523.25, 0.0, 0.4);      // C5
      playNote(659.25, 0.15, 0.5);     // E5
      playNote(783.99, 0.30, 0.6);     // G5
      playNote(1046.50, 0.50, 1.5);    // C6 (lasts much longer)
    } catch (e) {
      console.error("Audio notification failed:", e);
    }
  };

  const getBackendPeriod = (period: string) => (period === 'All' ? 'ALL' : period);

  const handleDownloadPDF = async () => {
    try {
      setIsDownloading(true);
      const period = getBackendPeriod(activePeriod);
      const response = await fetch(`${API_BASE}/reports/pdf?period=${period}`);

      if (!response.ok) {
        throw new Error('Failed to generate PDF report');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `portfolio_report_${period}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
      alert('Could not download PDF report. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleSendEmail = async () => {
    try {
      setIsSending(true);
      const period = getBackendPeriod(activePeriod);
      const response = await fetch(`${API_BASE}/reports/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          period,
          subject: `Portfolio Report (${period})`,
          message: `Please find your ${period} portfolio report attached.`,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.detail || payload.error || 'Failed to send email');
      }

      const payload = await response.json().catch(() => ({}));
      
      // Play sound upon successful send
      playSuccessSound();
      
      alert(`Report sent to ${payload.to || 'configured mailbox'}`);
    } catch (error) {
      console.error(error);
      alert('Could not send report email. Check backend mail settings and try again.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="flex items-start justify-between">
      <div>
        <p className="text-[11px] uppercase tracking-widest font-bold text-slate-500 mb-1" style={{ fontFamily: 'Inter, sans-serif' }}>
          Portfolio Intelligence
        </p>
        <h2 className="text-4xl font-extrabold text-black tracking-tight" style={{ fontFamily: 'Manrope, sans-serif' }}>
          Investment Reports
        </h2>
        <p className="text-slate-500 text-sm mt-1">
          Full ledger · Alexander Thorne · Generated {today}
        </p>
      </div>

      <div className="flex flex-col items-end gap-3">
        {/* Report Period Selector */}
        <div className="flex gap-2">
          {periods.map((period) => (
            <button
              key={period}
              onClick={() => setActivePeriod(period)}
              className="px-4 py-1.5 rounded-lg text-[12px] font-bold transition-all"
              style={{
                backgroundColor: activePeriod === period ? '#000000' : '#eff4ff',
                color: activePeriod === period ? '#ffffff' : '#76777d',
                fontFamily: 'Inter, sans-serif',
              }}
            >
              {period}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleDownloadPDF}
            disabled={isDownloading}
            className="px-4 py-2 rounded-lg text-[12px] font-bold bg-[#131b2e] text-white hover:opacity-90 disabled:opacity-60 transition-all"
            style={{ fontFamily: 'Inter, sans-serif' }}
          >
            {isDownloading ? 'Generating PDF...' : 'Download PDF'}
          </button>
          <button
            onClick={handleSendEmail}
            disabled={isSending}
            className="px-4 py-2 rounded-lg text-[12px] font-bold bg-[#4edea3] text-[#002113] hover:opacity-90 disabled:opacity-60 transition-all"
            style={{ fontFamily: 'Inter, sans-serif' }}
          >
            {isSending ? 'Sending...' : 'Send Email'}
          </button>
        </div>
      </div>
    </div>
  );
}
