#!/usr/bin/env python3
"""
songs_private/index.json の生成・更新スクリプト(SPEC.md §23)

songs_private/*.json(index.json自身を除く)を走査し、曲選択UI用の索引を作る。
既にindex.jsonにあるエントリのlevel・labelは手編集を尊重してそのまま保持し、
新しい曲ファイルだけを追記する。ファイルが消えた曲は索引から外す。

使い方: ./venv/bin/python tools/build_private_index.py
"""

import json
from pathlib import Path

PRIVATE_DIR = Path(__file__).parent.parent / "songs_private"
INDEX_PATH = PRIVATE_DIR / "index.json"


def main():
    existing = {}
    if INDEX_PATH.exists():
        try:
            for entry in json.loads(INDEX_PATH.read_text(encoding="utf-8")):
                existing[entry["id"]] = entry
        except (json.JSONDecodeError, KeyError, TypeError):
            print("警告: 既存のindex.jsonが壊れているため作り直します")

    entries = []
    for path in sorted(PRIVATE_DIR.glob("*.json")):
        if path.name == "index.json":
            continue
        song_id = path.stem
        if song_id in existing:
            entries.append(existing[song_id])  # 手編集(level/label)を保持
            continue
        try:
            title = json.loads(path.read_text(encoding="utf-8")).get("title", song_id)
        except json.JSONDecodeError:
            print(f"警告: {path.name} が読めないためスキップ")
            continue
        entries.append({
            "id": song_id,
            "file": f"songs_private/{path.name}",
            "level": None,  # 手で難易度を入れる(nullのままなら「Lv.?」表示)
            "label": title,
        })

    INDEX_PATH.write_text(
        json.dumps(entries, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(f"生成完了: {INDEX_PATH} ({len(entries)}曲)")


if __name__ == "__main__":
    main()
