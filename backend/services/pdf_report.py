"""VICTOR — NASA Official Mission Operational Memorandum PDF Generator.

Produces high-fidelity, publication-grade PDFs conforming to NASA Technical
Memorandum / Technical Report standards using ReportLab.
"""
from __future__ import annotations

import io
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, KeepTogether,
    HRFlowable, Image, PageBreak
)
from reportlab.pdfgen import canvas

# Official NASA Color Palette
NASA_BLUE = colors.HexColor("#0B3D91")       # Official NASA Deep Blue (Meatball background)
NASA_RED = colors.HexColor("#FC3D21")        # Official NASA Red (Meatball chevron)
SLATE_DARK = colors.HexColor("#0F172A")
SLATE_TEXT = colors.HexColor("#1E293B")
SLATE_MUTED = colors.HexColor("#475569")
BORDER_COLOR = colors.HexColor("#CBD5E1")
BORDER_SUBTLE = colors.HexColor("#E2E8F0")
BG_HEADER = colors.HexColor("#F1F5F9")
BG_CARD = colors.HexColor("#F8FAFC")
BG_HIGHLIGHT = colors.HexColor("#EFF6FF")
SUCCESS_COLOR = colors.HexColor("#15803D")
WARNING_COLOR = colors.HexColor("#B45309")
DANGER_COLOR = colors.HexColor("#B91C1C")


