"""Pure Decimal analysis, reusing Research Lab's financial tools."""
import calendar
from datetime import date
from decimal import Decimal, localcontext
from uuid import uuid4
from app.research.calculations import current_ratio, net_profit_margin, revenue_growth, CalculationUnavailable
from app.research.store import now
from .models import Snapshot, Rules

VALUES = {
    'baseline': ('100','12','160','100'),
    'earnings_shock': ('75','-3','95','100'),
    'positive_results': ('120','18','180','100'),
    'liquidity_deterioration': ('100','12','90','100'),
    'stable': ('100','12','160','100'),
}

class DemoProvider:
    """Only this adapter manufactures demo values. Future providers call ingest()."""
    def snapshot(self, scenario, event_id):
        baseline = scenario in ('baseline','reset')
        return Snapshot(id=str(uuid4()),event_id=event_id,observed_at=now(),
            period_start='2025-01-01' if baseline else '2025-04-01',
            period_end='2025-03-31' if baseline else '2025-06-30',
            values=dict(zip(('revenue','net_income','current_assets','current_liabilities'),
                            VALUES['baseline' if baseline else scenario])))


def quarter(s):
    start,end=s.period_start,s.period_end
    return (start.month in (1,4,7,10) and start.day==1 and end.year==start.year
            and end.month==start.month+2 and end.day==calendar.monthrange(end.year,end.month)[1])


def compatible(previous, current):
    for field in ('company_id','currency','scale','accounting_basis','period_type','source_type'):
        if getattr(previous,field)!=getattr(current,field):
            raise ValueError(f'Incompatible snapshot {field}.')
    if not quarter(previous) or not quarter(current) or current.period_start.toordinal()!=previous.period_end.toordinal()+1:
        raise ValueError('Comparison requires adjacent complete calendar quarters. Same-period revisions are not quarter-over-quarter growth.')


def kpis(snapshot):
    v=snapshot.values
    result={k:str(v[k]) if v.get(k) is not None else None for k in ('revenue','net_income','current_assets','current_liabilities')}
    unavailable={}
    for key,tool,args in [('net_margin',net_profit_margin,('net_income','revenue')),
                          ('current_ratio',current_ratio,('current_assets','current_liabilities'))]:
        try:
            if any(v.get(a) is None for a in args):
                raise CalculationUnavailable('Missing required financial input.')
            if key=='current_ratio' and any(v[a]<0 for a in args):
                raise CalculationUnavailable('Negative liquidity input requires analyst review.')
            result[key]=str(tool(**{a:v[a] for a in args}))
        except CalculationUnavailable as error:
            result[key]=None;unavailable[key]=str(error)
    return {'values':result,'unavailable':unavailable}


def evaluate(previous, current, rules):
    compatible(previous,current)
    before,after=kpis(previous),kpis(current)
    calculations=[];breaches=[];gaps=[]
    def receipt(name, formula, value, unit, inputs):
        calculations.append(dict(name=name,formula=formula,result=str(value) if value is not None else None,unit=unit,inputs=inputs))
    def breach(rule,actual,threshold,why,severity='warning'):
        breaches.append(dict(rule=rule,actual=str(actual),threshold=str(threshold),explanation=why,severity=severity))
    with localcontext() as context:
        context.prec=80
        p,c=previous.values,current.values
        if p.get('revenue') is not None and c.get('revenue') is not None:
            try:
                growth=revenue_growth(c['revenue'],p['revenue'])
                receipt('revenue_change','(current revenue − previous revenue) / previous revenue × 100',growth,'%',{'previous':str(p['revenue']),'current':str(c['revenue'])})
                if growth<=-rules.revenue_decline_percent and growth<0:
                    breach('revenue_decline',growth,rules.revenue_decline_percent,f'Revenue declined {abs(growth):.2f}%; configured threshold is at least {rules.revenue_decline_percent}%.')
            except CalculationUnavailable as error:gaps.append(str(error))
        else:gaps.append('Revenue change unavailable: missing revenue input.')
        if p.get('net_income') is not None and c.get('net_income') is not None:
            receipt('net_income_change','current net income − previous net income',c['net_income']-p['net_income'],f'{current.currency} {current.scale}',{'previous':str(p['net_income']),'current':str(c['net_income'])})
            transition=p['net_income']>0 and c['net_income']<0
            receipt('profit_to_loss','previous net income > 0 and current net income < 0',int(transition),'boolean',{'previous':str(p['net_income']),'current':str(c['net_income'])})
            if transition and rules.profit_to_loss:
                breach('profit_to_loss','true','positive → negative','Net income changed from positive to negative.','critical')
        else:gaps.append('Profit transition unavailable: missing net income.')
        for key,unit in [('net_margin','pp'),('current_ratio','ratio')]:
            a,b=before['values'].get(key),after['values'].get(key)
            if a is None or b is None:
                gaps.append(f'{key} comparison unavailable: missing inputs or zero denominator.');continue
            delta=Decimal(b)-Decimal(a)
            receipt(key+'_change','current − previous',delta,unit,{'previous':a,'current':b})
            if key=='net_margin' and delta<=-rules.margin_decline_pp and delta<0:
                breach('margin_decline',delta,rules.margin_decline_pp,f'Net margin declined {abs(delta):.2f} percentage points; configured threshold is {rules.margin_decline_pp} pp.')
            if key=='current_ratio' and Decimal(a)>=rules.current_ratio_boundary and Decimal(b)<rules.current_ratio_boundary:
                breach('liquidity_crossing',b,rules.current_ratio_boundary,f'Current ratio crossed from {Decimal(a):.2f} to {Decimal(b):.2f}, below your {rules.current_ratio_boundary} boundary.','critical')
    summary=' '.join(b['explanation'] for b in breaches) if breaches else 'No configured monitoring threshold was breached.'
    return dict(previous=before,current=after,calculations=calculations,breaches=breaches,gaps=gaps,summary=summary,
                comparison=f'{current.period_start}–{current.period_end} versus {previous.period_start}–{previous.period_end}: adjacent complete quarters, {current.currency} {current.scale}, {current.accounting_basis}. Each predefined scenario is an alternative current-quarter outcome compared with the active baseline; it is not a new actual reporting period.')
