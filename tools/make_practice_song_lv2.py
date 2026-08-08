#!/usr/bin/env python3
"""
民謡メドレー(Lv2)のMIDI生成スクリプト(SPEC.md §19.2)

ハ長調・C4〜C5・単音のみ。ちょうちょ/メリーさんの羊/聖者の行進の3曲を
1拍休符でつないだメドレー。tools/make_practice_song.py と同じ生成スタイルに従う。

生成したMIDIは既存の tools/preprocess_midi.py に通してJSON化する:
    ./venv/bin/python tools/make_practice_song_lv2.py
    ./venv/bin/python tools/preprocess_midi.py tools/source_midi/practice_folk_lv2.mid \
        songs/practice_folk_lv2.json \
        --title "民謡メドレー(ちょうちょ・メリーさん・聖者の行進)" \
        --composer "PD民謡(自作打ち込み)" \
        --source-url "tools/make_practice_song_lv2.py" --license "CC0相当(自作・PD民謡)"

ライセンス: 自作打ち込みのためCC0相当(SPEC.md §8改訂に準拠)。旋律自体はPD民謡・童謡。
"""

from pathlib import Path

import mido

TICKS_PER_BEAT = 480
TEMPO_US_PER_BEAT = 750000  # 四分音符=80bpm
VELOCITY = 80
GATE = 0.9

C4, D4, E4, F4, G4, A4, B4, C5 = 60, 62, 64, 65, 67, 69, 71, 72

REST = None

SCORE = []

# 1. ちょうちょ(標準的な日本語版)
CHOUCHOU = [
    (G4, 1), (E4, 1), (E4, 1), (REST, 1),
    (F4, 1), (D4, 1), (D4, 1), (REST, 1),
    (C4, 1), (D4, 1), (E4, 1), (F4, 1), (G4, 1), (G4, 1), (G4, 1), (REST, 1),
    (G4, 1), (E4, 1), (E4, 1), (E4, 1),
    (F4, 1), (D4, 1), (D4, 1), (D4, 1),
    (C4, 1), (E4, 1), (G4, 1), (G4, 1),
    (E4, 1), (E4, 1), (E4, 2),
]
SCORE += CHOUCHOU
SCORE += [(REST, 1)]

# 2. メリーさんの羊
MARY = [
    (E4, 1), (D4, 1), (C4, 1), (D4, 1), (E4, 1), (E4, 1), (E4, 2),
    (D4, 1), (D4, 1), (D4, 2),
    (E4, 1), (G4, 1), (G4, 2),
    (E4, 1), (D4, 1), (C4, 1), (D4, 1), (E4, 1), (E4, 1), (E4, 1), (E4, 1),
    (D4, 1), (D4, 1), (E4, 1), (D4, 1), (C4, 2),
]
SCORE += MARY
SCORE += [(REST, 1)]

# 3. 聖者の行進
SAINTS = [
    (C4, 1), (E4, 1), (F4, 1), (G4, 2),
    (C4, 1), (E4, 1), (F4, 1), (G4, 2),
    (C4, 1), (E4, 1), (F4, 1), (G4, 1), (E4, 1), (C4, 1), (E4, 1), (D4, 2),
    (E4, 1), (E4, 1), (D4, 1), (C4, 2),
    (C4, 1), (E4, 1), (G4, 1), (G4, 1), (F4, 2),
    (E4, 1), (F4, 1), (G4, 1), (E4, 1), (C4, 1), (D4, 1), (C4, 2),
]
SCORE += SAINTS


def main():
    mf = mido.MidiFile(ticks_per_beat=TICKS_PER_BEAT)
    track = mido.MidiTrack()
    mf.tracks.append(track)
    track.append(mido.MetaMessage("set_tempo", tempo=TEMPO_US_PER_BEAT, time=0))

    pending_delay = 0
    for note, beats in SCORE:
        beat_ticks = int(beats * TICKS_PER_BEAT)
        if note is REST:
            pending_delay += beat_ticks
            continue
        gate_ticks = int(beat_ticks * GATE)
        track.append(mido.Message("note_on", note=note, velocity=VELOCITY, time=pending_delay))
        track.append(mido.Message("note_off", note=note, velocity=0, time=gate_ticks))
        pending_delay = beat_ticks - gate_ticks

    out = Path(__file__).parent / "source_midi" / "practice_folk_lv2.mid"
    out.parent.mkdir(parents=True, exist_ok=True)
    mf.save(str(out))
    note_count = sum(1 for n, _ in SCORE if n is not REST)
    print(f"生成完了: {out}")
    print(f"  音符数: {note_count} / テンポ: 四分音符={60_000_000 // TEMPO_US_PER_BEAT}")


if __name__ == "__main__":
    main()
