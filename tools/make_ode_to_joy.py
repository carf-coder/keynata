#!/usr/bin/env python3
"""
歓喜の歌(ベートーヴェン第九・第4楽章主題)の自作編曲MIDI生成スクリプト(SPEC.md §19)

旋律はPD(ベートーヴェン)。この編曲(ハ長調・2バース構成)は自作でCC0相当(SPEC.md §8改訂)。
- 1番: 旋律のみ(単音)
- 2番: 旋律+3度下のハモリ(2音和音。八分音符と低いソは単音のまま)
バース間に1拍の休符。

変換:
    ./venv/bin/python tools/make_ode_to_joy.py
    ./venv/bin/python tools/preprocess_midi.py tools/source_midi/ode_to_joy.mid \
        songs/ode_to_joy.json \
        --title "ベートーヴェン 歓喜の歌(第九より・自作編曲)" --composer "Ludwig van Beethoven(旋律)" \
        --source-url "tools/make_ode_to_joy.py" --license "CC0相当(自作編曲・旋律はPD)"
"""

from pathlib import Path

import mido

TICKS_PER_BEAT = 480
TEMPO_US_PER_BEAT = 600000  # 四分音符=100
VELOCITY = 80
GATE = 0.9

G3 = 55
A3, B3 = 57, 59
C4, D4, E4, F4, G4 = 60, 62, 64, 65, 67

REST = None

# 旋律: (音, 拍数)。1.5=付点四分、0.5=八分。
PHRASE1 = [
    (E4, 1), (E4, 1), (F4, 1), (G4, 1), (G4, 1), (F4, 1), (E4, 1), (D4, 1),
    (C4, 1), (C4, 1), (D4, 1), (E4, 1), (E4, 1.5), (D4, 0.5), (D4, 2),
]
PHRASE2 = [
    (E4, 1), (E4, 1), (F4, 1), (G4, 1), (G4, 1), (F4, 1), (E4, 1), (D4, 1),
    (C4, 1), (C4, 1), (D4, 1), (E4, 1), (D4, 1.5), (C4, 0.5), (C4, 2),
]
PHRASE3 = [
    (D4, 1), (D4, 1), (E4, 1), (C4, 1),
    (D4, 1), (E4, 0.5), (F4, 0.5), (E4, 1), (C4, 1),
    (D4, 1), (E4, 0.5), (F4, 0.5), (E4, 1), (D4, 1),
    (C4, 1), (D4, 1), (G3, 2),
]
MELODY = PHRASE1 + PHRASE2 + PHRASE3 + PHRASE2

# 2番用: 3度下のハモリ(ハ長調ダイアトニック)。対象は四分音符以上のC4〜G4のみ。
THIRD_BELOW = {C4: A3, D4: B3, E4: C4, F4: D4, G4: E4}


def harmonized(melody):
    out = []
    for note, beats in melody:
        if beats >= 1 and note in THIRD_BELOW:
            out.append(([THIRD_BELOW[note], note], beats))
        else:
            out.append((note, beats))
    return out


SCORE = [(n, b) for n, b in MELODY]
SCORE += [(REST, 1)]
SCORE += harmonized(MELODY)


def main():
    mf = mido.MidiFile(ticks_per_beat=TICKS_PER_BEAT)
    track = mido.MidiTrack()
    mf.tracks.append(track)
    track.append(mido.MetaMessage("set_tempo", tempo=TEMPO_US_PER_BEAT, time=0))

    pending_delay = 0
    for entry, beats in SCORE:
        beat_ticks = int(beats * TICKS_PER_BEAT)
        if entry is REST:
            pending_delay += beat_ticks
            continue
        notes = entry if isinstance(entry, list) else [entry]
        gate_ticks = int(beat_ticks * GATE)
        for i, note in enumerate(notes):
            track.append(mido.Message("note_on", note=note, velocity=VELOCITY,
                                      time=pending_delay if i == 0 else 0))
            pending_delay = 0
        for i, note in enumerate(notes):
            track.append(mido.Message("note_off", note=note, velocity=0,
                                      time=gate_ticks if i == 0 else 0))
        pending_delay = beat_ticks - gate_ticks

    out = Path(__file__).parent / "source_midi" / "ode_to_joy.mid"
    out.parent.mkdir(parents=True, exist_ok=True)
    mf.save(str(out))
    note_count = sum(1 for e, _ in SCORE if e is not REST)
    print(f"生成完了: {out}")
    print(f"  イベント数(和音含む): {note_count} / テンポ: 四分音符={60_000_000 // TEMPO_US_PER_BEAT}")


if __name__ == "__main__":
    main()
