#!/usr/bin/env python3
"""
MIDI -> 曲データJSON 変換スクリプト(演奏モード v0)

対象: SPEC.md セクション5・9・10・13.1。
- MIDIファイルを読み込み、同時発音(同一開始タイミング)をまとめて「和音イベント」とする。
- SPEC.md §9のキーマッピング(KeyboardEvent.code、C3〜G#6の連続クロマチック45鍵)に従い、
  MIDIノート番号をキーへ変換する。
- 和音が6音を超えたらエラーで停止する(SPEC.md §4・§7)。
- C3〜G#6の範囲外の音は、単音ごとに1オクターブだけシフトして範囲内に収め、
  "octaveAdjusted": true を付与する(全体移調は行わない。理由はSPEC.mdの
  「実装からの質問」セクション参照)。
- 各イベントに "onsetDeltaRatio" を付与する(直前イベントの発音時点から本イベントの
  発音時点までを四分音符=1.0とした比。先頭イベントは0。SPEC.md §13.1)。

使い方:
    ./venv/bin/python tools/preprocess_midi.py <入力MIDI> <出力JSON> \
        --title "曲名" --composer "作曲者" --source-url "URL" --license "ライセンス"

依存: mido (venv内にインストール済みであること。 ./venv/bin/pip install mido)
"""

import argparse
import json
import sys
from pathlib import Path

import mido

# --- SPEC.md §9 キーマッピング ---------------------------------------------
# 4段、各段左から右へ半音上昇。C3(MIDIノート48)からG#6(MIDIノート92)まで
# 連続クロマチック45鍵。KeyboardEvent.code ベース(レイアウト非依存)。

KEY_CODES_IN_ORDER = [
    # Z段: C3〜A3 (10鍵)
    "KeyZ", "KeyX", "KeyC", "KeyV", "KeyB", "KeyN", "KeyM", "Comma", "Period", "Slash",
    # A段: A#3〜G#4 (11鍵)
    "KeyA", "KeyS", "KeyD", "KeyF", "KeyG", "KeyH", "KeyJ", "KeyK", "KeyL", "Semicolon", "Quote",
    # Q段: A4〜G#5 (12鍵)
    "KeyQ", "KeyW", "KeyE", "KeyR", "KeyT", "KeyY", "KeyU", "KeyI", "KeyO", "KeyP", "BracketLeft", "BracketRight",
    # 数字段: A5〜G#6 (12鍵)
    "Digit1", "Digit2", "Digit3", "Digit4", "Digit5", "Digit6", "Digit7", "Digit8", "Digit9", "Digit0", "Minus", "Equal",
]

MIDI_NOTE_MIN = 48  # C3
MIDI_NOTE_MAX = 48 + len(KEY_CODES_IN_ORDER) - 1  # G#6 = 92

assert MIDI_NOTE_MAX == 92, "キーマッピングの鍵数がSPEC §9と一致していません"
assert len(KEY_CODES_IN_ORDER) == 45


def midi_note_to_key_code(midi_note: int) -> str:
    """MIDIノート番号(範囲内であることが前提)をKeyboardEvent.codeへ変換する。"""
    index = midi_note - MIDI_NOTE_MIN
    if index < 0 or index >= len(KEY_CODES_IN_ORDER):
        raise ValueError(f"MIDIノート{midi_note}はキーマッピング範囲外です")
    return KEY_CODES_IN_ORDER[index]


def note_name(midi_note: int) -> str:
    names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
    octave = midi_note // 12 - 1
    return f"{names[midi_note % 12]}{octave}"


# --- MIDI読み込み・和音グループ化 -------------------------------------------

