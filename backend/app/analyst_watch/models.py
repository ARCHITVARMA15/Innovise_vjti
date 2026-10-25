"""Analyst Watch contracts. Demo data enters only through a provider boundary."""
from datetime import date
from decimal import Decimal
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

COMPANY_ID = 'aster-demo'
COMPANY_NAME = 'Aster Technologies — Demo'

class Strict(BaseModel):
    model_config = ConfigDict(extra='forbid')

class Snapshot(Strict):
    id: str
    company_id: Literal['aster-demo'] = COMPANY_ID
    display_name: Literal['Aster Technologies — Demo'] = COMPANY_NAME
    period_start: date
    period_end: date
    period_type: Literal['quarter'] = 'quarter'
    accounting_basis: str = 'consolidated demo'
    currency: str = 'USD'
    scale: Literal['millions'] = 'millions'
    observed_at: str
    source_type: Literal['simulated'] = 'simulated'
    event_id: str
    values: dict[str, Decimal | None]

    @field_validator('values')
    @classmethod
    def finite(cls, values):
        if set(values) - {'revenue','net_income','current_assets','current_liabilities'}:
            raise ValueError('Unknown financial measure.')
        if any(v is not None and (not v.is_finite() or abs(v) > Decimal('1e12')) for v in values.values()):
            raise ValueError('Financial values must be finite bounded decimals.')
        return values

    @model_validator(mode='after')
    def dates(self):
        if self.period_start > self.period_end:
            raise ValueError('Period start must precede period end.')
        return self

class Rules(Strict):
    revenue_decline_percent: Decimal = Field(default=Decimal('15'), ge=0, le=100)
    margin_decline_pp: Decimal = Field(default=Decimal('5'), ge=0, le=100)
    current_ratio_boundary: Decimal = Field(default=Decimal('1'), gt=0, le=10)
    profit_to_loss: bool = True

class SettingsInput(Strict):
    watched: bool = True
    monitoring_enabled: bool
    whatsapp_enabled: bool
    rules: Rules

class Publish(Strict):
    event_id: str = Field(min_length=16, max_length=80, pattern=r'^[a-zA-Z0-9_-]+$')
    scenario: Literal['earnings_shock','positive_results','liquidity_deterioration','stable','reset']
    new_demo_replay: bool = False

class Intent(Strict):
    request_id: str = Field(min_length=16, max_length=80, pattern=r'^[a-zA-Z0-9_-]+$')
    new_demo_replay: bool = False

class Reconcile(Strict):
    message_sid: str | None = Field(default=None, pattern=r'^SM[0-9a-fA-F]{32}$')
