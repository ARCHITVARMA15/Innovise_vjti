import { apiFetch, apiPost } from './client';

export interface WatchSnapshot {
  id:string;company_id:string;display_name:string;period_start:string;period_end:string;period_type:string;accounting_basis:string;currency:string;scale:string;observed_at:string;source_type:string;event_id:string;values:Record<string,string|null>;
}
export interface WatchRules {revenue_decline_percent:string;margin_decline_pp:string;current_ratio_boundary:string;profit_to_loss:boolean}
export interface WatchSettings {watched:boolean;monitoring_enabled:boolean;whatsapp_enabled:boolean;rules:WatchRules;case_id:string|null}
export interface Kpis {values:Record<string,string|null>;unavailable:Record<string,string>}
export interface WatchAnalysis {previous:Kpis;current:Kpis;calculations:{name:string;formula:string;result:string|null;unit:string;inputs:Record<string,string>}[];breaches:{rule:string;actual:string;threshold:string;explanation:string;severity:string}[];gaps:string[];summary:string;comparison:string}
export interface WatchAlert {id:string;event_id:string;created_at:string;severity:string;baseline:WatchSnapshot;current:WatchSnapshot;analysis:WatchAnalysis;rules:WatchRules;duplicate_of:string|null;acknowledged_at:string|null;notification_note:string}
export interface WatchNotification {delivery_mode?:string;delivery_label?:string;trial_notice?:string|null;provider_message_body?:string;id:string;alert_id:string|null;event_id:string;kind:string;recipient_ref:string;state:string;message_sid:string|null;provider_status:string|null;message:string;variables:Record<string,string>;content_sid:string;error_code:string|null;error_message:string|null;last_status_check_error?:string;attempts:number;created_at:string;updated_at:string;history:{at:string;state:string;note:string}[]}
export interface WatchEvent {id:string;scenario:string;observed_at:string;snapshot_id:string;baseline_id:string;source_type:string;monitoring_evaluated:boolean;alert_id:string|null;notification_note:string;analysis:WatchAnalysis|null;new_demo_replay:boolean}
export interface NotificationConfig {recipient_ref?:string;delivery_mode?:string;delivery_label?:string;trial_notice?:string|null;mode:string;configuration_ready:boolean;destination:string;content_mode:string;missing:string[];readiness_note:string;delivery_ready?:boolean;account_type?:string;account_status?:string;session?:string;restriction?:string}
export interface WatchView {company:{id:string;name:string};settings:WatchSettings;baseline:WatchSnapshot;active:WatchSnapshot;baseline_kpis:Kpis;active_kpis:Kpis;events:WatchEvent[];alerts:WatchAlert[];notifications:WatchNotification[];notification_config:NotificationConfig;limits:{duplicate_cooldown_seconds:number;notification_interval_seconds:number;daily_notification_limit:number};label:string}
const root='/analyst-watch';
export const getWatch=()=>apiFetch<WatchView>(root,{cache:'no-store'});
export const saveWatch=(settings:WatchSettings)=>apiPost<WatchView>(`${root}/settings`,{watched:settings.watched,monitoring_enabled:settings.monitoring_enabled,whatsapp_enabled:settings.whatsapp_enabled,rules:settings.rules});
export const publishDemo=(scenario:string,event_id:string,new_demo_replay:boolean)=>apiPost<WatchEvent>(`${root}/demo-console/publish`,{scenario,event_id,new_demo_replay});
export const acknowledgeWatch=(id:string)=>apiPost<WatchAlert>(`${root}/alerts/${encodeURIComponent(id)}/acknowledge`,{});
export const notifyWatch=(id:string,replay:boolean)=>apiPost<{notification:WatchNotification|null;note:string}>(`${root}/alerts/${encodeURIComponent(id)}/notify`,{request_id:crypto.randomUUID(),new_demo_replay:replay});
export const testWatch=()=>apiPost<{notification:WatchNotification|null;note:string}>(`${root}/notifications/test`,{request_id:crypto.randomUUID()});
export const checkWatch=()=>apiPost<NotificationConfig>(`${root}/notifications/check`,{});
export const reconcileWatch=(id:string,sid?:string)=>apiPost<WatchNotification>(`${root}/notifications/${encodeURIComponent(id)}/reconcile`,{message_sid:sid||null});
export const retryWatch=(id:string)=>apiPost<WatchNotification>(`${root}/notifications/${encodeURIComponent(id)}/retry`,{});
export const linkWatchResearch=()=>apiPost<{case_id:string}>(`${root}/research-case`,{});