def collect_note_spans(mf: mido.MidiFile):
    """全トラックのnote_on/offを絶対tickでマージし、(start_tick, end_tick, note, velocity)のリストを返す。"""
    spans = []
    for track in mf.tracks:
        abs_tick = 0
        open_notes = {}  # (channel, note) -> (start_tick, velocity)
        for msg in track:
            abs_tick += msg.time
            if msg.type == "note_on" and msg.velocity > 0:
                open_notes[(msg.channel, msg.note)] = (abs_tick, msg.velocity)
            elif msg.type == "note_off" or (msg.type == "note_on" and msg.velocity == 0):
                key = (msg.channel, msg.note)
                if key in open_notes:
                    start_tick, velocity = open_notes.pop(key)
                    spans.append((start_tick, abs_tick, msg.note, velocity))
    return spans


def group_into_chord_events(spans):
    """開始tickが同一のノートを1つの和音イベントとしてまとめる。"""
    by_start = {}
    for start_tick, end_tick, note, velocity in spans:
        by_start.setdefault(start_tick, []).append((end_tick, note, velocity))
    ordered_starts = sorted(by_start.keys())
    events = []
    for start_tick in ordered_starts:
        notes_in_chord = by_start[start_tick]
        # 和音内でも音の高さ順に並べておく(表示・デバッグしやすくするため)
        notes_in_chord.sort(key=lambda t: t[1])
        events.append((start_tick, notes_in_chord))
    return events


def build_song_json(mf: mido.MidiFile, meta: dict):
    ticks_per_beat = mf.ticks_per_beat
    tempo_us_per_beat = 500000  # デフォルト(四分音符=120bpm相当)。set_tempoがあれば上書き。
    for track in mf.tracks:
        for msg in track:
            if msg.type == "set_tempo":
                tempo_us_per_beat = msg.tempo
                break

    spans = collect_note_spans(mf)
    if not spans:
        raise ValueError("MIDIファイルからノートが検出できませんでした")

    chord_events = group_into_chord_events(spans)

    octave_adjusted_notes = []
    dropped_notes = []
    events_json = []
    previous_start_tick = None

    for start_tick, notes_in_chord in chord_events:
        # --- SPEC §9(2026-07-17改訂): 音域外の音は必要なだけオクターブシフトして収める ---
        placed = []  # (note, end_tick, velocity, adjusted)
        for end_tick, original_note, velocity in notes_in_chord:
            note = original_note
            while note < MIDI_NOTE_MIN:
                note += 12
            while note > MIDI_NOTE_MAX:
                note -= 12
            adjusted = note != original_note
            if adjusted:
                octave_adjusted_notes.append({
                    "originalMidiNote": original_note,
                    "originalNoteName": note_name(original_note),
                    "adjustedMidiNote": note,
                    "adjustedNoteName": note_name(note),
                    "startTick": start_tick,
                })
            placed.append([note, end_tick, velocity, adjusted])

        # --- SPEC §12改訂(v1宿題): 補正で生じた同一音ユニゾンは1音に統合(velocityは大きい方) ---
        merged = {}
        for note, end_tick, velocity, adjusted in placed:
            if note in merged:
                prev = merged[note]
                prev[1] = max(prev[1], end_tick)
                prev[2] = max(prev[2], velocity)
                prev[3] = prev[3] or adjusted
            else:
                merged[note] = [note, end_tick, velocity, adjusted]
        chord = sorted(merged.values(), key=lambda t: t[0])

        # --- SPEC §7(2026-07-17改訂): 6音超の和音は間引いて6音に収める(アレンジ譜面) ---
        # 削除優先順: (1)オクターブ重複音(同一ピッチクラス)の低い方 (2)最高音・最低音を除く
        # 中間音のうちベロシティ最小のもの。旋律(最高音)とバス(最低音)は必ず残す。
        while len(chord) > 6:
            removed = None
            pitch_classes = {}
            for entry in chord:
                pitch_classes.setdefault(entry[0] % 12, []).append(entry)
            for pc_entries in pitch_classes.values():
                if len(pc_entries) > 1:
                    removed = pc_entries[0]  # 同ピッチクラスの最低音
                    break
            if removed is None:
                inner = chord[1:-1]
                removed = min(inner, key=lambda t: t[2])  # ベロシティ最小の中間音
            chord.remove(removed)
            dropped_notes.append({
                "midiNote": removed[0],
                "noteName": note_name(removed[0]),
                "startTick": start_tick,
            })

        keys = []
        midi_notes = []
        duration_ratios = []
        velocities = []
        octave_adjusted_flags = []
        for note, end_tick, velocity, adjusted in chord:
            keys.append(midi_note_to_key_code(note))
            midi_notes.append(note)
            duration_ratios.append(round((end_tick - start_tick) / ticks_per_beat, 6))
            velocities.append(velocity)
            octave_adjusted_flags.append(adjusted)

        # SPEC.md §13.1: 直前イベントの発音時点からの経過時間を四分音符=1.0の比で表す。
        # 先頭イベントは0。休符は次イベントのonsetDeltaRatioが直前イベントの
        # durationRatioの最大値を超える差分として自然に表現される(専用の休符イベントは作らない)。
        if previous_start_tick is None:
            onset_delta_ratio = 0.0
        else:
            onset_delta_ratio = round((start_tick - previous_start_tick) / ticks_per_beat, 6)
        previous_start_tick = start_tick

        events_json.append({
            "keys": keys,
            "midiNotes": midi_notes,
            "durationRatios": duration_ratios,
            "velocities": velocities,
            "octaveAdjusted": octave_adjusted_flags,
            "onsetDeltaRatio": onset_delta_ratio,
        })

    max_chord_size = max(len(ev["keys"]) for ev in events_json)
    assert max_chord_size <= 6, "間引き後も6音を超える和音が残っています(実装バグ)"

    song_json = {
        "title": meta["title"],
        "composer": meta["composer"],
        "sourceUrl": meta["source_url"],
        "license": meta["license"],
        "sourceFile": meta["source_file"],
        "ticksPerBeat": ticks_per_beat,
        "tempoMicrosecondsPerBeat": tempo_us_per_beat,
        "maxChordSize": max_chord_size,
        "eventCount": len(events_json),
        "octaveAdjustedNotes": octave_adjusted_notes,
        "droppedNotes": dropped_notes,
        "keyRange": {"min": note_name(MIDI_NOTE_MIN), "max": note_name(MIDI_NOTE_MAX)},
        "events": events_json,
    }
    return song_json


