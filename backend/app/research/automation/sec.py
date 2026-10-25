"""Official SEC identity, 10-K selection and conservative XBRL projections."""
import json
import re
from datetime import date, datetime
from decimal import Decimal
from html.parser import HTMLParser
from urllib.parse import quote
from .network import RetrievalError

TAGS={
 'revenue':['RevenueFromContractWithCustomerExcludingAssessedTax','Revenues','SalesRevenueNet','RevenueFromContractWithCustomerIncludingAssessedTax'],
 'net_income':['NetIncomeLoss','ProfitLoss'],
 'current_assets':['AssetsCurrent'], 'current_liabilities':['LiabilitiesCurrent'],
 'total_equity':['StockholdersEquity'],
}
# No general total-debt mapping is safe: liabilities and incomplete/overlapping
# borrowing tags are never substituted. Existing reviewed debt can be reused.
FLOW={'revenue','net_income'}

def clean(value):
    text=re.sub(r'[^a-z0-9 ]',' ',value.lower())
    return ' '.join(t for t in text.split() if t not in {'inc','incorporated','corp','corporation','company','co','ltd','limited','plc','the'})

def rows(data):
    if isinstance(data,list):return data
    if not data:return []
    count=len(data.get('accessionNumber',[]))
    return [{k:v[i] for k,v in data.items() if isinstance(v,list) and i<len(v)} for i in range(count)]

class FilingHTML(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True);self.parts=[];self.skip=[];self.captures=[];self.ix_depth=0;self.meta={}
    def handle_starttag(self,tag,attrs):
        attrs=dict(attrs);name=attrs.get('name','').lower().split(':')[-1]
        if tag.startswith('ix:'):self.ix_depth+=1
        if name in {'documentfiscalyearfocus','documentfiscalperiodfocus','documentperiodenddate','entityregistrantname'}:
            self.captures.append([name,tag,self.ix_depth,[]])
        if tag in ('script','style','head','ix:hidden'):self.skip.append(tag)
        if not self.skip and tag in ('p','div','tr','br','h1','h2','h3','h4'):self.parts.append('\n')
        if not self.skip and tag in ('td','th'):self.parts.append(' | ')
    def handle_endtag(self,tag):
        for capture in list(self.captures):
            name,opening,depth,parts=capture
            if tag==opening and depth==self.ix_depth:
                self.meta.setdefault(name,[]).append(' '.join(''.join(parts).split()));self.captures.remove(capture)
        if tag.startswith('ix:'):self.ix_depth=max(0,self.ix_depth-1)
        if self.skip and tag==self.skip[-1]:self.skip.pop()
        if not self.skip and tag in ('p','div','tr','table','h1','h2','h3','h4'):self.parts.append('\n')
    def handle_data(self,data):
        for capture in self.captures:
            if sum(map(len,capture[3]))+len(data)>2048:raise RetrievalError('Inline filing metadata exceeds its bounded text limit.')
            capture[3].append(data)
        if not self.skip:self.parts.append(data)
    def sections(self):
        text='\n'.join(' '.join(x.split()) for x in ''.join(self.parts).splitlines() if x.strip())
        if not text or len(text)>2_000_000:raise RetrievalError('HTML has no usable text or exceeds the 2-million-character extraction limit. Use a bounded manual source.')
        result=[]
        for index,start in enumerate(range(0,len(text),8000),1):
            result.append({'position':index,'page_number':None,'label':f'HTML section {index:04d} (character span {start}:{min(start+8000,len(text))})',
                'text':text[start:start+8000],'extraction_status':'extracted'})
        return result

def parse_html(raw):
    parser=FilingHTML();parser.feed(raw.decode('utf-8-sig',errors='replace'));parser.close()
    return parser.sections(),parser.meta

def fiscal_end(value):
    """Recognize explicit SEC inline date renderings without guessing a year."""
    for fmt in ('%Y-%m-%d','%B %d, %Y','%B %d %Y','%m/%d/%Y'):
        try:return datetime.strptime(value.strip(),fmt).date().isoformat()
        except ValueError:pass
    raise RetrievalError('Unsupported fiscal-end rendering in primary filing; manual source review is required.')

class SecProvider:
    def __init__(self,client):self.client=client
    def resolve(self,query,company=None):
        hint=company or query
        cik=re.fullmatch(r'(?:CIK\s*)?(\d{1,10})',hint.strip(),re.I)
        if cik:
            data,source=self.client.json(f'https://data.sec.gov/submissions/CIK{int(cik[1]):010d}.json')
            return {'cik':f'{int(data["cik"]):010d}','name':data['name'],'ticker':next(iter(data.get('tickers',[])),None),'identity_source':source['final_url']},data
        mapping,source=self.client.json('https://www.sec.gov/files/company_tickers.json',86400)
        choices=[];normal=' '+clean(hint)+' '
        for record in mapping.values():
            title=clean(record['title']);ticker=record['ticker']
            if (company and clean(company) in (title,clean(ticker))) or (len(title)>=3 and ' '+title+' ' in normal) or re.search(r'(?<![A-Za-z0-9])'+re.escape(ticker)+r'(?![A-Za-z0-9])',hint):
                choices.append(record)
        if len(choices)!=1:
            return {'questions':['Which single SEC company do you mean? Select its exact ticker or enter its CIK.'],'company_choices':[{'name':c['title'],'ticker':c['ticker'],'cik':str(c['cik_str']).zfill(10)} for c in choices[:10]]},None
        match=choices[0];cik=str(match['cik_str']).zfill(10)
        data,subsource=self.client.json(f'https://data.sec.gov/submissions/CIK{cik}.json')
        if str(int(data['cik']))!=str(int(cik)):raise RetrievalError('Official mapping and submissions CIK do not agree.')
        return {'cik':cik,'name':data['name'],'ticker':match['ticker'],'identity_source':source['final_url'],'submissions_source':subsource['final_url']},data
    def discover(self,entity,submissions,years,as_of):
        history=rows(submissions['filings']['recent']);followed=[]
        def wanted(year):return [r for r in history if r.get('form')=='10-K' and r.get('reportDate','')[:4]==str(year) and r.get('filingDate','9999')<=as_of]
        for old in submissions['filings'].get('files',[]):
            if all(wanted(y) for y in years):break
            if len(followed)>=4:break
            if old.get('filingFrom','0000')>as_of or old.get('filingTo','9999')<f'{min(years)}-01-01':continue
            filename=old['name']
            if not re.fullmatch(r'CIK\d{10}-submissions-\d+\.json',filename):raise RetrievalError('Unsupported SEC additional-history filename.')
            data,_=self.client.json('https://data.sec.gov/submissions/'+filename,86400);history.extend(rows(data));followed.append(filename)
        decisions=[];selected=[];blockers=[]
        for year in sorted(years):
            candidates=sorted(wanted(year),key=lambda r:r['filingDate'])
            if not candidates:
                blockers.append(f'No eligible 10-K with report date in {year} was found by {as_of} within the bounded submissions history. Enter/upload the official source manually; fiscal-label exceptions require explicit review.');continue
            filing=candidates[-1]
            amendments=[r for r in history if r.get('form')=='10-K/A' and r.get('reportDate')==filing['reportDate'] and r.get('filingDate','9999')<=as_of]
            if amendments:blockers.append(f'Eligible 10-K/A found for {filing["reportDate"]}. Automated amendment/restatement resolution is unsupported; manual source resolution is required.')
            accession=filing['accessionNumber'];primary=filing['primaryDocument']
            if not re.fullmatch(r'\d{10}-\d{2}-\d{6}',accession) or not re.fullmatch(r'[A-Za-z0-9_.-]+',primary):raise RetrievalError('Invalid accession or primary-document metadata from SEC.')
            chosen={**filing,'cik':entity['cik'],'requested_year':year,'url':f'https://www.sec.gov/Archives/edgar/data/{int(entity["cik"])}/{accession.replace("-","")}/{quote(primary)}',
                'selection_rationale':f'Official submissions 10-K report date {filing["reportDate"]}, filed {filing["filingDate"]} no later than {as_of}. Fiscal year focus is verified after ingestion.',
                'amendments':[{'accession':r['accessionNumber'],'filed':r['filingDate']} for r in amendments]}
            selected.append(chosen);decisions.append(chosen)
        return selected,decisions,blockers,followed
    def companyfacts(self,entity):
        data,source=self.client.json(f'https://data.sec.gov/api/xbrl/companyfacts/CIK{entity["cik"]}.json',21600)
        if int(data.get('cik',-1))!=int(entity['cik']):raise RetrievalError('XBRL companyfacts entity does not match the resolved SEC CIK.')
        return data,source

def prepare_records(data,filing,entity,basis,basis_evidence):
    """Whole-entity standard facts only; exact accession and USD annual contexts."""
    selected=[];issues=[];taxonomy=data.get('facts',{}).get('us-gaap',{})
    for metric,tags in TAGS.items():
        options=[]
        for tag in tags:
            node=taxonomy.get(tag,{})
            for unit,records in node.get('units',{}).items():
                for index,record in enumerate(records):
                    if record.get('accn')!=filing['accessionNumber'] or record.get('form')!='10-K' or record.get('end')!=filing['reportDate'] or record.get('filed','9999')>filing['filingDate']:continue
                    if unit!='USD':continue
                    if metric in FLOW:
                        if not record.get('start') or record.get('fp')!='FY':continue
                        days=(date.fromisoformat(record['end'])-date.fromisoformat(record['start'])).days
                        if not 330<=days<=380:continue
                    elif record.get('start'):continue
                    if not isinstance(record.get('val'),(int,float,Decimal)) or isinstance(record.get('val'),bool):continue
                    value=Decimal(str(record['val']))
                    if not value.is_finite():continue
                    options.append({'metric':metric,'tag':tag,'unit':unit,'record':record,'index':index,'value':str(value),
                                    'json_pointer':f'/facts/us-gaap/{tag}/units/{unit}/{index}'})
        unique={(o['value'],o['record'].get('start'),o['record']['end']) for o in options}
        if not options:
            issues.append(f'FY{filing["requested_year"]} {metric}: no exact-accession USD annual/instant context for an approved tag. Missing values were not inferred as zero.');continue
        conflict=len(unique)>1
        # Preserve distinct competing records for review; exact duplicate contexts do not create duplicate candidates.
        seen=set()
        for option in options:
            key=(option['value'],option['record'].get('start'),option['record']['end'])
            if key in seen:continue
            seen.add(key);record=option['record']
            ambiguity='Competing approved tags/contexts disagree; inspect and resolve before confirmation.' if conflict else None
            if not basis:ambiguity='Accounting basis could not be established from the filing; review explicit source evidence.'
            selected.append({**option,'entity':entity['name'],'currency':'USD','scale':'units','reporting_period':f'FY{filing["requested_year"]}',
                'period_start':record.get('start') if metric in FLOW else None,'period_end':record['end'],'period_type':'duration' if metric in FLOW else 'instant',
                'accounting_scope':basis,'ambiguity_note':ambiguity,'basis_evidence':basis_evidence})
    return selected,issues
