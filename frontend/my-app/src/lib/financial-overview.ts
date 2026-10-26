import type {CalculationReceipt, CalculationType, Fact} from './api/financials';

// Group presentation only. All ratio arithmetic remains on the backend.
export function currentMetricReceipts(receipts:CalculationReceipt[]):CalculationReceipt[]{
 const groups=new Map<string,CalculationReceipt>();
 for(const receipt of receipts){
  if(receipt.status!=='valid'||receipt.display_result===null)continue;
  const scope=Object.entries(receipt.inputs).sort(([a],[b])=>a.localeCompare(b)).map(([role,fact])=>
   [role,fact.entity,fact.currency,fact.accounting_scope,fact.reporting_period,fact.period_start,fact.period_end]);
  const key=JSON.stringify([receipt.calculation_type,scope]);
  const previous=groups.get(key);
  if(!previous||receipt.created_at>previous.created_at)groups.set(key,receipt);
 }
 return [...groups.values()].sort((a,b)=>{
  const end=(r:CalculationReceipt)=>Object.values(r.inputs).map(f=>f.period_end||'').sort().at(-1)||'';
  return end(b).localeCompare(end(a));
 });
}

export function overviewFacts(facts:Fact[]):Fact[]{
 return facts.filter(f=>f.status==='confirmed'&&f.source_available&&!f.removed_at&&!f.ambiguity_note&&f.accounting_scope&&f.currency&&f.scale)
  .sort((a,b)=>(b.period_end||'').localeCompare(a.period_end||''));
}

export function receiptPeriod(receipt:CalculationReceipt):string{
 const label=(role:string)=>receipt.inputs[role]?.reporting_period||receipt.inputs[role]?.period_end||'Unknown period';
 if(receipt.calculation_type==='revenue_growth'||receipt.calculation_type==='net_income_growth')return `${label('previous')} → ${label('current')}`;
 return [...new Set(Object.values(receipt.inputs).map(f=>f.reporting_period||f.period_end||'Unknown period'))].join(' / ');
}

export function displayFactAmount(value:string):string{
 // Preserve every decimal digit; Number() can lose precision for large values.
 const [integer,fraction]=value.split('.');
 return integer.replace(/\B(?=(\d{3})+(?!\d))/g,',')+(fraction===undefined?'':'.'+fraction);
}

export function displayReceiptResult(receipt:CalculationReceipt):string{
 if(receipt.display_result===null)return 'Unavailable';
 if(receipt.result_unit==='%')return receipt.display_result+'%';
 if(receipt.result_unit==='ratio')return receipt.display_result+' ×';
 return formatFinancialAmount(receipt.display_result,receipt.result_unit);
}

/** Display-only scale conversion using integer arithmetic, never Number(decimal). */
export function formatFinancialAmount(value:string|number|null|undefined,currency?:string|null,scale:string|null='units'):string{
 if(value===null||value===undefined||value==='')return 'Unavailable';
 const raw=String(value).trim();
 const match=/^([+-]?)(\d*)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/.exec(raw);
 if(!match||!(match[2]||match[3])||raw.length>200)return 'Unavailable';
 const powers:Record<string,number>={units:0,thousands:3,millions:6,billions:9,lakh:5,crore:7,paise:-2};
 const power=scale===null?undefined:powers[scale];
 const label=currency?` ${currency}`:'';
 if(power===undefined)return `${displayFactAmount(raw)}${label} (${scale||'unknown scale'})`;
 const exponent=Number(match[4]||0)-(match[3]||'').length+power;
 if(Math.abs(exponent)>100)return 'Unavailable';
 const coefficient=BigInt((match[2]||'0')+(match[3]||''));
 const numerator=coefficient*BigInt(10)**BigInt(Math.max(exponent,0));
 const denominator=BigInt(10)**BigInt(Math.max(-exponent,0));
 let divisor=numerator>=denominator*BigInt(1e9)?BigInt(1e9):numerator>=denominator*BigInt(1e6)?BigInt(1e6):BigInt(1);
 let rounded=(numerator*BigInt(100)+denominator*divisor/BigInt(2))/(denominator*divisor);
 if(divisor===BigInt(1e6)&&rounded>=BigInt(100000)){divisor=BigInt(1e9);rounded=(numerator*BigInt(100)+denominator*divisor/BigInt(2))/(denominator*divisor);}
 if(divisor===BigInt(1)&&rounded>=BigInt(100000000)){divisor=BigInt(1e6);rounded=(numerator*BigInt(100)+denominator*divisor/BigInt(2))/(denominator*divisor);}
 const whole=String(rounded/BigInt(100)).replace(/\B(?=(\d{3})+(?!\d))/g,',');
 const fraction=String(rounded%BigInt(100)).padStart(2,'0').replace(/0+$/,'');
 return `${match[1]==='-'&&rounded!==BigInt(0)?'-':''}${whole}${fraction?'.'+fraction:''}${divisor===BigInt(1e9)?'B':divisor===BigInt(1e6)?'M':''}${label}`;
}

export function receiptInputDefaults(type:CalculationType,facts:Fact[],receipts:CalculationReceipt[]):Record<string,string>{
 for(const receipt of currentMetricReceipts(receipts).filter(r=>r.calculation_type===type)){
  const entries=Object.entries(receipt.inputs);
  if(entries.length&&entries.every(([,input])=>facts.some(f=>f.id===input.id&&f.revision===input.revision&&f.status==='confirmed'&&f.source_available&&!f.removed_at&&!f.ambiguity_note)))
   return Object.fromEntries(entries.map(([role,input])=>[role,input.id]));
 }
 return {};
}
