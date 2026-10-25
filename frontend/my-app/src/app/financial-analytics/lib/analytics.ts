export type Transaction = {
  id: string; sourceRow: number; date: string; description: string;
  type: 'income' | 'expense'; amountPaise: number; category: string;
};
export type ReviewAlert = {
  id: string; rowId?: string; title: string; severity: 'Warning' | 'Critical'; body: string;
};
export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_ROWS = 25000;
export const money = (paise: number) => new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', maximumFractionDigits: 2,
}).format(paise / 100);

export function parseMoney(value: string): number {
  if (!/^(?:\d+(?:\.\d{1,2})?|\.\d{1,2})$/.test(value.trim()))
    throw new Error('Enter a positive amount with at most two decimal places, without currency symbols or separators.');
  const [whole, fraction = ''] = value.trim().split('.');
  const paise = Number(whole || '0') * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(paise) || paise <= 0) throw new Error('Amount must be positive and within the supported numeric range.');
  return paise;
}

/** Strict CSV state machine: quoted commas/newlines, escaped quotes, BOM and CRLF. */
export function parseTransactions(text: string): Transaction[] {
  const input = text.replace(/^\uFEFF/, '');
  const records: { cells: string[]; line: number }[] = [];
  let cells: string[] = [], field = '', quoted = false, closed = false, line = 1, startLine = 1;
  const finishField = () => { cells.push(field); field = ''; closed = false; };
  const finishRow = () => {
    finishField();
    if (cells.some(cell => cell.trim()) || cells.length > 1) records.push({ cells, line: startLine });
    cells = [];
    if (records.length > MAX_ROWS + 1) throw new Error(`CSV exceeds ${MAX_ROWS.toLocaleString()} transactions.`);
  };
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (quoted) {
      if (ch === '"' && input[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') { quoted = false; closed = true; }
      else { field += ch; if (ch === '\n' || (ch === '\r' && input[i + 1] !== '\n')) line++; }
    } else if (ch === ',') finishField();
    else if (ch === '\n' || ch === '\r') {
      finishRow(); if (ch === '\r' && input[i + 1] === '\n') i++;
      line++; startLine = line;
    } else if (closed) {
      if (ch !== ' ' && ch !== '\t') throw new Error(`Row ${line}: unexpected text after closing quote.`);
    } else if (ch === '"') {
      if (field.length) throw new Error(`Row ${line}: unexpected quote.`);
      quoted = true;
    } else field += ch;
  }
  if (quoted) throw new Error(`Row ${startLine}: quoted field was not closed.`);
  finishRow();
  if (!records.length) throw new Error('The CSV is empty.');
  const headers = records[0].cells.map(cell => cell.trim().toLowerCase());
  if (new Set(headers).size !== headers.length) throw new Error('Duplicate column headers are not allowed.');
  const required = ['date', 'description', 'type', 'amount', 'category'];
  const missing = required.filter(key => !headers.includes(key));
  if (missing.length) throw new Error(`Missing required columns: ${missing.join(', ')}.`);
  if (records.length < 2) throw new Error('The CSV has no transaction rows.');
  let totalPaise = 0;
  return records.slice(1).map(({ cells, line }) => {
    if (cells.length !== headers.length) throw new Error(`Row ${line}: expected ${headers.length} columns, found ${cells.length}.`);
    const get = (key: string) => cells[headers.indexOf(key)].trim();
    const date = get('date'), description = get('description'), type = get('type').toLowerCase(), category = get('category');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date)
      throw new Error(`Row ${line}: date must be a valid YYYY-MM-DD date.`);
    if (!description || !category) throw new Error(`Row ${line}: description and category cannot be empty.`);
    if (type !== 'income' && type !== 'expense') throw new Error(`Row ${line}: type must be income or expense.`);
    let amountPaise: number;
    try { amountPaise = parseMoney(get('amount')); }
    catch (error) { throw new Error(`Row ${line}: ${error instanceof Error ? error.message : 'Invalid amount.'}`); }
    totalPaise += amountPaise;
    if (!Number.isSafeInteger(totalPaise)) throw new Error(`Row ${line}: dataset total exceeds the supported numeric range.`);
    return { id: `row-${line}`, sourceRow: line, date, description, type, amountPaise, category };
  });
}

export function summarize(rows: Transaction[]) {
  let income = 0, expenses = 0;
  const months = new Map<string, { month: string; income: number; expenses: number; net: number }>();
  for (const row of rows) {
    const month = row.date.slice(0, 7);
    const group = months.get(month) ?? { month, income: 0, expenses: 0, net: 0 };
    if (row.type === 'income') { income += row.amountPaise; group.income += row.amountPaise; }
    else { expenses += row.amountPaise; group.expenses += row.amountPaise; }
    group.net = group.income - group.expenses;
    months.set(month, group);
  }
  const dates = rows.map(row => row.date).sort();
  return { income, expenses, net: income - expenses, count: rows.length,
    period: rows.length ? `${dates[0]} to ${dates[dates.length - 1]}` : '',
    months: [...months.values()].sort((a, b) => a.month.localeCompare(b.month)) };
}

export function deriveAlerts(rows: Transaction[], high: number, loss: number): ReviewAlert[] {
  if (![high, loss].every(value => Number.isSafeInteger(value) && value > 0)) throw new Error('Thresholds must be positive INR amounts.');
  if (!rows.length) return [];
  const summary = summarize(rows);
  const alerts: ReviewAlert[] = rows.filter(row => row.amountPaise >= high).map(row => ({
    id: `high-${row.id}-${high}`, rowId: row.id, title: 'High-value transaction', severity: 'Warning',
    body: `Row ${row.sourceRow}: ${row.description} · ${row.date} · ${row.type} ${money(row.amountPaise)} meets the ${money(high)} threshold.`,
  }));
  if (summary.net <= -loss) alerts.unshift({
    id: `cash-flow-${loss}`, title: 'Negative net cash flow', severity: 'Critical',
    body: `${summary.period}: net cash flow ${money(summary.net)} meets the negative threshold of −${money(loss)} across the loaded dataset.`,
  });
  return alerts;
}

export function whatsappDraft(alert: ReviewAlert): string {
  return `https://wa.me/?text=${encodeURIComponent(`Veritas review alert: ${alert.title}\n${alert.body}\nPlease review the Financial Analytics dashboard. This is a rule-based signal for analyst review.`)}`;
}
