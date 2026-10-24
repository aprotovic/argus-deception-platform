"""PDF incident report generator for ARGUS security events using ReportLab."""

from datetime import datetime, timezone
from io import BytesIO
from typing import List, Dict, Any

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable,
)


_SEVERITY_COLORS = {
    "critical": colors.HexColor("#dc2626"),
    "high":     colors.HexColor("#ea580c"),
    "medium":   colors.HexColor("#d97706"),
    "low":      colors.HexColor("#16a34a"),
}


def generate_incident_report(
    events: List[Dict[str, Any]],
    attacker_ip: str,
    threat_score: int,
    threat_level: str,
) -> bytes:
    """
    Generate a PDF incident report for a given attacker IP session.

    Args:
        events: List of event dicts with keys: timestamp, event_type, severity,
                request_path, summary.
        attacker_ip: The source IP address being reported on.
        threat_score: Computed integer threat score.
        threat_level: One of low / medium / high / critical.

    Returns:
        Raw PDF bytes.
    """
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=2 * cm,
        leftMargin=2 * cm,
        topMargin=2 * cm,
        bottomMargin=2 * cm,
        title=f"ARGUS Incident Report — {attacker_ip}",
    )

    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        "ArgusTitle",
        parent=styles["Title"],
        fontSize=18,
        textColor=colors.HexColor("#0d1b2a"),
        spaceAfter=4,
    )
    subtitle_style = ParagraphStyle(
        "ArgusSubtitle",
        parent=styles["Normal"],
        fontSize=10,
        textColor=colors.HexColor("#64748b"),
        spaceAfter=12,
    )
    section_style = ParagraphStyle(
        "ArgusSection",
        parent=styles["Heading2"],
        fontSize=12,
        textColor=colors.HexColor("#1e40af"),
        spaceBefore=14,
        spaceAfter=6,
    )
    body_style = ParagraphStyle(
        "ArgusBody",
        parent=styles["Normal"],
        fontSize=9,
        leading=14,
    )
    footer_style = ParagraphStyle(
        "ArgusFooter",
        parent=styles["Normal"],
        fontSize=7,
        textColor=colors.HexColor("#94a3b8"),
        alignment=TA_CENTER,
    )

    story = []

    # ── Header ──────────────────────────────────────────────────────────────
    story.append(Paragraph("ARGUS CYBER DECEPTION PLATFORM", title_style))
    story.append(Paragraph("Incident Investigation Report", subtitle_style))
    story.append(HRFlowable(width="100%", thickness=2, color=colors.HexColor("#1e40af")))
    story.append(Spacer(1, 0.4 * cm))

    # ── Report metadata ──────────────────────────────────────────────────────
    now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    level_color = _SEVERITY_COLORS.get(threat_level, colors.grey)

    meta_rows = [
        ["Report Generated:", now_str],
        ["Target IP Address:", attacker_ip],
        ["Threat Level:", threat_level.upper()],
        ["Threat Score:", str(threat_score)],
        ["Total Events:", str(len(events))],
        ["Classification:", "RESTRICTED // AUTHORIZED PERSONNEL ONLY"],
    ]
    meta_table = Table(meta_rows, colWidths=[4.5 * cm, 12 * cm])
    meta_table.setStyle(TableStyle([
        ("FONTNAME",   (0, 0), (-1, -1), "Helvetica"),
        ("FONTSIZE",   (0, 0), (-1, -1), 9),
        ("FONTNAME",   (0, 0), (0, -1),  "Helvetica-Bold"),
        ("TEXTCOLOR",  (0, 0), (0, -1),  colors.HexColor("#1e40af")),
        ("ROWBACKGROUNDS", (0, 0), (-1, -1),
         [colors.HexColor("#f8fafc"), colors.white]),
        ("GRID",       (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
        ("PADDING",    (0, 0), (-1, -1), 6),
        # Colour the threat level value
        ("TEXTCOLOR",  (1, 2), (1, 2), level_color),
        ("FONTNAME",   (1, 2), (1, 2), "Helvetica-Bold"),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 0.5 * cm))

    # ── Event timeline ───────────────────────────────────────────────────────
    story.append(Paragraph("Event Timeline", section_style))

    if events:
        header_row = [["#", "Timestamp (UTC)", "Event Type", "Severity", "Path / Summary"]]
        data_rows = []
        for i, ev in enumerate(events, 1):
            ts = ev.get("timestamp", "")
            if hasattr(ts, "strftime"):
                ts = ts.strftime("%Y-%m-%d %H:%M:%S")
            else:
                ts = str(ts)[:19]

            sev = str(ev.get("severity", "low"))
            path = str(ev.get("request_path") or ev.get("summary") or "")[:60]
            etype = str(ev.get("event_type", "")).replace("_", " ").title()

            data_rows.append([str(i), ts, etype, sev.upper(), path])

        tbl_style_cmds = [
            ("BACKGROUND",    (0, 0), (-1, 0),  colors.HexColor("#1e40af")),
            ("TEXTCOLOR",     (0, 0), (-1, 0),  colors.white),
            ("FONTNAME",      (0, 0), (-1, 0),  "Helvetica-Bold"),
            ("FONTSIZE",      (0, 0), (-1, -1), 8),
            ("GRID",          (0, 0), (-1, -1), 0.3, colors.HexColor("#e2e8f0")),
            ("PADDING",       (0, 0), (-1, -1), 4),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1),
             [colors.HexColor("#f8fafc"), colors.white]),
        ]
        for idx, row in enumerate(data_rows, 1):
            sev_val = row[3].lower()
            c = _SEVERITY_COLORS.get(sev_val, colors.grey)
            tbl_style_cmds.append(("TEXTCOLOR", (3, idx), (3, idx), c))
            tbl_style_cmds.append(("FONTNAME",  (3, idx), (3, idx), "Helvetica-Bold"))

        event_table = Table(
            header_row + data_rows,
            colWidths=[0.8 * cm, 3.8 * cm, 3.5 * cm, 2.2 * cm, 6.2 * cm],
        )
        event_table.setStyle(TableStyle(tbl_style_cmds))
        story.append(event_table)
    else:
        story.append(Paragraph("No events recorded for this session.", body_style))

    story.append(Spacer(1, 0.4 * cm))

    # ── Footer ───────────────────────────────────────────────────────────────
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#e2e8f0")))
    story.append(Spacer(1, 0.2 * cm))
    story.append(Paragraph(
        "ARGUS Cyber Deception Platform — Confidential Security Report — Authorized Use Only",
        footer_style,
    ))

    doc.build(story)
    return buffer.getvalue()
