'use client';

export default function InvestmentFooter() {
  return (
    <footer
      className="mt-auto p-8 flex justify-between items-center text-[10px] uppercase tracking-widest"
      style={{
        borderTop: '1px solid #f1f5f9',
        color: '#94a3b8',
        fontFamily: 'Inter, sans-serif',
      }}
    >
      <div>Veritas Ledger Institutional Terminal v4.2.0</div>
      <div className="flex gap-4">
        {['Privacy', 'Terms', 'Regulatory Disclosures'].map(l => (
          <a
            key={l}
            href="#"
            className="transition-colors hover:text-slate-900"
            style={{ color: '#94a3b8' }}
          >
            {l}
          </a>
        ))}
      </div>
    </footer>
  );
}
