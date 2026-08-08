#!/usr/bin/env python3
"""
初心者用練習譜面のMIDI生成スクリプト(SPEC.md §18.1)

ハ長調・C4〜C5・単音のみ・四分音符中心の練習譜面を生成する。
段階構成: A.5音の階段 -> B.1オクターブの階段 -> C.アルペジオ -> D.きらきら星
セクション間には1拍の休符を置く。

生成したMIDIは既存の tools/preprocess_midi.py に通してJSON化する:
    ./venv/bin/python tools/make_practice_song.py
    ./venv/bin/python tools/preprocess_midi.py tools/source_midi/practice_beginner.mid \
        songs/practice_beginner.json \
        --title "初心者練習譜面(ドレミときらきら星)" --composer "自作(練習用ドリル)" \
        --source-url "tools/make_practice_song.py" --license "CC0相当(自作・権利なし)"

ライセンス: 自作のためCC0相当(SPEC.md §8改訂に準拠)。きらきら星の旋律はPD民謡。
"""

from pathlib import Path

import mido

TICKS_PER_BEAT = 480
TEMPO_US_PER_BEAT = 800000  # 四分音符=75bpm(初心者向けに遅め)
VELOCITY = 80

# 音名(ハ長調・C4〜C5)
C4, D4, E4, F4, G4, A4, B4, C5 = 60, 62, 64, 65, 67, 69, 71, 72

REST = None  # 休符マーカー

# (MIDIノート or REST, 拍数) のリスト。SPEC §18.1の段階構成。
SCORE = []

# A. 5音の階段(ドレミファソファミレド)
SCORE += [(n, 1) for n in [C4, D4, E4, F4, G4, F4, E4, D4]] + [(C4, 2)]
SCORE += [(REST, 1)]

# B. 1オクターブの階段(ド〜ド往復)
SCORE += [(n, 1) for n in [C4, D4, E4, F4, G4, A4, B4, C5]]
SCORE += [(n, 1) for n in [B4, A4, G4, F4, E4, D4]] + [(C4, 2)]
SCORE += [(REST, 1)]

# C. アルペジオ(ド・ミ・ソ・ド)
SCORE += [(n, 1) for n in [C4, E4, G4, C5, G4, E4]]
SCORE += [(n, 1) for n in [C4, E4, G4, C5, G4, E4]] + [(C4, 2)]
SCORE += [(REST, 1)]

# D. きらきら星(PD民謡)
TWINKLE = [
    (C4, 1), (C4, 1), (G4, 1), (G4, 1), (A4, 1), (A4, 1), (G4, 2),
    (F4, 1), (F4, 1), (E4, 1), (E4, 1), (D4, 1), (D4, 1), (C4, 2),
    (G4, 1), (G4, 1), (F4, 1), (F4, 1), (E4, 1), (E4, 1), (D4, 2),
    (G4, 1), (G4, 1), (F4, 1), (F4, 1), (E4, 1), (E4, 1), (D4, 2),
    (C4, 1), (C4, 1), (G4, 1), (G4, 1), (A4, 1), (A4, 1), (G4, 2),
    (F4, 1), (F4, 1), (E4, 1), (E4, 1), (D4, 1), (D4, 1), (C4, 2),
]
SCORE += TWINKLE

# 発音長は拍の0.9倍(次の音との間にわずかな切れ目を作り、ガイドの読みやすさを優先)
GATE = 0.9


def main():
    mf = mido.MidiFile(ticks_per_beat=TICKS_PER_BEAT)
    track = mido.MidiTrack()
    mf.tracks.append(track)
    track.append(mido.MetaMessage("set_tempo", tempo=TEMPO_US_PER_BEAT, time=0))

    pending_delay = 0  # 次のnote_onまでの待ちtick(休符ぶんを積む)
    for note, beats in SCORE:
        beat_ticks = int(beats * TICKS_PER_BEAT)
        if note is REST:
            pending_delay += beat_ticks
            continue
        gate_ticks = int(beat_ticks * GATE)
        track.append(mido.Message("note_on", note=note, velocity=VELOCITY, time=pending_delay))
        track.append(mido.Message("note_off", note=note, velocity=0, time=gate_ticks))
        pending_delay = beat_ticks - gate_ticks

    out = Path(__file__).parent / "source_midi" / "practice_beginner.mid"
    out.parent.mkdir(parents=True, exist_ok=True)
    mf.save(str(out))
    note_count = sum(1 for n, _ in SCORE if n is not REST)
    print(f"生成完了: {out}")
    print(f"  音符数: {note_count} / テンポ: 四分音符={60_000_000 // TEMPO_US_PER_BEAT}")


if __name__ == "__main__":
    main()
