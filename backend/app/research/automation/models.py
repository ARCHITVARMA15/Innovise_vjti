from datetime import date
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field
from app.research.financial_models import FactInput

class Strict(BaseModel):
    model_config=ConfigDict(extra='forbid',str_strip_whitespace=True)

class Start(Strict):
    query:str=Field(min_length=3,max_length=4000)
    request_id:str=Field(min_length=16,max_length=80,pattern=r'^[A-Za-z0-9_-]+$')
    as_of_date:date
    company:str|None=Field(default=None,max_length=200)
    year_basis:Literal['fiscal','calendar']|None=None
    metrics:list[Literal['revenue_growth','net_profit_margin','current_ratio','debt_to_equity']]=Field(default_factory=lambda:['revenue_growth','net_profit_margin','current_ratio'],min_length=1,max_length=4)

class Clarify(Strict):
    expected_revision:int=Field(ge=1)
    company:str|None=Field(default=None,max_length=200)
    year_basis:Literal['fiscal','calendar']|None=None

class ReviewItem(Strict):
    fact_id:str
    expected_revision:int=Field(ge=1)
    values:FactInput|None=None

class BatchReview(Strict):
    request_id:str=Field(min_length=16,max_length=80,pattern=r'^[A-Za-z0-9_-]+$')
    expected_revision:int=Field(ge=1)
    acknowledge:bool=False
    reason:str=Field(min_length=3,max_length=1000)
    items:list[ReviewItem]=Field(min_length=1,max_length=30)

class Continue(Strict):
    expected_revision:int=Field(ge=1)
    allow_partial:bool=False

class Fallback(Strict):
    accession: str = Field(pattern=r"^\d{10}-\d{2}-\d{6}$")
    expected_revision:int=Field(ge=1)
    document_id:str|None=None
    source_url:str|None=Field(default=None,max_length=2048)