def main():
    parser = argparse.ArgumentParser(description="MIDI -> 曲データJSON 変換(演奏モードv0)")
    parser.add_argument("input_midi", type=Path)
    parser.add_argument("output_json", type=Path)
    parser.add_argument("--title", required=True)
    parser.add_argument("--composer", required=True)
    parser.add_argument("--source-url", required=True)
    parser.add_argument("--license", required=True)
    args = parser.parse_args()

    mf = mido.MidiFile(str(args.input_midi))
    meta = {
        "title": args.title,
        "composer": args.composer,
        "source_url": args.source_url,
        "license": args.license,
        "source_file": args.input_midi.name,
    }

    try:
        song_json = build_song_json(mf, meta)
    except ValueError as e:
        print(f"エラー: {e}", file=sys.stderr)
        sys.exit(1)

    args.output_json.parent.mkdir(parents=True, exist_ok=True)
    with open(args.output_json, "w", encoding="utf-8") as f:
        json.dump(song_json, f, ensure_ascii=False, indent=2)

    print(f"生成完了: {args.output_json}")
    print(f"  イベント数: {song_json['eventCount']}")
    print(f"  最大同時和音数: {song_json['maxChordSize']}")
    print(f"  オクターブ補正した音: {len(song_json['octaveAdjustedNotes'])}件")
    print(f"  6音制限で間引いた音: {len(song_json['droppedNotes'])}件")


if __name__ == "__main__":
    main()
