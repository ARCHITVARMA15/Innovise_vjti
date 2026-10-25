"""Exercise the real app over HTTP, stop it, and reopen the same temporary store.

Run from backend/: .venv/bin/python tests/smoke_research_server.py
Does not touch the user's research or portfolio data, or call external providers.
"""
import io
import json
import os
import socket
import subprocess
import sys
import tempfile
import time
from pathlib import Path

import httpx
from reportlab.pdfgen.canvas import Canvas


def pdf_bytes():
    output = io.BytesIO()
    canvas = Canvas(output)
    for text in ("PDF page one: revenue", "PDF page two: operating cash"):
        canvas.drawString(40, 750, text)
        canvas.showPage()
    canvas.save()
    return output.getvalue()


def run():
    with tempfile.TemporaryDirectory(prefix="veritas-research-smoke-") as temporary:
        with socket.socket() as probe:
            probe.bind(("127.0.0.1", 0))
            port = probe.getsockname()[1]
        environment = {**os.environ, "VERITAS_RESEARCH_DIR": str(Path(temporary) / "research")}
        with open(Path(temporary) / "server.log", "w+") as log:
            def start():
                process = subprocess.Popen([sys.executable, "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", str(port)],
                    cwd=Path(__file__).resolve().parents[1], env=environment, stdout=log, stderr=log)
                for _ in range(150):
                    if process.poll() is not None:
                        log.seek(0)
                        raise AssertionError(log.read())
                    try:
                        if client.get("/health").status_code == 200:
                            return process
                    except httpx.TransportError:
                        pass
                    time.sleep(0.1)
                process.terminate()
                process.wait(timeout=10)
                raise AssertionError("Backend did not become ready")

            def stop(process):
                process.terminate()
                process.wait(timeout=10)

            with httpx.Client(base_url=f"http://127.0.0.1:{port}", timeout=10) as client:
                process = start()
                try:
                    cases = []
                    for title in ("Primary smoke case", "Isolated smoke case"):
                        response = client.post("/research/cases", json={"title": title, "company_name": "Fixture Co", "research_question": "How is cash generated?"})
                        assert response.status_code == 201, response.text
                        cases.append(response.json())
                    root = f"/research/cases/{cases[0]['id']}/documents"
                    other_root = f"/research/cases/{cases[1]['id']}/documents"
                    response = client.post(root + "/text", json={"title": "Pasted notes", "text": "Preserved source text", "publication_date": "2025-03-31"})
                    assert response.status_code == 201, response.text
                    documents = [response.json()]
                    for filename, data in (("notes.txt", "UTF-8 source ₹100\n".encode()), ("report.pdf", pdf_bytes())):
                        response = client.post(root + "/upload", files={"file": (filename, data)}, data={"metadata": json.dumps({"title": filename})})
                        assert response.status_code == 201, response.text
                        documents.append(response.json())
                    other_doc = client.post(other_root + "/text", json={"title": "Other source", "text": "Keep this separate"}).json()
                    assert [page["page_number"] for page in documents[2]["pages"]] == [1, 2]
                    assert "operating cash" in documents[2]["pages"][1]["text"]
                    assert documents[0]["pages"][0]["page_number"] is None
                    # Fresh HTTP reads approximate refresh without retaining any frontend state.
                    assert len(client.get("/research/cases").json()) == 2
                    for doc in documents:
                        assert client.get(root + "/" + doc["id"]).json() == doc
                    fixture = (Path(__file__).parent / "fixtures/financials_synthetic.txt").read_text()
                    response = client.post(root + "/text", json={"title": "SYNTHETIC financial test fixture", "text": fixture})
                    assert response.status_code == 201, response.text
                    fixture_doc = response.json()
                    documents.append(fixture_doc)
                    financial_root = f"/research/cases/{cases[0]['id']}"
                    facts = {}
                    for metric, name, amount, year in [("revenue", "Revenue", "1000", 2024), ("revenue", "Revenue", "1100", 2025),
                            ("net_income", "Net income", "132", 2025), ("current_assets", "Current assets", "450", 2025),
                            ("current_liabilities", "Current liabilities", "300", 2025), ("total_debt", "Total debt", "300", 2025),
                            ("total_equity", "Total equity", "600", 2025)]:
                        income = metric in ("revenue", "net_income")
                        values = {"document_id": fixture_doc["id"], "section_id": fixture_doc["pages"][0]["id"],
                            "metric": metric, "entity": "Synthetic Fixture Co", "value": amount, "currency": "INR", "scale": "crore",
                            "reporting_period": f"FY{year}", "period_start": f"{year-1}-04-01" if income else None,
                            "period_end": f"{year}-03-31", "period_type": "duration" if income else "instant",
                            "accounting_scope": "consolidated / synthetic GAAP", "excerpt": f"{name} INR crore {amount}", "ambiguity_note": None}
                        response = client.post(financial_root + "/facts", json=values)
                        assert response.status_code == 201, response.text
                        candidate = response.json()
                        response = client.patch(financial_root + "/facts/" + candidate["id"], json={
                            "expected_revision": candidate["revision"], "values": values, "status": "confirmed", "reason": "Synthetic smoke review"})
                        assert response.status_code == 200, response.text
                        facts[metric, year] = {"record": response.json(), "values": values}
                    requests = [
                        ("revenue_growth", {"current": facts["revenue", 2025]["record"]["id"], "previous": facts["revenue", 2024]["record"]["id"]}, "10.00"),
                        ("net_profit_margin", {"net_income": facts["net_income", 2025]["record"]["id"], "revenue": facts["revenue", 2025]["record"]["id"]}, "12.00"),
                        ("current_ratio", {"current_assets": facts["current_assets", 2025]["record"]["id"], "current_liabilities": facts["current_liabilities", 2025]["record"]["id"]}, "1.50"),
                        ("debt_to_equity", {"total_debt": facts["total_debt", 2025]["record"]["id"], "total_equity": facts["total_equity", 2025]["record"]["id"]}, "0.50"),
                    ]
                    def wait_job(url):
                        for _ in range(120):
                            response=client.get(url)
                            assert response.status_code==200,response.text
                            job=response.json()
                            if job['status'] not in ('queued','running'):
                                return job
                            time.sleep(0.1)
                        raise AssertionError('Local deterministic job exceeded smoke budget')
                    analysis_input={'task_type':'simple_metric','document_ids':[fixture_doc['id']],
                        'entity':'Synthetic Fixture Co','periods':['FY2024','FY2025'],'accounting_basis':'consolidated / synthetic GAAP',
                        'research_as_of_date':'2025-06-30','calculations':[
                            {'calculation_type':'revenue_growth','periods':['FY2024','FY2025']},
                            {'calculation_type':'net_profit_margin','periods':['FY2025']}]}
                    receipts = []
                    for kind, inputs, expected in requests:
                        response = client.post(financial_root + "/calculations", json={"calculation_type": kind, "inputs": inputs})
                        assert response.status_code == 201, response.text
                        result = response.json()
                        assert result["status"] == "valid" and result["display_result"] == expected, result
                        receipts.append(result)
                    misleading=client.post(root+'/text',json={'title':'SYNTHETIC misleading note','text':'Revenue grew 25% in FY2025.'}).json()
                    documents.append(misleading)
                    mapping={'assertion_type':'numerical','target':'revenue_growth','entity':'Synthetic Fixture Co','asserted_value':'25',
                        'unit':'percent','currency':'INR','periods':['FY2024','FY2025'],'accounting_scope':'consolidated / synthetic GAAP',
                        'rounding_places':0,'temporal_scope':'historical'}
                    claim=client.post(financial_root+'/claims',json={'text':'Revenue grew 25% in FY2025.','mapping':mapping,'mapping_reviewed':True}).json()
                    check=client.post(financial_root+'/claims/'+claim['id']+'/verifications',json={'supporting_document_ids':[fixture_doc['id']]}).json()
                    checked=wait_job(financial_root+'/verifications/'+check['id'])
                    assert checked['result']['status']=='contradicted',checked
                    analysis=client.post(financial_root+'/analysis-runs',json=analysis_input).json()
                    completed=wait_job(financial_root+'/analysis-runs/'+analysis['id'])
                    assert completed['status']=='completed',completed['errors']
                    report=client.get(financial_root+'/reports').json()[0]
                    review={'expected_revision':report['revision'],'action':'request_correction','reviewer_label':'Synthetic smoke reviewer',
                        'comment':'Correct financial input through Financials, recheck the misleading note and compose a new version.'}
                    response=client.post(financial_root+'/reports/'+report['id']+'/reviews',json=review)
                    assert response.status_code==200,response.text
                    assert response.json()['state']=='changes_requested'
                    print('PASS: misleading 25% claim contradicted by 10%; report version 1 retains unresolved claims; analyst requests correction')
                    print("PASS: real HTTP case creation, paste/TXT/PDF intake, fresh reads and PDF page references")
                    print("PASS: manual source-linked fact review and all four deterministic calculations over real HTTP")
                finally:
                    stop(process)

                process = start()
                try:
                    assert client.get(f"/research/cases/{cases[0]['id']}").json()["document_count"] == len(documents)
                    for doc in documents:
                        assert client.get(root + "/" + doc["id"]).json() == doc
                    assert client.delete(other_root + "/" + documents[0]["id"]).status_code == 404
                    assert client.delete(root + "/" + documents[0]["id"]).status_code == 200
                    assert client.get(root + "/" + documents[0]["id"]).status_code == 404
                    assert client.get(other_root + "/" + other_doc["id"]).json() == other_doc
                    saved_receipts = client.get(financial_root + "/calculations").json()
                    assert {r["id"] for r in saved_receipts} == {r["id"] for r in receipts}
                    saved_facts = client.get(financial_root + "/facts").json()
                    assert len(saved_facts) == 7 and all(f["status"] == "confirmed" for f in saved_facts)
                    restored=client.get(financial_root+'/reports/'+report['id']).json()
                    assert restored['state']=='changes_requested' and len(restored['reviews'])==1
                    current = facts["revenue", 2025]
                    changed_values = {**current["values"], "value": "1200"}
                    response = client.patch(financial_root + "/facts/" + current["record"]["id"], json={
                        "expected_revision": current["record"]["revision"], "values": changed_values,
                        "status": "candidate", "reason": "Synthetic correction to 1200"})
                    assert response.status_code == 200, response.text
                    correction = response.json()
                    after_correction = client.get(financial_root + "/calculations").json()
                    assert all(r["status"] == "stale" for r in after_correction if r["calculation_type"] in ("revenue_growth", "net_profit_margin"))
                    response = client.patch(financial_root + "/facts/" + correction["id"], json={
                        "expected_revision": correction["revision"], "values": changed_values,
                        "status": "confirmed", "reason": "Synthetic corrected value reviewed"})
                    assert response.status_code == 200, response.text
                    for index, expected in ((0, "20.00"), (1, "11.00")):
                        kind, inputs, _ = requests[index]
                        result = client.post(financial_root + "/calculations", json={"calculation_type": kind, "inputs": inputs}).json()
                        assert result["status"] == "valid" and result["display_result"] == expected, result
                    stale_report=client.get(financial_root+'/reports/'+report['id']).json()
                    assert stale_report['stale']
                    revised_mapping={**mapping,'asserted_value':'20'}
                    response=client.patch(financial_root+'/claims/'+claim['id'],json={'expected_revision':claim['revision'],
                        'text':'Corrected synthetic assertion: revenue grew 20% in FY2025.','mapping':revised_mapping,'mapping_reviewed':True,
                        'reason':'Analyst correction after reviewed input revision'})
                    assert response.status_code==200,response.text
                    revised_check=client.post(financial_root+'/claims/'+claim['id']+'/verifications',json={
                        'supporting_document_ids':[fixture_doc['id']],'previous_run_id':check['id']}).json()
                    rechecked=wait_job(financial_root+'/verifications/'+revised_check['id'])
                    assert rechecked['result']['status']=='supported',rechecked
                    analysis2=client.post(financial_root+'/analysis-runs',json=analysis_input).json()
                    assert wait_job(financial_root+'/analysis-runs/'+analysis2['id'])['status']=='completed'
                    revised_report=client.get(financial_root+'/reports').json()[0]
                    assert revised_report['version']==2 and revised_report['predecessor_id']==report['id']
                    response=client.post(financial_root+'/reports/'+revised_report['id']+'/reviews',json={
                        'expected_revision':revised_report['revision'],'action':'submit','reviewer_label':'Synthetic reviewer',
                        'comment':'Submit corrected report for review.'})
                    assert response.status_code==200,response.text
                    submitted=response.json()
                    response=client.post(financial_root+'/reports/'+revised_report['id']+'/reviews',json={
                        'expected_revision':submitted['revision'],'action':'approve','reviewer_label':'Synthetic reviewer',
                        'comment':'Reviewed corrections and acknowledge selected-source and missing trend limitations.',
                        'acknowledge_limitations':True,'dispositions':{cid:'retain_as_unresolved' for cid in submitted['material_unresolved']}})
                    assert response.status_code==200,response.text
                    assert response.json()['current_approval']
                    stop(process);process=start()
                    approved=client.get(financial_root+'/reports/'+revised_report['id']).json()
                    assert approved['state']=='approved' and approved['current_approval'] and len(approved['reviews'])==2
                    history=client.get(financial_root+'/reports').json()
                    assert len(history)==2 and history[1]['state']=='changes_requested'
                    print('PASS: real HTTP correction/recheck, linked new report and approval; second actual restart preserves version/review history')
                    assert client.delete(root + "/" + fixture_doc["id"]).status_code == 200
                    old_approval=client.get(financial_root+'/reports/'+approved['id']).json()
                    assert old_approval['state']=='approved' and old_approval['stale'] and not old_approval['current_approval']
                    assert all(r["status"] == "stale" for r in client.get(financial_root + "/calculations").json())
                    assert all(not f["source_available"] for f in client.get(financial_root + "/facts").json())
                    assert client.get("/agent/sessions").status_code == 200
                    assert client.get("/health").json() == {"status": "ok"}
                    print("PASS: actual backend stop/restart preserves all documents and citation IDs; scoped deletion leaves second case intact")
                    print("PASS: facts/receipts survive backend restart; correcting revenue invalidates results; recalculation returns 20%/11%; source deletion invalidates all dependent receipts")
                    print("PASS: existing agent session endpoint and health endpoint remain available")
                finally:
                    stop(process)


if __name__ == "__main__":
    run()
