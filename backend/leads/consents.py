"""Tour enquiries: owner-supplied consent terms adapted to this form and purpose."""
import json
from pathlib import Path

SITE_CONSENTS = json.loads(Path(__file__).with_name('lead_consents.json').read_text())
PUBLIC_CONSENT_VERSION = SITE_CONSENTS['version']


def consent_evidence(*, now, marketing):
    return {
        'version': PUBLIC_CONSENT_VERSION, 'submitted_at': now.isoformat(),
        'operator': SITE_CONSENTS['operator'], 'inn': SITE_CONSENTS['inn'],
        'consents': {
            key: {
                'accepted': accepted, 'document_url': url, 'document_version': version,
                'title': document['title'], 'text': '\n\n'.join(document['paragraphs']),
            }
            for key, accepted, url, version, document in [
                ('personal_data', True, '/consents/personal-data', SITE_CONSENTS['version'], SITE_CONSENTS['documents']['personal-data']),
                ('marketing', marketing, '/consents/marketing', SITE_CONSENTS['version'], SITE_CONSENTS['documents']['marketing']),
            ]
        },
    }
