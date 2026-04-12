#!/usr/bin/env python3
from __future__ import annotations

import json
import re
from datetime import date
from pathlib import Path
from typing import Any

from docx import Document
from openpyxl import load_workbook

BASE = Path(__file__).resolve().parent.parent
KB_DIR = BASE / 'config' / 'psyco_kb'
DOC_SIGNS = KB_DIR / '【20260410】签文语料 集合(1).docx'
DOC_SCRIPTS = KB_DIR / '【20260410】25条 文字版 集合.docx'
XLS = KB_DIR / '心理赋能 语料.xlsx'
OUT = KB_DIR / 'daily_encouragement_kb.json'


def docx_lines(path: Path) -> list[str]:
    doc = Document(path)
    return [p.text.strip() for p in doc.paragraphs if p.text and p.text.strip()]


def parse_signs() -> list[dict[str, Any]]:
    lines = docx_lines(DOC_SIGNS)
    entries: list[dict[str, Any]] = []
    idx = 1
    for line in lines:
        style = None
        if line.startswith('传统版：'):
            style = 'traditional'
            text = line.replace('传统版：', '', 1).strip()
        elif line.startswith('简短版：'):
            style = 'short'
            text = line.replace('简短版：', '', 1).strip()
        else:
            continue

        if not text:
            continue

        entries.append(
            {
                'id': f'sign-{idx:03d}',
                'type': 'sign',
                'style': style,
                'title': '每日签文',
                'text': text,
                'source': DOC_SIGNS.name,
            }
        )
        idx += 1
    return entries


def parse_affirmations_and_actions() -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    wb = load_workbook(XLS, data_only=True)

    affirmations: list[dict[str, Any]] = []
    ws = wb['可用作抽签彩蛋 - 心理赋能语句']
    idx = 1
    for row in ws.iter_rows(min_row=2, max_col=2, values_only=True):
        text = str(row[1]).strip() if row[1] else ''
        if not text:
            continue
        affirmations.append(
            {
                'id': f'affirmation-{idx:03d}',
                'type': 'affirmation',
                'style': 'statement',
                'title': '心理赋能句',
                'text': text,
                'source': XLS.name,
            }
        )
        idx += 1

    micro_actions: list[dict[str, Any]] = []
    ws2 = wb['25条微行动（每条4分钟）']
    current: dict[str, Any] | None = None
    action_idx = 1
    for row in ws2.iter_rows(min_row=1, max_col=2, values_only=True):
        value = row[1]
        line = str(value).strip() if value else ''
        if not line:
            continue

        if line.startswith('微行动名称：'):
            if current and current.get('name'):
                micro_actions.append(
                    {
                        'id': f'micro-action-{action_idx:03d}',
                        'type': 'micro_action',
                        'title': current['name'],
                        'guide': current.get('guide', ''),
                        'tip': current.get('tip', ''),
                        'source': XLS.name,
                    }
                )
                action_idx += 1
            current = {'name': line.replace('微行动名称：', '', 1).strip()}
            continue

        if current is None:
            continue

        if line.startswith('催眠引导语（待录制）：'):
            current['guide'] = line.replace('催眠引导语（待录制）：', '', 1).strip()
        elif line.startswith('生理贴士：'):
            current['tip'] = line.replace('生理贴士：', '', 1).strip()

    if current and current.get('name'):
        micro_actions.append(
            {
                'id': f'micro-action-{action_idx:03d}',
                'type': 'micro_action',
                'title': current['name'],
                'guide': current.get('guide', ''),
                'tip': current.get('tip', ''),
                'source': XLS.name,
            }
        )

    return affirmations, micro_actions


def parse_audio_scripts() -> list[dict[str, Any]]:
    lines = docx_lines(DOC_SCRIPTS)
    entries: list[dict[str, Any]] = []
    current: dict[str, Any] | None = None
    idx = 1

    title_re = re.compile(r'第\s*(\d+)\s*条\s*标准化录音脚本：?《(.+?)》')

    for line in lines:
        match = title_re.search(line.replace('🎙️ ', ''))
        if match:
            if current:
                entries.append(
                    {
                        'id': f'audio-script-{idx:03d}',
                        'type': 'audio_script',
                        'index': int(current['index']),
                        'title': current['title'],
                        'content': '\n'.join(current['content']).strip(),
                        'source': DOC_SCRIPTS.name,
                    }
                )
                idx += 1
            current = {'index': match.group(1), 'title': match.group(2), 'content': []}
            continue

        if current is None:
            continue

        if set(line) == {'-'}:
            continue

        current['content'].append(line)

    if current:
        entries.append(
            {
                'id': f'audio-script-{idx:03d}',
                'type': 'audio_script',
                'index': int(current['index']),
                'title': current['title'],
                'content': '\n'.join(current['content']).strip(),
                'source': DOC_SCRIPTS.name,
            }
        )

    return entries


def main() -> None:
    signs = parse_signs()
    affirmations, micro_actions = parse_affirmations_and_actions()
    audio_scripts = parse_audio_scripts()

    data = {
        'version': date.today().isoformat(),
        'sources': [DOC_SIGNS.name, DOC_SCRIPTS.name, XLS.name],
        'encouragements': [*signs, *affirmations],
        'micro_actions': micro_actions,
        'audio_scripts': audio_scripts,
        'stats': {
            'encouragements': len(signs) + len(affirmations),
            'micro_actions': len(micro_actions),
            'audio_scripts': len(audio_scripts),
        },
    }

    OUT.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'Generated: {OUT}')
    print(json.dumps(data['stats'], ensure_ascii=False))


if __name__ == '__main__':
    main()
