#!/usr/bin/env python3
"""
黒鍵と和音の入門ドリル(Lv3)のMIDI生成スクリプト(SPEC.md §19.2)

半音階の階段 -> ト長調の階段(黒鍵相当キーの導入) -> 2音和音入門、の3セクション構成。
tools/make_practice_song.py / make_practice_song_lv2.py と同じ生成スタイルに従う。
セクション間には1拍の休符を置く。

生成したMIDIは既存の tools/preprocess_midi.py に通してJSON化する:
    ./venv/bin/python tools/make_practice_song_lv3.py
    ./venv/bin/python tools/preprocess_midi.py tools/source_midi/practice_drill_lv3.mid \
        songs/practice_drill_lv3.json \
        --title "黒鍵と和音の入門ドリル" --composer "自作(練習用ドリル)" \
        --source-url "tools/make_practice_song_lv3.py" --license "CC0相当(自作・権利なし)"

ライセンス: 自作のためCC0相当(SPEC.md §8改訂に準拠)。

改訂メモ(2026-07-17、設計側): 当初の指定音列はト長調ペンタコード(G-A-B-C-D)で
F#を含まず「F#入門」の見出しと矛盾していた(SPEC「実装からの質問」6)。設計回答として
セクション2をト長調1オクターブの上下(G4〜G5、F#5=KeyPを通る)に改訂した。
"""

from pathlib import Path

import mido

TICKS_PER_BEAT = 480
TEMPO_US_PER_BEAT = 857143  # 四分音符=70bpm
VELOCITY = 80
GATE = 0.9

C4, CS4, D4, DS4, E4 = 60, 61, 62, 63, 64
F4, G4, A4, B4 = 65, 67, 69, 71
C5, D5, E5, FS5, G5 = 72, 74, 76, 78, 79

REST = None

# 各要素: (note または [note, note, ...]（和音）, 拍数)
SCORE = []

# 1. 半音の階段
SCORE += [
    (C4, 1), (CS4, 1), (D4, 1), (DS4, 1), (E4, 1),
    (E4, 1), (DS4, 1), (D4, 1), (CS4, 1), (C4, 2),
]
SCORE += [(REST, 1)]

# 2. ト長調の階段(F#入門): 1オクターブの上下でF#5(KeyP)を通る(SPEC設計回答6で改訂)
SCORE += [
    (G4, 1), (A4, 1), (B4, 1), (C5, 1), (D5, 1), (E5, 1), (FS5, 1), (G5, 2),
]
SCORE += [
    (G5, 1), (FS5, 1), (E5, 1), (D5, 1), (C5, 1), (B4, 1), (A4, 1), (G4, 2),
]
SCORE += [(REST, 1)]

# 3. 2音和音入門
SCORE += [
    ([C4, E4], 2), ([D4, F4], 2), ([E4, G4], 2), ([F4, A4], 2),
    ([G4, B4], 2), ([C4, G4], 2), ([C4, E4], 2),
]


def main():
    mf = mido.MidiFile(ticks_per_beat=TICKS_PER_BEAT)
    track = mido.MidiTrack()
    mf.tracks.append(track)
    track.append(mido.MetaMessage("set_tempo", tempo=TEMPO_US_PER_BEAT, time=0))

    pending_delay = 0
    event_count = 0
    max_chord_size = 1
    for notes, beats in SCORE:
        beat_ticks = int(beats * TICKS_PER_BEAT)
        if notes is REST:
            pending_delay += beat_ticks
            continue
        chord = notes if isinstance(notes, list) else [notes]
        max_chord_size = max(max_chord_size, len(chord))
        gate_ticks = int(beat_ticks * GATE)
        for i, n in enumerate(chord):
            track.append(mido.Message("note_on", note=n, velocity=VELOCITY,
                                       time=pending_delay if i == 0 else 0))
        for i, n in enumerate(chord):
            track.append(mido.Message("note_off", note=n, velocity=0,
                                       time=gate_ticks if i == 0 else 0))
        pending_delay = beat_ticks - gate_ticks
        event_count += 1

    out = Path(__file__).parent / "source_midi" / "practice_drill_lv3.mid"
    out.parent.mkdir(parents=True, exist_ok=True)
    mf.save(str(out))
    print(f"生成完了: {out}")
    print(f"  イベント数: {event_count} / 最大和音数: {max_chord_size}"
          f" / テンポ: 四分音符={60_000_000 // TEMPO_US_PER_BEAT}")


if __name__ == "__main__":
    main()
