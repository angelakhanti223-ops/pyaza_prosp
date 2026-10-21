import json
from pathlib import Path

SCHEMA = json.loads(Path(__file__).with_name('schema.json').read_text(encoding='utf-8'))
FIELDS = [field for step in SCHEMA['steps'] for group in step['groups'] for field in group['fields']]
