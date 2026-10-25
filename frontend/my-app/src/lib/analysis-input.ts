/** Preserve commas that are part of saved period labels. */
export function parseAnalysisPeriods(value: string): string[] {
  return value.split(/\r?\n|;/).map(period => period.trim()).filter(Boolean);
}

/** Run overrides belong to the immutable run, not the case metadata. */
export function analysisAsOf(run: {
  snapshot: {research_as_of_date?: string | null; case: {research_as_of_date: string | null}};
  request?: {research_as_of_date?: string | null};
  scope?: {research_as_of_date?: string | null} | null;
}): string | null {
  return run.snapshot.research_as_of_date ?? run.request?.research_as_of_date
    ?? run.scope?.research_as_of_date ?? run.snapshot.case.research_as_of_date;
}

/** Each margin/ratio is a separate operation for every requested period. */
export function analysisCalculations(types: string[], periods: string[]) {
  return types.flatMap(calculation_type => calculation_type === 'revenue_growth'
    ? [{calculation_type, periods}]
    : (periods.length ? periods : ['']).map(period => ({calculation_type, periods: period ? [period] : []})));
}