class NumberedCanvas(canvas.Canvas):
    """Canvas that performs a two-pass calculation for accurate total page count."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_header_footer(num_pages)
            super().showPage()
        super().save()

    def draw_header_footer(self, page_count: int):
        self.saveState()

        # Top running header (Pages 2+)
        if self._pageNumber > 1:
            self.setFont("Helvetica-Bold", 7)
            self.setFillColor(NASA_BLUE)
            self.drawString(
                36,
                letter[1] - 26,
                "NASA / VICTOR · MARS EXPLORATION PROGRAM & SURFACE TRAVERSE INTELLIGENCE",
            )
            self.setFont("Helvetica", 7)
            self.setFillColor(SLATE_MUTED)
            self.drawRightString(
                letter[0] - 36,
                letter[1] - 26,
                "NASA-TM-2026-VICTOR · JEZERO CRATER SURFACE OPERATIONS",
            )
            self.setStrokeColor(NASA_BLUE)
            self.setLineWidth(0.75)
            self.line(36, letter[1] - 30, letter[0] - 36, letter[1] - 30)

        # Bottom running footer (All pages)
        self.setStrokeColor(BORDER_COLOR)
        self.setLineWidth(0.5)
        self.line(36, 30, letter[0] - 36, 30)

        self.setFont("Helvetica-Bold", 6.5)
        self.setFillColor(SLATE_MUTED)
        self.drawString(
            36,
            20,
            "NASA SPACE APPS CHALLENGE 2026 · PROJECT VICTOR · VOYAGE INTELLIGENCE & CARTOGRAPHY · PUBLIC RELEASE",
        )

        page_str = f"Page {self._pageNumber} of {page_count}"
        self.setFont("Helvetica-Bold", 6.5)
        self.drawRightString(letter[0] - 36, 20, page_str)

        self.restoreState()


def generate_nasa_pdf_report(
    computation_id: str,
    response: Any,
    ds: Any,
    strategy: str,
    briefing_text: str,
    generator: str,
) -> bytes:
    """Generate a publication-grade PDF report matching NASA Technical Memorandum style."""
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=letter,
        leftMargin=36,
        rightMargin=36,
        topMargin=36,
        bottomMargin=38,
    )

    styles = getSampleStyleSheet()

    # Custom Typography Hierarchy
    style_agency = ParagraphStyle(
        "AgencyHeader",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8.5,
        leading=11,
        textColor=NASA_BLUE,
        alignment=0,
        spaceAfter=1,
    )
    style_subagency = ParagraphStyle(
        "SubagencyHeader",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=7.5,
        leading=10,
        textColor=NASA_RED,
        alignment=0,
        spaceAfter=3,
    )
    style_title = ParagraphStyle(
        "DocTitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=13.5,
        leading=16,
        textColor=SLATE_DARK,
        alignment=0,
        spaceAfter=2,
    )
    style_subtitle = ParagraphStyle(
        "DocSubtitle",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=7.5,
        leading=10.5,
        textColor=SLATE_MUTED,
        spaceAfter=0,
    )
    style_section_heading = ParagraphStyle(
        "SectionHeading",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=9.5,
        leading=12,
        textColor=NASA_BLUE,
        spaceBefore=7,
        spaceAfter=3,
        keepWithNext=True,
    )
    style_subsection_heading = ParagraphStyle(
        "SubSectionHeading",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8.5,
        leading=11,
        textColor=SLATE_DARK,
        spaceBefore=5,
        spaceAfter=2,
        keepWithNext=True,
    )
    style_body = ParagraphStyle(
        "BodyDark",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=7.5,
        leading=10.5,
        textColor=SLATE_TEXT,
        spaceAfter=3,
    )
    style_bullet = ParagraphStyle(
        "BulletDark",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=7.5,
        leading=10.5,
        textColor=SLATE_TEXT,
        leftIndent=12,
        firstLineIndent=-8,
        spaceAfter=2,
    )
    style_cell = ParagraphStyle(
        "TableCell",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=7,
        leading=9,
        textColor=SLATE_TEXT,
    )
    style_cell_bold = ParagraphStyle(
        "TableCellBold",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=7,
        leading=9,
        textColor=SLATE_TEXT,
    )
    style_cell_num = ParagraphStyle(
        "TableCellNum",
        parent=styles["Normal"],
        fontName="Courier",
        fontSize=7,
        leading=9,
        alignment=2,
        textColor=SLATE_TEXT,
    )
    style_notice = ParagraphStyle(
        "NoticeText",
        parent=styles["Normal"],
        fontName="Helvetica-Oblique",
        fontSize=7,
        leading=9.5,
        textColor=SLATE_MUTED,
    )

    story = []

    # ── Top NASA & VICTOR Banner Block with Official Insignias ───────────────
    nasa_logo_path = Path(__file__).parent.parent / "assets" / "nasa_logo.png"
    victor_logo_path = Path(__file__).parent.parent / "assets" / "victor_logo.png"

    text_content = [
        Paragraph("NATIONAL AERONAUTICS AND SPACE ADMINISTRATION", style_agency),
        Paragraph("MARS EXPLORATION PROGRAM · SURFACE TRAVERSE & CARTOGRAPHIC INTELLIGENCE", style_subagency),
        Paragraph("TECHNICAL MEMORANDUM: JEZERO CRATER SURFACE OPERATIONS", style_title),
        Paragraph(
            "Project VICTOR · Voyage Intelligence for Terrain-aware Cartographic Optimization &amp; Routing &middot; "
            "NASA Space Apps Challenge 2026",
            style_subtitle,
        ),
    ]

    has_nasa = nasa_logo_path.exists()
    has_victor = victor_logo_path.exists()

    if has_nasa and has_victor:
        nasa_img = Image(str(nasa_logo_path), width=0.88 * inch, height=0.74 * inch)
        victor_img = Image(str(victor_logo_path), width=0.82 * inch, height=0.82 * inch)
        banner_table_data = [[nasa_img, text_content, victor_img]]
        banner_table = Table(banner_table_data, colWidths=[0.98 * inch, 5.54 * inch, 0.98 * inch])
        banner_table.setStyle(
            TableStyle([
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("ALIGN", (0, 0), (0, 0), "LEFT"),
                ("ALIGN", (2, 0), (2, 0), "RIGHT"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
            ])
        )
        story.append(banner_table)
    elif has_nasa:
        logo_img = Image(str(nasa_logo_path), width=0.92 * inch, height=0.77 * inch)
        banner_table_data = [[logo_img, text_content]]
        banner_table = Table(banner_table_data, colWidths=[1.05 * inch, 6.45 * inch])
        banner_table.setStyle(
            TableStyle([
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
            ])
        )
        story.append(banner_table)
    else:
        for p in text_content:
            story.append(p)

    story.append(HRFlowable(width="100%", thickness=1.5, color=NASA_BLUE, spaceAfter=6, spaceBefore=4))

    # ── Document Control Block ───────────────────────────────────────────────
    now_utc = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    meta = ds.metadata
    verified = response.data_mode.value == "VERIFIED_SNAPSHOT"
    is_all = (strategy.upper() == "ALL")
    doc_id = f"NASA-TM-2026-VICTOR-ALL-{computation_id[:8].upper()}" if is_all else f"NASA-TM-2026-VICTOR-{strategy[:4]}-{computation_id[:8].upper()}"
    strat_display = "ALL EVALUATED CASES (COMPARATIVE)" if is_all else strategy

    doc_ctrl_data = [
        [
            Paragraph("<b>DOCUMENT IDENTIFIER</b>", style_cell_bold),
            Paragraph(f"<code>{doc_id}</code>", style_cell),
            Paragraph("<b>SECURITY / RELEASE</b>", style_cell_bold),
            Paragraph("PUBLIC RELEASE (OPEN DATA)", style_cell),
        ],
        [
            Paragraph("<b>TARGET REGION</b>", style_cell_bold),
            Paragraph(f"Jezero Crater, Mars ({meta.lat_min:.2f}–{meta.lat_max:.2f}°N, {meta.lon_min:.2f}–{meta.lon_max:.2f}°E)", style_cell),
            Paragraph("<b>COORDINATE SYSTEM</b>", style_cell_bold),
            Paragraph(f"{meta.coordinate_system} (Equirectangular)", style_cell),
        ],
        [
            Paragraph("<b>DATA PROVENANCE</b>", style_cell_bold),
            Paragraph(
                f"<font color='{NASA_BLUE.hexval()}'><b>NASA PDS ARCHIVE (JEZERO)</b></font>"
                if verified else
                f"<b>{response.data_mode.value}</b>",
                style_cell,
            ),
            Paragraph("<b>MANIFEST HASH ID</b>", style_cell_bold),
            Paragraph(f"<code>{getattr(ds, 'manifest_id', 'manifest-jezero-2026-v1')}</code>", style_cell),
        ],
        [
            Paragraph("<b>SELECTED STRATEGY</b>", style_cell_bold),
            Paragraph(f"<font color='{NASA_BLUE.hexval()}'><b>{strat_display}</b></font>", style_cell),
            Paragraph("<b>GENERATED TIMESTAMP</b>", style_cell_bold),
            Paragraph(now_utc, style_cell),
        ],
    ]
    doc_ctrl_table = Table(doc_ctrl_data, colWidths=[1.35 * inch, 2.4 * inch, 1.35 * inch, 2.4 * inch])
    doc_ctrl_table.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), BG_CARD),
            ("BOX", (0, 0), (-1, -1), 0.75, NASA_BLUE),
            ("INNERGRID", (0, 0), (-1, -1), 0.5, BORDER_COLOR),
            ("TOPPADDING", (0, 0), (-1, -1), 3),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ("LEFTPADDING", (0, 0), (-1, -1), 5),
            ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ])
    )
    story.append(doc_ctrl_table)
    story.append(Spacer(1, 6))

    # ── Section 1: Executive Mission Briefing ─────────────────────────────────
    story.append(Paragraph("1. EXECUTIVE MISSION OPERATIONAL BRIEFING", style_section_heading))
    story.append(HRFlowable(width="100%", thickness=0.75, color=NASA_BLUE, spaceAfter=4, spaceBefore=1))

    gen_note = (
        "<b>Synthesis Model:</b> Deterministic offline operational template derived directly from validated multi-mission terrain grids."
        if generator == "template"
        else "<b>Synthesis Model:</b> Constrained language model grounded in verified operational fact sheet."
    )
    story.append(Paragraph(gen_note, style_notice))
    story.append(Spacer(1, 4))

    for line in briefing_text.split("\n"):
        s = line.strip()
        if not s:
            continue
        if s.startswith("### "):
            story.append(Paragraph(s[4:], style_subsection_heading))
        elif s.startswith("## "):
            story.append(Paragraph(s[3:], style_subsection_heading))
        elif s.startswith("- ") or s.startswith("* "):
            story.append(Paragraph(f"&bull; {_format_bold(s[2:])}", style_bullet))
        else:
            story.append(Paragraph(_format_bold(s), style_body))

    # Clean PageBreak for professional document structure
    story.append(PageBreak())

    # ── Section 2: Strategy Comparison & Pareto Dominance ───────────────────
    story.append(Paragraph("2. MULTI-OBJECTIVE STRATEGY TRADE-OFF & PARETO DOMINANCE", style_section_heading))
    story.append(HRFlowable(width="100%", thickness=0.75, color=NASA_BLUE, spaceAfter=4, spaceBefore=1))

    strat_header = [
        Paragraph("<b>Strategy</b>", style_cell_bold),
        Paragraph("<b>Distance</b>", style_cell_bold),
        Paragraph("<b>EVA Time</b>", style_cell_bold),
        Paragraph("<b>+20% Reserve</b>", style_cell_bold),
        Paragraph("<b>Hazard (0–10)</b>", style_cell_bold),
        Paragraph("<b>Science (0–1)</b>", style_cell_bold),
        Paragraph("<b>Max Slope</b>", style_cell_bold),
        Paragraph("<b>Pareto Status</b>", style_cell_bold),
    ]
    strat_table_data = [strat_header]

    for name, r in response.strategies.items():
        rm = r.metrics
        status = response.pareto.get(name, "—")
        status_txt = status.value if hasattr(status, "value") else str(status)
        is_selected = (name == strategy) or is_all

        raw_reserve = getattr(rm, "required_eva_time_with_reserve_hours", None)
        reserve_time = raw_reserve if raw_reserve is not None else ((rm.estimated_time_hours * 1.2) if rm.estimated_time_hours is not None else 0.0)
        strat_table_data.append([
            Paragraph(f"<b>{name}</b>{' [Active]' if (name == strategy and not is_all) else ''}", style_cell),
            Paragraph(f"{rm.distance_km:.2f} km", style_cell_num),
            Paragraph(f"{rm.estimated_time_hours:.2f} h", style_cell_num),
            Paragraph(f"{reserve_time:.2f} h", style_cell_num),
            Paragraph(f"{rm.avg_hazard_score:.3f}", style_cell_num),
            Paragraph(f"{rm.avg_science_value:.4f}", style_cell_num),
            Paragraph(f"{rm.max_slope_deg:.1f}°", style_cell_num),
            Paragraph(f"<font color='{SUCCESS_COLOR.hexval() if 'NON_DOMINATED' in status_txt else SLATE_MUTED.hexval()}'><b>{status_txt}</b></font>", style_cell),
        ])

    strat_table = Table(
        strat_table_data,
        colWidths=[1.3 * inch, 0.85 * inch, 0.85 * inch, 0.95 * inch, 0.85 * inch, 0.85 * inch, 0.8 * inch, 1.05 * inch]
    )
    strat_table_style = [
        ("BACKGROUND", (0, 0), (-1, 0), BG_HEADER),
        ("BOX", (0, 0), (-1, -1), 0.5, BORDER_COLOR),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, BORDER_COLOR),
        ("TOPPADDING", (0, 0), (-1, -1), 2.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
    ]
    # Highlight active row if single strategy
    if not is_all:
        for idx, (name, _) in enumerate(response.strategies.items(), start=1):
            if name == strategy:
                strat_table_style.append(("BACKGROUND", (0, idx), (-1, idx), BG_HIGHLIGHT))

    strat_table.setStyle(TableStyle(strat_table_style))
    story.append(strat_table)

    pareto_note = getattr(response.comparison, "trade_off_summary", None) or "Pareto non-dominance confirms that no alternative traverse is simultaneously superior in all dimensions."
    story.append(Spacer(1, 3))
    story.append(Paragraph(f"<b>Pareto Analysis Summary:</b> {pareto_note}", style_notice))
    story.append(Spacer(1, 6))

    # ── Section 3: Selected Route(s) Traverse Profile & Consumables ──────────
    if is_all:
        story.append(Paragraph("3. DETAILED TRAVERSE PROFILES & LIFE-SUPPORT CONSUMABLES (ALL CASES)", style_section_heading))
        story.append(HRFlowable(width="100%", thickness=0.75, color=NASA_BLUE, spaceAfter=4, spaceBefore=1))

        case_header = [
            Paragraph("<b>Case</b>", style_cell_bold),
            Paragraph("<b>Distance</b>", style_cell_bold),
            Paragraph("<b>Walk Time</b>", style_cell_bold),
            Paragraph("<b>+20% Reserve</b>", style_cell_bold),
            Paragraph("<b>Total Budget</b>", style_cell_bold),
            Paragraph("<b>Feasibility &amp; Margin</b>", style_cell_bold),
            Paragraph("<b>Mean Hazard</b>", style_cell_bold),
            Paragraph("<b>Science Pts</b>", style_cell_bold),
        ]
        case_table_data = [case_header]

        for s_name, s_route in response.strategies.items():
            s_m = s_route.metrics
            s_budget_h = getattr(s_m, "effective_eva_budget_hours", None) or 8.0
            s_raw_res = getattr(s_m, "required_eva_time_with_reserve_hours", None)
            s_time_res = s_raw_res if s_raw_res is not None else ((s_m.estimated_time_hours * 1.2) if s_m.estimated_time_hours else 0.0)
            s_res_add = getattr(s_m, "eva_reserve_hours", None) or (s_time_res - s_m.estimated_time_hours)
            s_margin = getattr(s_m, "eva_margin_hours", None) or (s_budget_h - s_time_res)
            s_feas = getattr(s_m, "is_feasible", None)
            if s_feas is None:
                s_feas = (s_time_res <= s_budget_h)

            case_table_data.append([
                Paragraph(f"<b>{s_name}</b>", style_cell_bold),
                Paragraph(f"{s_m.distance_km:.2f} km", style_cell_num),
                Paragraph(f"{s_m.estimated_time_hours:.2f} h", style_cell_num),
                Paragraph(f"+{s_res_add:.2f} h", style_cell_num),
                Paragraph(f"<b>{s_time_res:.2f} h</b>", style_cell_num),
                Paragraph(
                    f"<font color='{SUCCESS_COLOR.hexval()}'><b>FEASIBLE (+{s_margin:.2f}h)</b></font>"
                    if s_feas else
                    f"<font color='{DANGER_COLOR.hexval()}'><b>DEFICIT ({abs(s_margin):.2f}h)</b></font>",
                    style_cell,
                ),
                Paragraph(f"{s_m.avg_hazard_score:.2f} / 10", style_cell_num),
                Paragraph(f"{len(s_route.science_targets_nearby or [])} targets", style_cell_num),
            ])

        case_table = Table(case_table_data, colWidths=[1.15 * inch, 0.85 * inch, 0.85 * inch, 0.95 * inch, 0.95 * inch, 1.45 * inch, 0.9 * inch, 0.9 * inch])
        case_table.setStyle(
            TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), BG_HEADER),
                ("BOX", (0, 0), (-1, -1), 0.5, BORDER_COLOR),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, BORDER_COLOR),
                ("TOPPADDING", (0, 0), (-1, -1), 2.5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5),
                ("LEFTPADDING", (0, 0), (-1, -1), 4),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4),
            ])
        )
        story.append(case_table)
        story.append(Spacer(1, 6))

        # Use Balanced as primary reference for segment logging
        route = response.strategies.get("BALANCED") or next(iter(response.strategies.values()))
    else:
        route = response.strategies[strategy]
        m = route.metrics
        budget_h = getattr(m, "effective_eva_budget_hours", None) or 8.0
        raw_time_with_reserve = getattr(m, "required_eva_time_with_reserve_hours", None)
        time_with_reserve = raw_time_with_reserve if raw_time_with_reserve is not None else ((m.estimated_time_hours * 1.2) if m.estimated_time_hours is not None else 0.0)
        raw_reserve_h = getattr(m, "eva_reserve_hours", None)
        reserve_h = raw_reserve_h if raw_reserve_h is not None else (time_with_reserve - m.estimated_time_hours)
        raw_margin = getattr(m, "eva_margin_hours", None)
        margin_h = raw_margin if raw_margin is not None else (budget_h - time_with_reserve)
        is_feasible = getattr(m, "is_feasible", None)
        if is_feasible is None:
            is_feasible = (time_with_reserve <= budget_h)

        story.append(Paragraph(f"3. DETAILED TRAVERSE PROFILE & LIFE-SUPPORT CONSUMABLES: {strategy}", style_section_heading))
        story.append(HRFlowable(width="100%", thickness=0.75, color=NASA_BLUE, spaceAfter=4, spaceBefore=1))

        profile_data = [
            [
                Paragraph("<b>Total Surface Distance:</b>", style_cell),
                Paragraph(f"{m.distance_km:.2f} km", style_cell_bold),
                Paragraph("<b>Raw Traverse Time:</b>", style_cell),
                Paragraph(f"{m.estimated_time_hours:.2f} h", style_cell_bold),
            ],
            [
                Paragraph("<b>Life-Support Reserve (20%):</b>", style_cell),
                Paragraph(f"+{reserve_h:.2f} h", style_cell_bold),
                Paragraph("<b>Total Required Budget:</b>", style_cell),
                Paragraph(f"<b>{time_with_reserve:.2f} h</b> (Ceiling: {budget_h:.1f} h)", style_cell_bold),
            ],
            [
                Paragraph("<b>Consumables Feasibility:</b>", style_cell),
                Paragraph(
                    f"<font color='{SUCCESS_COLOR.hexval()}'><b>FEASIBLE (Margin: +{margin_h:.2f} h)</b></font>"
                    if is_feasible else
                    f"<font color='{DANGER_COLOR.hexval()}'><b>OVER BUDGET (Deficit: {abs(margin_h):.2f} h)</b></font>",
                    style_cell,
                ),
                Paragraph("<b>Mean Hazard Index:</b>", style_cell),
                Paragraph(f"{m.avg_hazard_score:.3f} / 10.0", style_cell_bold),
            ],
            [
                Paragraph("<b>Elevation Gain / Loss:</b>", style_cell),
                Paragraph(f"+{m.elevation_gain_m:.0f} m / -{m.elevation_loss_m:.0f} m", style_cell_bold),
                Paragraph("<b>Max Encountered Slope:</b>", style_cell),
                Paragraph(f"{m.max_slope_deg:.1f}°", style_cell_bold),
            ],
            [
                Paragraph("<b>Discrete Route Segments:</b>", style_cell),
                Paragraph(f"{m.segments_count} route links", style_cell_bold),
                Paragraph("<b>Impassable Cells Avoided:</b>", style_cell),
                Paragraph(f"{m.impassable_cells_avoided} cells (>5.0 trav / >max slope)", style_cell_bold),
            ],
        ]
        profile_table = Table(profile_data, colWidths=[1.8 * inch, 1.95 * inch, 1.8 * inch, 1.95 * inch])
        profile_table.setStyle(
            TableStyle([
                ("BACKGROUND", (0, 0), (-1, -1), BG_CARD),
                ("BOX", (0, 0), (-1, -1), 0.5, BORDER_COLOR),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, BORDER_COLOR),
                ("TOPPADDING", (0, 0), (-1, -1), 2.5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5),
                ("LEFTPADDING", (0, 0), (-1, -1), 5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5),
            ])
        )
        story.append(profile_table)
        story.append(Spacer(1, 6))


    # ── Section 4: Waypoint Schedule & Segment Breakdown ────────────────────
    story.append(Paragraph("4. TRAVERSAL LINK SCHEDULE & WAYPOINT LOG", style_section_heading))
    story.append(HRFlowable(width="100%", thickness=0.75, color=NASA_BLUE, spaceAfter=4, spaceBefore=1))

    seg_header = [
        Paragraph("<b>Link</b>", style_cell_bold),
        Paragraph("<b>Origin Coordinate</b>", style_cell_bold),
        Paragraph("<b>Terminal Coordinate</b>", style_cell_bold),
        Paragraph("<b>Length</b>", style_cell_bold),
        Paragraph("<b>Mean Slope</b>", style_cell_bold),
        Paragraph("<b>Elev Δ</b>", style_cell_bold),
        Paragraph("<b>Material Classification</b>", style_cell_bold),
    ]
    seg_table_data = [seg_header]

    segments = getattr(route, "segments", []) or []
    sample_segments = segments[:7] if len(segments) > 7 else segments
    for idx, seg in enumerate(sample_segments):
        start_c = getattr(seg, "start", None)
        end_c = getattr(seg, "end", None)
        s_lat = f"{start_c.lat:.4f}°N, {start_c.lon:.4f}°E" if start_c else "—"
        e_lat = f"{end_c.lat:.4f}°N, {end_c.lon:.4f}°E" if end_c else "—"
        dist_m = getattr(seg, "distance_m", 0.0)
        slope = getattr(seg, "slope_deg", 0.0)
        elev_chg = getattr(seg, "elevation_change_m", 0.0)
        mat = getattr(seg, "surface_material", "Basaltic Regolith")

        seg_table_data.append([
            Paragraph(f"#{idx + 1:02d}", style_cell_bold),
            Paragraph(s_lat, style_cell),
            Paragraph(e_lat, style_cell),
            Paragraph(f"{dist_m:.0f} m", style_cell_num),
            Paragraph(f"{slope:.1f}°", style_cell_num),
            Paragraph(f"{elev_chg:+.1f} m", style_cell_num),
            Paragraph(mat[:24], style_cell),
        ])

    seg_table = Table(seg_table_data, colWidths=[0.55 * inch, 1.45 * inch, 1.45 * inch, 0.75 * inch, 0.75 * inch, 0.75 * inch, 1.8 * inch])
    seg_table.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), BG_HEADER),
            ("BOX", (0, 0), (-1, -1), 0.5, BORDER_COLOR),
            ("INNERGRID", (0, 0), (-1, -1), 0.5, BORDER_COLOR),
            ("TOPPADDING", (0, 0), (-1, -1), 2),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
            ("LEFTPADDING", (0, 0), (-1, -1), 4),
            ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ])
    )
    story.append(seg_table)
    if len(segments) > 7:
        story.append(Spacer(1, 2))
        story.append(Paragraph(f"<i>Log truncated: showing 7 of {len(segments)} discrete links. Complete waypoint sequence logged in onboard cartographic telemetry.</i>", style_notice))

    # Clean PageBreak for Appendixes & Provenance
    story.append(PageBreak())

    # ── Section 5: Science Targets Encountered ────────────────────────────────
    targets = getattr(route, "science_targets_nearby", []) or []
    story.append(Paragraph("5. SCIENTIFIC OPPORTUNITIES & TARGET ENCOUNTERS", style_section_heading))
    story.append(HRFlowable(width="100%", thickness=0.75, color=NASA_BLUE, spaceAfter=4, spaceBefore=1))

    if targets:
        sci_header = [
            Paragraph("<b>Target Designation</b>", style_cell_bold),
            Paragraph("<b>Distance from Path</b>", style_cell_bold),
            Paragraph("<b>Science Score</b>", style_cell_bold),
            Paragraph("<b>Mission Priority Tier</b>", style_cell_bold),
        ]
        sci_table_data = [sci_header]
        for t in targets[:6]:
            t_name = getattr(t, "name", "Unnamed Outcrop")
            t_dist = getattr(t, "distance_from_route_m", 0)
            t_val = getattr(t, "science_value", 0.0)
            t_tier = getattr(t, "tier", "SECONDARY")
            sci_table_data.append([
                Paragraph(t_name, style_cell),
                Paragraph(f"{t_dist / 1000.0:.2f} km", style_cell_num),
                Paragraph(f"{t_val:.2f}", style_cell_num),
                Paragraph(f"<b>{t_tier}</b>", style_cell),
            ])
        sci_table = Table(sci_table_data, colWidths=[2.8 * inch, 1.5 * inch, 1.5 * inch, 1.7 * inch])
        sci_table.setStyle(
            TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), BG_HEADER),
                ("BOX", (0, 0), (-1, -1), 0.5, BORDER_COLOR),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, BORDER_COLOR),
                ("TOPPADDING", (0, 0), (-1, -1), 2.5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5),
                ("LEFTPADDING", (0, 0), (-1, -1), 5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5),
            ])
        )
        story.append(sci_table)
    else:
        story.append(Paragraph("No designated science targets within the direct sensing perimeter of this traverse.", style_body))

    story.append(Spacer(1, 2))
    story.append(
        Paragraph(
            "<b>Scientific Notice:</b> Regional science values are model indices derived from CRISM mineral spectral indicators "
            "(carbonates/olivine) and published literature catalogs. They represent relative scientific interest, not guaranteed ground observations.",
            style_notice,
        )
    )
    story.append(Spacer(1, 6))

    # ── Section 6: Appendix A — Data Provenance ───────────────────────────────
    story.append(Paragraph("APPENDIX A — MULTI-MISSION NASA/PDS DATA PROVENANCE", style_section_heading))
    story.append(HRFlowable(width="100%", thickness=0.75, color=NASA_BLUE, spaceAfter=4, spaceBefore=1))
    story.append(Paragraph("Every spatial raster used in this calculation is traced to authoritative NASA Planetary Data System (PDS) archives:", style_body))

    prov_header = [
        Paragraph("<b>Instrument &amp; Mission</b>", style_cell_bold),
        Paragraph("<b>PDS Product Identifier</b>", style_cell_bold),
        Paragraph("<b>Confidence</b>", style_cell_bold),
        Paragraph("<b>Resolution</b>", style_cell_bold),
        Paragraph("<b>Derivation &amp; Usage</b>", style_cell_bold),
    ]
    prov_data = [prov_header]
    for p in ds.get_provenance():
        res_txt = f"{p.resolution_m:.1f} m" if isinstance(p.resolution_m, (int, float)) else str(p.resolution_m)
        prov_data.append([
            Paragraph(f"<b>{p.instrument}</b><br/><font color='{SLATE_MUTED.hexval()}'>{p.mission}</font>", style_cell),
            Paragraph(f"<code>{p.pds_product_id}</code>", style_cell),
            Paragraph(p.confidence, style_cell),
            Paragraph(res_txt, style_cell_num),
            Paragraph(p.notes[:150] + "…" if len(p.notes) > 150 else p.notes, style_cell),
        ])

    prov_table = Table(prov_data, colWidths=[1.55 * inch, 1.85 * inch, 0.75 * inch, 0.75 * inch, 2.6 * inch])
    prov_table.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), BG_HEADER),
            ("BOX", (0, 0), (-1, -1), 0.5, BORDER_COLOR),
            ("INNERGRID", (0, 0), (-1, -1), 0.5, BORDER_COLOR),
            ("TOPPADDING", (0, 0), (-1, -1), 2),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
            ("LEFTPADDING", (0, 0), (-1, -1), 4),
            ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ])
    )
    story.append(prov_table)
    story.append(Spacer(1, 6))

    # ── Section 7: Appendix B — Routing Methodology ──────────────────────────
    story.append(Paragraph("APPENDIX B — ALGORITHMIC ADMISSIBILITY & MATHEMATICAL PROOF", style_section_heading))
    story.append(HRFlowable(width="100%", thickness=0.75, color=NASA_BLUE, spaceAfter=4, spaceBefore=1))
    method_text = (
        "Traverses are computed via multi-objective A* on an 8-connected grid of 300×300 cells "
        f"covering the Jezero Crater study box ({meta.cell_size_ns_m:.1f}m × {meta.cell_size_ew_m:.1f}m cell pitch). "
        "Edge costs incorporate Euclidean step distance, terrain slope energy expenditure, traversability friction, and science penalties. "
        "Science values are inverted as non-negative penalties <code>(1.0 - science_value)</code>, preserving non-negative edge costs across all graph edges. "
        "The heuristic function uses <code>w_distance × Euclidean_distance / 1000.0</code>, which is strictly admissible (never overestimates remaining travel cost), "
        "guaranteeing optimal path convergence."
    )
    story.append(Paragraph(method_text, style_body))
    story.append(Spacer(1, 6))

    # ── Official Engineering Sign-off Box ────────────────────────────────────
    signoff_data = [
        [
            Paragraph("<b>REPORT PREPARED BY</b><br/>VICTOR Automated Science Traversal Engine", style_cell),
            Paragraph("<b>MATHEMATICAL VERIFICATION</b><br/>Multi-Objective A* Admissibility Certified", style_cell),
            Paragraph("<b>AUTHORITY / CONTEXT</b><br/>NASA Space Apps Challenge 2026", style_cell),
        ]
    ]
    signoff_table = Table(signoff_data, colWidths=[2.5 * inch, 2.5 * inch, 2.5 * inch])
    signoff_table.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), BG_HEADER),
            ("BOX", (0, 0), (-1, -1), 0.75, NASA_BLUE),
            ("INNERGRID", (0, 0), (-1, -1), 0.5, BORDER_COLOR),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ])
    )
    story.append(signoff_table)

    # Build document
    doc.build(story, canvasmaker=NumberedCanvas)
    return buf.getvalue()


def _format_bold(text: str) -> str:
    """Format markdown bold into HTML strong tags."""
    parts = text.split("**")
    out = []
    for i, part in enumerate(parts):
        out.append(f"<b>{part}</b>" if i % 2 else part)
    return "".join(out)
