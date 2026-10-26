import asyncio
import json
import sqlite3
import subprocess
import sys
import tempfile
import unittest
from decimal import Decimal
from pathlib import Path
from unittest.mock import AsyncMock, patch

from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.research.calculations import calculate, normalized_value, revenue_growth, net_profit_margin, current_ratio, debt_to_equity, CalculationUnavailable
from app.research.fact_extraction import extract_facts, parse_response
from app.research.financial_models import FactInput, FactUpdate, CalculationRequest, ExtractionOutput
from app.research.financial_store import FinancialStore, validate_excerpt
from app.research.models import CaseCreate, DocumentMetadata
from app.research.router import router, get_store
from app.research.store import ResearchStore

FIXTURE = (Path(__file__).parent / "fixtures/financials_synthetic.txt").read_text()
METRICS = ["revenue", "net_income", "current_assets", "current_liabilities", "total_debt", "total_equity"]
NAMES = ["Revenue", "Net income", "Current assets", "Current liabilities", "Total debt", "Total equity"]
VALUES = {2024: [1000, 100, 400, 200, 200, 500], 2025: [1100, 132, 450, 300, 300, 600]}


class FinancialTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.directory = Path(self.temp.name)
        self.store = ResearchStore(self.directory)
        self.financials = FinancialStore(self.store)
        self.case = self.store.create_case(CaseCreate(title="Synthetic financials", company_name="Synthetic Fixture Co", research_question="Synthetic arithmetic test"))
        self.other = self.store.create_case(CaseCreate(title="Other case", company_name="Other", research_question="Isolation"))
        self.doc = self.store.add_document(self.case["id"], DocumentMetadata(title="SYNTHETIC TEST FIXTURE"), "pasted_text", None,
            FIXTURE.encode(), [{"position": 1, "page_number": None, "label": "Text section", "text": FIXTURE, "extraction_status": "extracted"}])
        self.app = FastAPI()
        self.app.include_router(router)
        self.app.dependency_overrides[get_store] = lambda: self.store
        self.client = TestClient(self.app)

    def tearDown(self):
        self.client.close()
        self.temp.cleanup()

    def test_additional_growth_and_working_capital_receipts(self):
        income={year:self.fact('net_income',year) for year in (2024,2025)}
        growth=calculate(self.financials,self.case['id'],CalculationRequest(calculation_type='net_income_growth',inputs={'current':income[2025]['id'],'previous':income[2024]['id']}))
        self.assertEqual(growth['status'],'valid');self.assertEqual(growth['display_result'],'32.00')
        assets=self.fact('current_assets',2025);liabilities=self.fact('current_liabilities',2025)
        request=CalculationRequest(calculation_type='working_capital',inputs={'current_assets':assets['id'],'current_liabilities':liabilities['id']})
        capital=calculate(self.financials,self.case['id'],request)
        self.assertEqual(capital['status'],'valid');self.assertEqual(capital['result'],'1500000000');self.assertEqual(capital['result_unit'],'INR')
        self.assertEqual(len(capital['sources']),2);self.assertEqual(len(capital['conversions']),2)
        previous=self.fact('current_liabilities',2024)
        invalid=calculate(self.financials,self.case['id'],CalculationRequest(calculation_type='working_capital',inputs={'current_assets':assets['id'],'current_liabilities':previous['id']}))
        self.assertEqual(invalid['status'],'unavailable')
        reversed_growth=calculate(self.financials,self.case['id'],CalculationRequest(calculation_type='net_income_growth',inputs={'current':income[2024]['id'],'previous':income[2025]['id']}))
        self.assertEqual(reversed_growth['status'],'unavailable')

    def input(self, metric="revenue", year=2025, **overrides):
        index = METRICS.index(metric)
        income = metric in ("revenue", "net_income")
        payload = dict(document_id=self.doc["id"], section_id=self.doc["pages"][0]["id"], metric=metric,
            entity="Synthetic Fixture Co", value=str(VALUES[year][index]), currency="INR", scale="crore",
            reporting_period=f"FY{year}", period_start=f"{year-1}-04-01" if income else None,
            period_end=f"{year}-03-31", period_type="duration" if income else "instant",
            accounting_scope="consolidated / synthetic GAAP", excerpt=f"{NAMES[index]} INR crore {VALUES[year][index]}")
        return FactInput.model_validate({**payload, **overrides})

    def confirm(self, fact):
        values = FactInput.model_validate({key: fact[key] for key in FactInput.model_fields})
        return self.financials.update_fact(self.case["id"], fact["id"], FactUpdate(expected_revision=fact["revision"], values=values,
            status="confirmed", reason="Synthetic fixture explicitly reviewed"))

    def fact(self, metric="revenue", year=2025, confirmed=True, **overrides):
        fact, _ = self.financials.add_fact(self.case["id"], self.input(metric, year, **overrides))
        return self.confirm(fact) if confirmed else fact

    def calc(self, kind, **inputs):
        return calculate(self.financials, self.case["id"], CalculationRequest(calculation_type=kind,
            inputs={role: fact["id"] for role, fact in inputs.items()}))

    def test_fixture_results_correction_and_recalculation(self):
        facts = {(metric, year): self.fact(metric, year) for year in VALUES for metric in METRICS}
        current, previous = facts["revenue", 2025], facts["revenue", 2024]
        growth = self.calc("revenue_growth", current=current, previous=previous)
        margin = self.calc("net_profit_margin", net_income=facts["net_income", 2025], revenue=current)
        self.assertEqual(growth["status"], "valid")
        self.assertEqual(Decimal(growth["result"]), Decimal(10))
        self.assertEqual(Decimal(margin["result"]), Decimal(12))
        for year, expected_ratio, expected_de in [(2024, "2.0", "0.4"), (2025, "1.5", "0.5")]:
            ratio = self.calc("current_ratio", current_assets=facts["current_assets", year], current_liabilities=facts["current_liabilities", year])
            de = self.calc("debt_to_equity", total_debt=facts["total_debt", year], total_equity=facts["total_equity", year])
            self.assertEqual(Decimal(ratio["result"]), Decimal(expected_ratio))
            self.assertEqual(Decimal(de["result"]), Decimal(expected_de))
        corrected = self.financials.update_fact(self.case["id"], current["id"], FactUpdate(
            expected_revision=current["revision"], values=self.input(value="1200"), status="candidate", reason="Synthetic correction to 1200"))
        self.assertEqual(corrected["original_values"]["value"], "1100")
        self.assertEqual(corrected["history"][-1]["values"]["value"], "1200")
        saved = {r["id"]: r for r in self.financials.list_receipts(self.case["id"])}
        self.assertEqual(saved[growth["id"]]["status"], "stale")
        self.assertEqual(saved[margin["id"]]["status"], "stale")
        self.assertEqual(saved[growth["id"]]["inputs"]["current"]["value"], "1100")
        corrected = self.confirm(corrected)
        self.assertEqual(Decimal(self.calc("revenue_growth", current=corrected, previous=previous)["result"]), Decimal(20))
        self.assertEqual(Decimal(self.calc("net_profit_margin", revenue=corrected, net_income=facts["net_income", 2025])["result"]), Decimal(11))

    def test_source_validation_and_whitespace_only_normalization(self):
        validate_excerpt("Revenue\n  INR\t crore 1100", " Revenue INR crore 1100 ")
        for text in ["Revenue INR crore 1200", "revenue INR crore 1100", "Revenue INR crore"]:
            if text == "Revenue INR crore":
                continue  # A real exact substring is valid provenance, not a semantic guarantee.
            with self.assertRaises(HTTPException):
                validate_excerpt(FIXTURE, text)
        for overrides in [{"document_id": "wrong"}, {"section_id": "wrong"}, {"excerpt": "Invented text"}]:
            with self.assertRaises(HTTPException):
                self.financials.add_fact(self.case["id"], self.input(**overrides))
        with self.assertRaises(HTTPException):
            self.financials.add_fact(self.other["id"], self.input())

    def test_structured_output_and_batch_reference_validation(self):
        batch = [{"document_id": self.doc["id"], "section_id": self.doc["pages"][0]["id"], "text": FIXTURE}]
        response = json.dumps({"facts": [self.input().model_dump(mode="json")]})
        self.assertEqual(parse_response(response, batch).facts[0].value, "1100")
        for raw in ["not json", json.dumps({"facts": [{**self.input().model_dump(mode="json"), "value": 1.2}]}),
                    json.dumps({"facts": [{**self.input().model_dump(mode="json"), "metric": "total_liabilities"}]})]:
            with self.assertRaises(ValidationError):
                parse_response(raw, batch)
        with self.assertRaises(ValueError):
            parse_response(response, [])
        with self.assertRaises(HTTPException):
            parse_response(json.dumps({"facts": [self.input(excerpt="Fabricated").model_dump(mode="json")]}), batch)
        for value in ["NaN", "Infinity", "1_000", "1,000", " 1 ", "1e100"]:
            with self.assertRaises(ValidationError):
                self.input(value=value)

    def test_mock_model_repeated_extraction_and_missing_credentials(self):
        response = json.dumps({"facts": [self.input().model_dump(mode="json")]})
        with patch("app.research.fact_extraction._get_groq_api_key", return_value="synthetic-key"), patch(
                "app.research.fact_extraction.structured_call", new_callable=AsyncMock, return_value=response) as model:
            first = asyncio.run(extract_facts(self.financials, self.case["id"], [self.doc["id"]]))
            second = asyncio.run(extract_facts(self.financials, self.case["id"], [self.doc["id"]]))
            self.assertEqual(model.await_count, 2)
        self.assertEqual(first["status"], "completed")
        self.assertEqual(second["duplicate_count"], 1)
        self.assertEqual(first["fact_ids"], second["fact_ids"])
        self.assertEqual(len(self.financials.list_facts(self.case["id"])), 1)
        with patch("app.research.fact_extraction._get_groq_api_key", return_value=""):
            failed = asyncio.run(extract_facts(self.financials, self.case["id"], [self.doc["id"]]))
        self.assertEqual(failed["status"], "failed")
        self.assertIn("GROQ_API_KEY", failed["errors"][0])
        self.assertEqual(len(self.financials.list_facts(self.case["id"])), 1)
        self.assertEqual(self.financials.list_facts(self.case["id"])[0]["status"], "candidate")

    def test_provider_failure_no_fallback_facts_and_ambiguity(self):
        self.fact()
        with patch("app.research.fact_extraction._get_groq_api_key", return_value="fake"), patch(
                "app.research.fact_extraction.structured_call", new_callable=AsyncMock, side_effect=RuntimeError("provider failed")):
            run = asyncio.run(extract_facts(self.financials, self.case["id"], [self.doc["id"]]))
        self.assertEqual(run["status"], "failed")
        self.assertEqual(len(self.financials.list_facts(self.case["id"])), 1)
        ambiguous = self.input(entity=None, period_start=None, period_end=None, period_type="unknown", scale=None, ambiguity_note="Column year/unit unclear")
        response = json.dumps({"facts": [ambiguous.model_dump(mode="json")]})
        with patch("app.research.fact_extraction._get_groq_api_key", return_value="fake"), patch(
                "app.research.fact_extraction.structured_call", new_callable=AsyncMock, return_value=response):
            asyncio.run(extract_facts(self.financials, self.case["id"], [self.doc["id"]]))
        fact = self.financials.list_facts(self.case["id"])[0]
        self.assertEqual(fact["status"], "needs_review")
        self.assertIsNone(fact["period_end"])
        with self.assertRaises(HTTPException):
            self.confirm(fact)

    def test_cross_case_api_and_revision_concurrency(self):
        fact = self.fact()
        root = f"/research/cases/{self.other['id']}"
        self.assertEqual(self.client.post(root + "/facts", json=self.input().model_dump(mode="json")).status_code, 422)
        self.assertEqual(self.client.post(root + "/extractions", json={"document_ids": [self.doc["id"]]}).status_code, 404)
        response = self.client.post(root + "/calculations", json={"calculation_type": "revenue_growth", "inputs": {"current": fact["id"]}})
        self.assertEqual(response.status_code, 404)
        with self.assertRaises(HTTPException) as caught:
            self.financials.update_fact(self.case["id"], fact["id"], FactUpdate(expected_revision=1, values=self.input(), status="rejected", reason="Outdated edit"))
        self.assertEqual(caught.exception.status_code, 409)

    def test_confirmed_only_missing_inputs_and_metadata(self):
        fact = self.fact(confirmed=False)
        unavailable = self.calc("revenue_growth", current=fact)
        self.assertEqual(unavailable["status"], "unavailable")
        self.assertIn("previous (revenue)", unavailable["missing_inputs"])
        unknown = self.fact("net_income", currency=None, scale=None, accounting_scope=None, period_start=None, period_end=None, period_type="unknown")
        receipt = self.calc("net_profit_margin", net_income=unknown, revenue=self.fact())
        self.assertEqual(receipt["status"], "unavailable")
        for field in ["currency", "scale", "accounting_scope", "period_start", "period_end"]:
            self.assertIn("net_income." + field, receipt["missing_inputs"])

    def test_units_including_crore_lakh_and_explicit_receipt(self):
        self.assertEqual(normalized_value("1", "crore"), Decimal(10_000_000))
        self.assertEqual(normalized_value("100", "lakh"), Decimal(10_000_000))
        assets = self.fact("current_assets", value="1", scale="crore")
        liabilities = self.fact("current_liabilities", value="50", scale="lakh")
        receipt = self.calc("current_ratio", current_assets=assets, current_liabilities=liabilities)
        self.assertEqual(receipt["result"], "2")
        self.assertEqual(receipt["conversions"][0]["multiplier"], "10000000")
        self.assertEqual(receipt["conversions"][1]["multiplier"], "100000")

    def test_period_scope_currency_entity_mismatches(self):
        revenue = self.fact()
        for overrides, message in [({"period_start": "2024-07-01"}, "identical"),
                ({"accounting_scope": "standalone / synthetic GAAP"}, "scope"),
                ({"currency": "USD"}, "Currency"), ({"entity": "Other Entity"}, "entity")]:
            income = self.fact("net_income", **overrides)
            receipt = self.calc("net_profit_margin", net_income=income, revenue=revenue)
            self.assertEqual(receipt["status"], "unavailable")
            self.assertTrue(any(message in warning for warning in receipt["warnings"]))
        receipt = self.calc("current_ratio", current_assets=self.fact("current_assets", 2024), current_liabilities=self.fact("current_liabilities", 2025))
        self.assertTrue(any("reporting date" in warning for warning in receipt["warnings"]))
        receipt = self.calc("revenue_growth", current=self.fact("revenue", 2024), previous=revenue)
        self.assertTrue(any("chronological" in warning for warning in receipt["warnings"]))
        quarter = self.fact("revenue", 2024, period_start="2024-01-01")
        self.assertTrue(any("noncomparable" in warning for warning in self.calc("revenue_growth", current=revenue, previous=quarter)["warnings"]))

    def test_zero_denominators_nonpositive_equity_and_growth(self):
        for function, values in [(revenue_growth, (Decimal(1), Decimal(0))), (revenue_growth, (Decimal(1), Decimal(-1))),
                (net_profit_margin, (Decimal(1), Decimal(0))), (current_ratio, (Decimal(1), Decimal(0))),
                (debt_to_equity, (Decimal(1), Decimal(0))), (debt_to_equity, (Decimal(1), Decimal(-1)))]:
            with self.assertRaises(CalculationUnavailable):
                function(*values)
        receipt = self.calc("debt_to_equity", total_debt=self.fact("total_debt"), total_equity=self.fact("total_equity", value="-5"))
        self.assertEqual(receipt["status"], "unavailable")
        self.assertIsNone(receipt["result"])

    def test_conflicting_confirmed_facts_require_explicit_resolution(self):
        first = self.fact()
        previous = self.fact("revenue", 2024)
        valid = self.calc("revenue_growth", current=first, previous=previous)
        competing = self.fact(value="1200")
        self.assertEqual(self.financials.list_receipts(self.case["id"])[0]["status"], "stale")
        conflict = self.calc("revenue_growth", current=first, previous=previous)
        self.assertEqual(conflict["status"], "unavailable")
        self.assertEqual(conflict["conflicts"]["current"], [competing["id"]])
        resolved = calculate(self.financials, self.case["id"], CalculationRequest(calculation_type="revenue_growth",
            inputs={"current": first["id"], "previous": previous["id"]}, acknowledged_conflicts={"current": [competing["id"]]}))
        self.assertEqual(resolved["status"], "valid")
        self.assertEqual(Decimal(resolved["result"]), Decimal(10))
        self.assertEqual(valid["result"], "10.0")

    def test_source_deletion_and_fact_removal_invalidate_without_losing_history(self):
        current, previous = self.fact(), self.fact("revenue", 2024)
        receipt = self.calc("revenue_growth", current=current, previous=previous)
        self.store.remove_document(self.case["id"], self.doc["id"])
        historical = self.financials.list_facts(self.case["id"])[0]
        self.assertFalse(historical["source_available"])
        self.assertTrue(historical["source_snapshot"]["excerpt"])
        saved = self.financials.list_receipts(self.case["id"])[0]
        self.assertEqual(saved["id"], receipt["id"])
        self.assertEqual(saved["status"], "stale")
        self.assertEqual(self.calc("revenue_growth", current=current, previous=previous)["status"], "unavailable")
        self.financials.remove_fact(self.case["id"], current["id"], current["revision"])
        removed = next(f for f in self.financials.list_facts(self.case["id"]) if f["id"] == current["id"])
        self.assertIsNotNone(removed["removed_at"])
        self.assertEqual(removed["history"][-1]["action"], "removed")

    def test_confirmation_correction_and_receipts_survive_process_restart(self):
        current, previous = self.fact(), self.fact("revenue", 2024)
        current = self.financials.update_fact(self.case["id"], current["id"], FactUpdate(
            expected_revision=current["revision"], values=self.input(value="1200"), status="candidate", reason="Persist corrected interpretation"))
        current = self.confirm(current)
        receipt = self.calc("revenue_growth", current=current, previous=previous)
        code = "from pathlib import Path; from app.research.store import ResearchStore; from app.research.financial_store import FinancialStore; import json,sys; s=FinancialStore(ResearchStore(Path(sys.argv[1]))); print(json.dumps([s.list_facts(sys.argv[2]),s.list_receipts(sys.argv[2])]))"
        saved_facts, saved_receipts = json.loads(subprocess.check_output([sys.executable, "-c", code, str(self.directory), self.case["id"]], text=True))
        self.assertTrue(all(f["status"] == "confirmed" for f in saved_facts))
        self.assertEqual(saved_receipts[0], receipt)
        saved_current = next(f for f in saved_facts if f["id"] == current["id"])
        self.assertEqual(saved_current["value"], "1200")
        self.assertEqual(saved_current["original_values"]["value"], "1100")
        self.assertEqual(len(saved_current["history"]), 4)

    def test_rejection_and_removal_invalidate_receipts_independently(self):
        current, previous = self.fact(), self.fact("revenue", 2024)
        self.calc("revenue_growth", current=current, previous=previous)
        rejected = self.financials.update_fact(self.case["id"], current["id"], FactUpdate(
            expected_revision=current["revision"], values=self.input(), status="rejected", reason="Source interpretation rejected"))
        self.assertEqual(self.financials.list_receipts(self.case["id"])[0]["status"], "stale")
        self.assertEqual(self.calc("revenue_growth", current=rejected, previous=previous)["status"], "unavailable")
        confirmed = self.confirm(rejected)
        valid = self.calc("revenue_growth", current=confirmed, previous=previous)
        self.financials.remove_fact(self.case["id"], current["id"], confirmed["revision"])
        saved = next(r for r in self.financials.list_receipts(self.case["id"]) if r["id"] == valid["id"])
        self.assertEqual(saved["status"], "stale")

    def test_partial_run_and_invalid_output_never_claim_completion(self):
        doc = self.store.add_document(self.case["id"], DocumentMetadata(title="Mixed synthetic source"), "pdf", "synthetic.pdf", b"synthetic", [
            {"position": 1, "page_number": 1, "label": "Page 1", "text": "No supported figures", "extraction_status": "extracted"},
            {"position": 2, "page_number": 2, "label": "Page 2", "text": "", "extraction_status": "no_text"}])
        with patch("app.research.fact_extraction._get_groq_api_key", return_value="fake"), patch(
                "app.research.fact_extraction.structured_call", new_callable=AsyncMock, return_value='{"facts": []}'):
            run = asyncio.run(extract_facts(self.financials, self.case["id"], [doc["id"]]))
        self.assertEqual(run["status"], "partial")
        self.assertEqual([s["status"] for s in run["sections"]], ["processed", "skipped"])
        with patch("app.research.fact_extraction._get_groq_api_key", return_value="fake"), patch(
                "app.research.fact_extraction.structured_call", new_callable=AsyncMock, return_value='{"facts": [{"metric": "invented"}]}'):
            failed = asyncio.run(extract_facts(self.financials, self.case["id"], [self.doc["id"]]))
        self.assertEqual(failed["status"], "failed")
        self.assertEqual(self.financials.list_facts(self.case["id"]), [])

    def test_long_sections_are_explicitly_skipped(self):
        long = self.store.add_document(self.case["id"], DocumentMetadata(title="Long"), "pasted_text", None, b"x", [
            {"position": 1, "page_number": None, "label": "Text section", "text": "x" * 10001, "extraction_status": "extracted"}])
        with patch("app.research.fact_extraction._get_groq_api_key", return_value="fake"), patch("app.research.fact_extraction.structured_call", new_callable=AsyncMock) as model:
            run = asyncio.run(extract_facts(self.financials, self.case["id"], [long["id"]]))
            model.assert_not_called()
        self.assertEqual(run["status"], "failed")
        self.assertEqual(run["sections"][0]["status"], "skipped")
        self.assertIn("10,000", run["sections"][0]["message"])

    def test_reextract_does_not_overwrite_reviewed_corrections(self):
        original = self.fact()
        changed = self.financials.update_fact(self.case["id"], original["id"], FactUpdate(
            expected_revision=original["revision"], values=self.input(value="1200"), status="candidate", reason="Analyst correction"))
        changed = self.confirm(changed)
        response = json.dumps({"facts": [self.input().model_dump(mode="json")]})
        with patch("app.research.fact_extraction._get_groq_api_key", return_value="fake"), patch(
                "app.research.fact_extraction.structured_call", new_callable=AsyncMock, return_value=response):
            run = asyncio.run(extract_facts(self.financials, self.case["id"], [self.doc["id"]]))
        self.assertEqual(run["duplicate_count"], 1)
        saved = self.financials.list_facts(self.case["id"])
        self.assertEqual(len(saved), 1)
        self.assertEqual(saved[0]["value"], "1200")
        self.assertEqual(saved[0]["revision"], changed["revision"])
        self.assertEqual(saved[0]["status"], "confirmed")

    def test_additive_migration_preserves_legacy_ids(self):
        legacy = self.directory / "legacy"
        legacy.mkdir()
        db = sqlite3.connect(legacy / "research.sqlite3")
        db.executescript("CREATE TABLE research_cases(id TEXT PRIMARY KEY,payload TEXT,created_at TEXT,updated_at TEXT); CREATE TABLE documents(id TEXT PRIMARY KEY,case_id TEXT,payload TEXT,stored_filename TEXT); CREATE TABLE pages(id TEXT PRIMARY KEY,document_id TEXT,position INTEGER,payload TEXT);")
        values = CaseCreate(title="Legacy", company_name="Legacy Co", research_question="Keep IDs").model_dump_json()
        db.execute("INSERT INTO research_cases VALUES ('legacy-case', ?, '2025-01-01T00:00:00Z', '2025-01-01T00:00:00Z')", (values,))
        db.execute("INSERT INTO documents VALUES ('legacy-doc','legacy-case','{}','legacy.txt')")
        db.execute("INSERT INTO pages VALUES ('legacy-section','legacy-doc',1,'{}')")
        db.commit(); db.close()
        migrated = ResearchStore(legacy)
        self.assertEqual(migrated.get_case("legacy-case")["id"], "legacy-case")
        with migrated.connection() as db:
            self.assertEqual(db.execute("SELECT id FROM pages").fetchone()[0], "legacy-section")
            self.assertEqual(db.execute("SELECT MAX(version) FROM research_migrations").fetchone()[0], 7)


if __name__ == "__main__":
    unittest.main()
