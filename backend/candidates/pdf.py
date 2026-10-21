from io import BytesIO
from pathlib import Path
import re
from xml.sax.saxutils import escape

from django.utils import timezone
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle, PageBreak

from .schema import SCHEMA


def create_candidate_pdf(candidate):
    font_path = Path('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf')
    if 'CandidateSans' not in pdfmetrics.getRegisteredFontNames():
        pdfmetrics.registerFont(TTFont('CandidateSans', str(font_path)))
    body = ParagraphStyle('CandidateBody', fontName='CandidateSans', fontSize=8, leading=10.5)
    title = ParagraphStyle('CandidateTitle', parent=body, fontSize=13, leading=17, alignment=TA_CENTER, spaceAfter=8)
    heading = ParagraphStyle('CandidateHeading', parent=body, fontSize=10, leading=13, spaceBefore=9, spaceAfter=5, keepWithNext=True)
    consent_style = ParagraphStyle('CandidateConsent', parent=body, fontSize=7, leading=8.7, spaceAfter=3)

    def paragraph(value, style=body):
        return Paragraph(escape(str(value)).replace('\n', '<br/>'), style)

    def display(value):
        if type(value) is bool:
            return 'Да' if value else 'Нет'
        if isinstance(value, str) and re.fullmatch(r'\d{4}-\d{2}-\d{2}', value):
            return '.'.join(reversed(value.split('-')))
        return value or 'Не указано'

    def table(rows):
        # splitInRow supports arbitrarily long free-text answers without clipping.
        result = Table(rows, colWidths=[174, 337], hAlign='LEFT', splitInRow=1)
        result.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('GRID', (0, 0), (-1, -1), 0.4, colors.HexColor('#ced4cb')),
            ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#f2f5ed')),
            ('LEFTPADDING', (0, 0), (-1, -1), 8),
            ('RIGHTPADDING', (0, 0), (-1, -1), 8),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ]))
        return result

    content = [paragraph('CONCEPT GROUP', title), paragraph('АНКЕТА КАНДИДАТА', title),
               paragraph(f'Номер анкеты: {candidate.id}'),
               paragraph('Дата отправки: ' + timezone.localtime(candidate.created_at).strftime('%d.%m.%Y %H:%M:%S МСК'))]
    dependencies = {'nameChangeDetails': 'nameChanged', 'previousCompanyWork': 'workedBefore', 'fsspDetails': 'hasFssp', 'loanDetails': 'hasLoans', 'businessName': 'hasBusiness', 'relativesDetails': 'hasRelatives'}

    def visible(field):
        key = field['key']
        if key in dependencies and not candidate.data.get(dependencies[key]):
            return False
        if key.startswith('live') and candidate.data.get('sameAddress'):
            return False
        return True

    for step in SCHEMA['steps'][:-1]:
        for group in step['groups']:
            content.append(paragraph(group['title'], heading))
            rows = [[paragraph(f['label']), paragraph(display(candidate.data.get(f['key'])))] for f in group['fields'] if visible(f)]
            content.append(table(rows))
        if step['title'] == 'Образование и опыт':
            content.append(paragraph('Трудовая деятельность', heading))
            if not candidate.data['jobs']:
                content.append(paragraph('Сведения не указаны.'))
            for index, job in enumerate(candidate.data['jobs'], 1):
                content.append(paragraph(f'Место работы {index}', heading))
                content.append(table([[paragraph(f['label']), paragraph(display(job.get(f['key'])))] for f in SCHEMA['work']]))
    content += [PageBreak(), paragraph('Согласие на обработку персональных данных', title)]
    content.extend(paragraph(line, consent_style) for line in candidate.consent_text.splitlines()[1:] if line.strip())
    content += [Spacer(1, 8), paragraph('Согласие подтверждено при отправке анкеты.', consent_style),
                paragraph('ФИО: ' + candidate.full_name, consent_style),
                paragraph('Дата подтверждения: ' + timezone.localtime(candidate.consent_at).strftime('%d.%m.%Y %H:%M:%S МСК'), consent_style),
                paragraph('Версия: ' + candidate.consent_version, consent_style),
                paragraph('SHA-256 текста: ' + candidate.consent_sha256, consent_style)]
    output = BytesIO()
    doc = SimpleDocTemplate(output, pagesize=A4, rightMargin=42, leftMargin=42, topMargin=38, bottomMargin=42, title='Анкета кандидата Concept Group', author='Concept Group')

    def footer(canvas, document):
        canvas.setFont('CandidateSans', 7)
        canvas.drawString(42, 23, f'Concept Group | {candidate.id}')
        canvas.drawRightString(A4[0] - 42, 23, f'Страница {document.page}')

    doc.build(content, onFirstPage=footer, onLaterPages=footer)
    return output.getvalue()
