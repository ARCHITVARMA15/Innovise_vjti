'use client';

export default function PLCalendar() {
  // Mock data for March 2025 calendar
  const calendarData = [
    { day: 1, pnl: 0, class: 'cal-neutral' },
    { day: 3, pnl: 8420, class: 'cal-profit-2' },
    { day: 4, pnl: 3200, class: 'cal-profit-1' },
    { day: 5, pnl: -2100, class: 'cal-loss-1' },
    { day: 6, pnl: 18900, class: 'cal-profit-3' },
    { day: 7, pnl: 4200, class: 'cal-profit-1' },
    { day: 10, pnl: -9800, class: 'cal-loss-2' },
    { day: 11, pnl: -3400, class: 'cal-loss-1' },
    { day: 12, pnl: 120, class: 'cal-neutral' },
    { day: 13, pnl: 7600, class: 'cal-profit-2' },
    { day: 14, pnl: 22400, class: 'cal-profit-3' },
    { day: 17, pnl: 5100, class: 'cal-profit-1' },
    { day: 18, pnl: 11200, class: 'cal-profit-2' },
    { day: 19, pnl: -28000, class: 'cal-loss-3' },
    { day: 20, pnl: -4500, class: 'cal-loss-1' },
    { day: 21, pnl: 2800, class: 'cal-profit-1' },
    { day: 24, pnl: 9400, class: 'cal-profit-2' },
    { day: 25, pnl: 19600, class: 'cal-profit-3' },
    { day: 26, pnl: 6200, class: 'cal-profit-1' },
    { day: 27, pnl: 8100, class: 'cal-profit-2' },
    { day: 28, pnl: 3900, class: 'cal-profit-1' },
    { day: 31, pnl: 4700, class: 'cal-profit-1' },
  ];

  const getCalendarGrid = () => {
    const grid = Array(35).fill(null);
    // March 2025 starts on Saturday (index 6)
    calendarData.forEach((data) => {
      const date = new Date(2025, 2, data.day);
      const dayOfWeek = date.getDay();
      const weekNumber = Math.floor((data.day + 5) / 7);
      const index = weekNumber * 7 + dayOfWeek;
      grid[index] = data;
    });
    return grid;
  };

  const grid = getCalendarGrid();

  return (
    <section className="bg-white rounded-xl glass-card-edge p-7 shadow-[0_24px_40px_rgba(11,28,48,0.05)]">
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-[10px] uppercase tracking-widest font-bold text-slate-500 mb-1" style={{ fontFamily: 'Inter, sans-serif' }}>
            Daily P&L
          </p>
          <h3 className="text-lg font-bold text-black" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Performance Calendar — March 2025
          </h3>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-slate-500 font-medium">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-[#4edea3] inline-block"></span> Strong gain
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-[#d4f7eb] inline-block"></span> Gain
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-[#eff4ff] inline-block"></span> Flat
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-[#fde8e8] inline-block"></span> Loss
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-[#f87171] inline-block"></span> Strong loss
          </span>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="overflow-x-auto">
        <div className="grid grid-cols-7 gap-2 min-w-[280px]">
          {/* Day headers */}
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <div key={day} className="text-[10px] font-bold uppercase text-slate-500 text-center py-1">
              {day}
            </div>
          ))}

          {/* Calendar cells */}
          {grid.map((cell, index) => {
            if (!cell) {
              return <div key={index} className="w-7 h-7"></div>;
            }

            const bgColors: Record<string, string> = {
              'cal-profit-3': 'bg-[#4edea3] text-[#002113]',
              'cal-profit-2': 'bg-[#9fefcf] text-[#002113]',
              'cal-profit-1': 'bg-[#d4f7eb] text-[#005236]',
              'cal-loss-1': 'bg-[#fde8e8] text-[#7f1d1d]',
              'cal-loss-2': 'bg-[#fbbaba] text-[#7f1d1d]',
              'cal-loss-3': 'bg-[#f87171] text-[#450a0a]',
              'cal-neutral': 'bg-[#eff4ff] text-[#76777d]',
            };

            return (
              <div
                key={index}
                className={`w-7 h-7 rounded flex items-center justify-center text-[9px] font-semibold cursor-pointer transition-transform hover:scale-125 hover:z-10 relative group ${bgColors[cell.class]}`}
              >
                {cell.day}
                {/* Tooltip */}
                <div className="hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-[#131b2e] text-white text-[11px] whitespace-nowrap px-2.5 py-1.5 rounded-md z-50">
                  Mar {cell.day} · {cell.pnl >= 0 ? '+' : ''}₹{Math.abs(cell.pnl).toLocaleString('en-IN')}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
