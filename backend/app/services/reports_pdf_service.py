from __future__ import annotations

from datetime import datetime
from io import BytesIO
from typing import Any

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


def _money(value: float) -> str:
    return f"Rs {value:,.2f}"


def _pct(value: float) -> str:
    sign = "+" if value > 0 else ""
    return f"{sign}{value:.2f}%"


def build_portfolio_report_pdf(report: dict[str, Any], period: str) -> bytes:
    summary = report.get("summary", {}).get("kpis", {})
    active_holdings = report.get("active_holdings", [])
    closed_positions = report.get("closed_positions", [])
    tax_summary = report.get("tax_summary", {})
    dividends = report.get("dividend_history", {})
    doctor = report.get("portfolio_doctor", {})

    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        topMargin=14 * mm,
        bottomMargin=14 * mm,
        title="Portfolio Report",
        author="CodeCrafters",
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "ReportTitle",
        parent=styles["Title"],
        fontSize=18,
        leading=22,
        textColor=colors.HexColor("#0B1C30"),
    )
    meta_style = ParagraphStyle(
        "ReportMeta",
        parent=styles["Normal"],
        fontSize=9,
        leading=12,
        textColor=colors.HexColor("#5B6777"),
    )
    section_style = ParagraphStyle(
        "SectionHeader",
        parent=styles["Heading2"],
        fontSize=12,
        leading=16,
        textColor=colors.HexColor("#0B1C30"),
    )

    elements = []

    generated = datetime.now().strftime("%d %b %Y, %I:%M %p")
    elements.append(Paragraph("Investment Portfolio Report", title_style))
    elements.append(Paragraph(f"Period: {period} | Generated: {generated}", meta_style))
    elements.append(Spacer(1, 8))

    kpi_table = Table(
        [
            ["Total Portfolio", "Realized P&L", "Unrealized P&L", "Dividends YTD", "XIRR"],
            [
                _money(float(summary.get("total_portfolio_value", 0))),
                _money(float(summary.get("realised_pnl", 0))),
                _money(float(summary.get("unrealised_pnl", 0))),
                _money(float(summary.get("dividends_ytd", 0))),
                _pct(float(summary.get("xirr_percent", 0))),
            ],
        ],
        colWidths=[34 * mm, 32 * mm, 34 * mm, 32 * mm, 22 * mm],
    )
    kpi_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#EAF1FF")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#1B2D44")),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#D5DFEE")),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTNAME", (0, 1), (-1, 1), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )

    elements.append(kpi_table)
    elements.append(Spacer(1, 10))

    elements.append(Paragraph("Active Holdings", section_style))
    active_rows = [["Symbol", "Qty", "Buy", "Current", "Invested", "Market", "P&L", "P&L %"]]
    for item in active_holdings[:15]:
        active_rows.append(
            [
                item.get("ticker", item.get("symbol", "")),
                f"{float(item.get('qty', 0)):,.4f}".rstrip("0").rstrip("."),
                _money(float(item.get("buy_price", 0))),
                _money(float(item.get("current", 0))),
                _money(float(item.get("invested", 0))),
                _money(float(item.get("market_value", 0))),
                _money(float(item.get("pnl", 0))),
                _pct(float(item.get("pnl_percent", 0))),
            ]
        )

    active_table = Table(active_rows, repeatRows=1, colWidths=[20 * mm, 16 * mm, 21 * mm, 21 * mm, 24 * mm, 24 * mm, 20 * mm, 16 * mm])
    active_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#EFF4FF")),
                ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#D5DFEE")),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 8),
                ("ALIGN", (1, 1), (-1, -1), "RIGHT"),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ]
        )
    )
    elements.append(active_table)
    elements.append(Spacer(1, 10))

    elements.append(Paragraph("Tax and Income", section_style))
    tax_rows = [
        ["Financial Year", tax_summary.get("financial_year", "-")],
        ["STCG Tax", _money(float(tax_summary.get("stcg", {}).get("tax", 0)))],
        ["LTCG Tax", _money(float(tax_summary.get("ltcg", {}).get("tax", 0)))],
        ["Tax Loss Offset", _money(float(tax_summary.get("tax_loss_offset", 0)))],
        ["Net Tax Due", _money(float(tax_summary.get("net_tax_due", 0)))],
        ["Dividend YTD", _money(float(dividends.get("ytd_total", 0)))],
    ]
    tax_table = Table(tax_rows, colWidths=[55 * mm, 40 * mm])
    tax_table.setStyle(
        TableStyle(
            [
                ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#D5DFEE")),
                ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#F7FAFF")),
                ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
                ("ALIGN", (1, 0), (1, -1), "RIGHT"),
                ("FONTSIZE", (0, 0), (-1, -1), 8.5),
            ]
        )
    )
    elements.append(tax_table)
    elements.append(Spacer(1, 10))

    elements.append(Paragraph("Closed Positions (Recent)", section_style))
    closed_rows = [["Symbol", "Buy", "Sell", "Qty", "Realized P&L", "XIRR %"]]
    for item in closed_positions[:12]:
        closed_rows.append(
            [
                item.get("symbol", ""),
                _money(float(item.get("buy_price", 0))),
                _money(float(item.get("sell_price", 0))),
                f"{float(item.get('qty', 0)):,.4f}".rstrip("0").rstrip("."),
                _money(float(item.get("pnl", 0))),
                _pct(float(item.get("xirr_percent", 0))),
            ]
        )

    closed_table = Table(closed_rows, repeatRows=1, colWidths=[30 * mm, 23 * mm, 23 * mm, 16 * mm, 30 * mm, 18 * mm])
    closed_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#EFF4FF")),
                ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#D5DFEE")),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 8),
                ("ALIGN", (1, 1), (-1, -1), "RIGHT"),
            ]
        )
    )
    elements.append(closed_table)
    elements.append(Spacer(1, 10))

    elements.append(Paragraph("Portfolio Doctor", section_style))
    critical = doctor.get("critical", [])
    strengths = doctor.get("strengths", [])
    prescriptions = doctor.get("prescriptions", [])

    doctor_text = [
        f"Score: {doctor.get('score', 0)} / {doctor.get('max_score', 100)}",
        "",
        "Critical:",
        *[f"- {c}" for c in critical],
        "",
        "Strengths:",
        *[f"- {s}" for s in strengths],
        "",
        "Prescriptions:",
        *[f"- {p}" for p in prescriptions],
    ]
    elements.append(Paragraph("<br/>".join(doctor_text), meta_style))

    elements.append(Spacer(1, 8))
    elements.append(Paragraph("Disclaimer: This report is for informational purposes only and not financial or tax advice.", meta_style))

    doc.build(elements)
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes
