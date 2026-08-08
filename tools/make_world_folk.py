#!/usr/bin/env python3
"""世界の民謡の自作編曲MIDI生成スクリプト(SPEC_SONGS_INTRO WP2)

北極星「世界中の多くの人に遊んでもらう」に直結する枠。西洋クラシックだけでなく
各国の旋律を入口として置く。

権利について:
- ここに置いた旋律はいずれも作曲者不詳の伝承曲、または著作権保護期間が満了した
  19世紀以前の曲で、旋律そのものはパブリックドメイン。
- 音の並び(ピッチと音価)は事実であり、著作物ではない。ここでの編曲(調・音域・
  反復構成・3度下のハモリの付け方)はすべて自作なのでCC0として扱う。
- したがって各曲JSONの license は
  "CC0 (own arrangement; the melody is in the public domain)" とする。

旋律の確認方法(各曲の melodySource に記録):
- LilyPond ソースまたは楽譜画像から音高・音価を1音ずつ読み取って書き起こした。
- 参照先URLは各曲の定義に併記する。参照したのは「PDの旋律が実際にどの音か」の
  確認のみで、伴奏・和声・体裁は取り込んでいない。

使い方:
    ./venv/bin/python tools/make_world_folk.py
    (tools/source_midi/ に <id>.mid を書き出す。JSON化は preprocess_midi.py で行う)
"""

from pathlib import Path

import mido

TICKS_PER_BEAT = 480
VELOCITY = 78
GATE = 0.9

REST = None

# --- 音名ヘルパー -----------------------------------------------------------
# C4 = 60(中央ハ)。preprocess_midi.py の音域は C3(48)〜G#6(92)。
NOTE_BASE = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}


def n(name: str) -> int:
    """'A4' 'Bb4' 'F#5' 形式の音名をMIDIノート番号へ。"""
    letter = name[0].upper()
    i = 1
    accidental = 0
    while i < len(name) and name[i] in "#b":
        accidental += 1 if name[i] == "#" else -1
        i += 1
    octave = int(name[i:])
    return (octave + 1) * 12 + NOTE_BASE[letter] + accidental


def scale_pitches(pitch_classes):
    """与えたピッチクラス集合に属する全音高(0〜127)を昇順で返す。"""
    return [p for p in range(0, 128) if p % 12 in pitch_classes]


def third_below(melody, pitch_classes, min_beats=1.0, floor_note=48):
    """音価が min_beats 以上の音に、その調の音階上で2度下(=3度下)の音を重ねる。
    2音和音までに収める。音階外の音・低すぎる音はハモらせない(単音のまま)。"""
    table = scale_pitches(pitch_classes)
    index = {p: i for i, p in enumerate(table)}
    out = []
    for entry, beats in melody:
        if entry is REST or isinstance(entry, list) or beats < min_beats or entry not in index:
            out.append((entry, beats))
            continue
        i = index[entry] - 2
        low = table[i] if i >= 0 else None
        if low is None or low < floor_note:
            out.append((entry, beats))
        else:
            out.append(([low, entry], beats))
    return out


# --- 旋律 -------------------------------------------------------------------

MAJOR = {0, 2, 4, 5, 7, 9, 11}


def pcs(root_name, quality=MAJOR):
    root = n(root_name + "4") % 12
    return {(root + iv) % 12 for iv in quality}


# 1) さくらさくら(日本・伝承)
# 旋律確認: Wikimedia Commons "Sakura.song.png"(古歌 Traditional の五線譜)を
# 1音ずつ読み取り。https://commons.wikimedia.org/wiki/File:Sakura.song.png
SAKURA = [
    (n("A4"), 1), (n("A4"), 1), (n("B4"), 2),
    (n("A4"), 1), (n("A4"), 1), (n("B4"), 2),
    (n("A4"), 1), (n("B4"), 1), (n("C5"), 1), (n("B4"), 1),
    (n("A4"), 1), (n("B4"), 0.5), (n("A4"), 0.5), (n("F4"), 2),
    (n("E4"), 1), (n("C4"), 1), (n("E4"), 1), (n("F4"), 1),
    (n("E4"), 1), (n("E4"), 0.5), (n("C4"), 0.5), (n("C4"), 2),
    (n("A4"), 1), (n("B4"), 1), (n("C5"), 1), (n("B4"), 1),
    (n("A4"), 1), (n("B4"), 0.5), (n("A4"), 0.5), (n("F4"), 2),
    (n("E4"), 1), (n("C4"), 1), (n("E4"), 1), (n("F4"), 1),
    (n("E4"), 1), (n("E4"), 0.5), (n("C4"), 0.5), (n("C4"), 2),
    (n("A4"), 1), (n("A4"), 1), (n("B4"), 2),
    (n("A4"), 1), (n("A4"), 1), (n("B4"), 2),
    (n("E4"), 1), (n("F4"), 1), (n("B4"), 0.5), (n("A4"), 0.5), (n("F4"), 1),
    (n("E4"), 2),
]

# 2) Au clair de la lune(フランス・伝承)
# 旋律確認: fr.wikipedia "Au clair de la lune" の LilyPond スコア。
AU_CLAIR = [
    (n("C5"), 1), (n("C5"), 1), (n("C5"), 1), (n("D5"), 1), (n("E5"), 2), (n("D5"), 2),
    (n("C5"), 1), (n("E5"), 1), (n("D5"), 1), (n("D5"), 1), (n("C5"), 4),
    (n("C5"), 1), (n("C5"), 1), (n("C5"), 1), (n("D5"), 1), (n("E5"), 2), (n("D5"), 2),
    (n("C5"), 1), (n("E5"), 1), (n("D5"), 1), (n("D5"), 1), (n("C5"), 4),
    (n("D5"), 1), (n("D5"), 1), (n("D5"), 1), (n("D5"), 1), (n("A4"), 2), (n("A4"), 2),
    (n("D5"), 1), (n("C5"), 1), (n("B4"), 1), (n("A4"), 1), (n("G4"), 4),
    (n("C5"), 1), (n("C5"), 1), (n("C5"), 1), (n("D5"), 1), (n("E5"), 2), (n("D5"), 2),
    (n("C5"), 1), (n("E5"), 1), (n("D5"), 1), (n("D5"), 1), (n("C5"), 4),
]

# 3) Amazing Grace(アメリカ・New Britain の旋律、1835年刊。伝承)
# 旋律確認: en.wikipedia "Amazing Grace" の LilyPond スコア(旋律声部のみ)。
AMAZING_GRACE = [
    (n("D4"), 1),
    (n("G4"), 2), (n("B4"), 0.5), (n("G4"), 0.5),
    (n("B4"), 2), (n("A4"), 1),
    (n("G4"), 2), (n("E4"), 1),
    (n("D4"), 2), (n("D4"), 1),
    (n("G4"), 2), (n("B4"), 0.5), (n("G4"), 0.5),
    (n("B4"), 2), (n("A4"), 1),
    (n("D5"), 2), (n("B4"), 1),
    (n("D5"), 1.5), (n("B4"), 0.5), (n("D5"), 0.5), (n("B4"), 0.5),
    (n("G4"), 2), (n("D4"), 1),
    (n("E4"), 1.5), (n("G4"), 0.5), (n("G4"), 0.5), (n("E4"), 0.5),
    (n("D4"), 2), (n("D4"), 1),
    (n("G4"), 2), (n("B4"), 0.5), (n("G4"), 0.5),
    (n("B4"), 2), (n("A4"), 1),
    (n("G4"), 3),
]

# 4) 茉莉花 Mo Li Hua(中国・伝承)
# 旋律確認: en.wikipedia "Mo Li Hua" の LilyPond スコア。
MO_LI_HUA_A = [
    (n("E4"), 1), (n("E4"), 0.5), (n("G4"), 0.5), (n("A4"), 0.5), (n("C5"), 0.5),
    (n("C5"), 0.5), (n("A4"), 0.5),
    (n("G4"), 1), (n("G4"), 0.5), (n("A4"), 0.5), (n("G4"), 1), (REST, 1),
]
MO_LI_HUA_B = [
    (n("G4"), 1), (n("G4"), 1), (n("G4"), 1), (n("E4"), 0.5), (n("G4"), 0.5),
    (n("A4"), 1), (n("A4"), 1), (n("G4"), 2),
    (n("E4"), 1), (n("D4"), 0.5), (n("E4"), 0.5), (n("G4"), 1), (n("E4"), 0.5), (n("D4"), 0.5),
    (n("C4"), 1), (n("C4"), 0.5), (n("D4"), 0.5), (n("C4"), 2),
    (n("E4"), 0.5), (n("D4"), 0.5), (n("C4"), 0.5), (n("E4"), 0.5), (n("D4"), 1.5), (n("E4"), 0.5),
    (n("G4"), 1), (n("A4"), 0.5), (n("C5"), 0.5), (n("G4"), 2),
    (n("D4"), 1), (n("E4"), 0.5), (n("G4"), 0.5), (n("D4"), 0.5), (n("E4"), 0.5),
    (n("C4"), 0.5), (n("A3"), 0.5),
    (n("G3"), 2), (n("A3"), 1), (n("C4"), 1),
    (n("D4"), 1.5), (n("E4"), 0.5), (n("C4"), 0.5), (n("D4"), 0.5), (n("C4"), 0.5), (n("A3"), 0.5),
    (n("G3"), 2), (REST, 2),
]
MO_LI_HUA = MO_LI_HUA_A + MO_LI_HUA_A + MO_LI_HUA_B

# 5) 아리랑 Arirang(韓国・伝承)
# 旋律確認: en.wikipedia "Arirang" の LilyPond スコア(9/8, F major)。
AR_M2 = [(n("F4"), 2.5), (n("G4"), 0.5), (n("F4"), 1), (n("G4"), 0.5)]
AR_M4 = [(n("C4"), 2.5), (n("D4"), 0.5), (n("C4"), 0.5), (n("D4"), 0.5), (REST, 0.5)]
AR_M6 = [(n("A4"), 1), (n("G4"), 0.5), (n("F4"), 1), (n("D4"), 0.5), (n("C4"), 1), (n("D4"), 0.5)]
AR_M7 = [(n("F4"), 2.5), (n("G4"), 0.5), (n("F4"), 1.5)]
AR_M8 = [(n("F4"), 3), (REST, 1.5)]
ARIRANG = (
    [(n("C4"), 2.5), (n("D4"), 0.5), (n("C4"), 1), (n("D4"), 0.5)]
    + AR_M2
    + [(n("A4"), 1.5), (n("G4"), 0.5), (n("A4"), 0.5), (n("G4"), 0.5), (n("F4"), 1), (n("D4"), 0.5)]
    + AR_M4
    + AR_M2 + AR_M6 + AR_M7 + AR_M8
    + [(n("C5"), 4.5)]
    + [(n("C5"), 1.5), (n("A4"), 1.5), (n("G4"), 1.5)]
    + [(n("A4"), 1.5), (n("G4"), 1), (n("A4"), 0.5), (n("F4"), 1), (n("D4"), 0.5)]
    + AR_M4
    + AR_M2 + AR_M6 + AR_M7 + AR_M8
)

# 6) Auld Lang Syne(スコットランド・伝承)
# 旋律確認: en.wikipedia "Auld Lang Syne" の LilyPond スコア(F major)。
AULD_LANG_SYNE = [
    (n("C4"), 1),
    (n("F4"), 1.5), (n("F4"), 0.5), (n("F4"), 1), (n("A4"), 1),
    (n("G4"), 1.5), (n("F4"), 0.5), (n("G4"), 1), (n("A4"), 1),
    (n("F4"), 1.5), (n("F4"), 0.5), (n("A4"), 1), (n("C5"), 1),
    (n("D5"), 3), (n("D5"), 1),
    (n("C5"), 1.5), (n("A4"), 0.5), (n("A4"), 1), (n("F4"), 1),
    (n("G4"), 1.5), (n("F4"), 0.5), (n("G4"), 1), (n("A4"), 1),
    (n("F4"), 1.5), (n("D4"), 0.5), (n("D4"), 1), (n("C4"), 1),
    (n("F4"), 3), (n("D5"), 1),
    (n("C5"), 1.5), (n("A4"), 0.5), (n("A4"), 1), (n("F4"), 1),
    (n("G4"), 1.5), (n("F4"), 0.5), (n("G4"), 1), (n("D5"), 1),
    (n("C5"), 1.5), (n("A4"), 0.5), (n("A4"), 1), (n("C5"), 1),
    (n("D5"), 3), (n("D5"), 1),
    (n("C5"), 1.5), (n("A4"), 0.5), (n("A4"), 1), (n("F4"), 1),
    (n("G4"), 1.5), (n("F4"), 0.5), (n("G4"), 1), (n("A4"), 1),
    (n("F4"), 1.5), (n("D4"), 0.5), (n("D4"), 1), (n("C4"), 1),
    (n("F4"), 3),
]

# 7) O Tannenbaum(ドイツ・伝承)
# 旋律確認: en.wikipedia "O Tannenbaum" の LilyPond スコア(G major, 3/4)。
TANNENBAUM_A = [
    (n("D4"), 0.5),
    (n("G4"), 0.75), (n("G4"), 0.25), (n("G4"), 1), (n("A4"), 1),
    (n("B4"), 0.75), (n("B4"), 0.25), (n("B4"), 1.5), (n("B4"), 0.5),
    (n("A4"), 0.5), (n("B4"), 0.5), (n("C5"), 1), (n("F#4"), 1),
    (n("A4"), 1), (n("G4"), 1), (REST, 0.5),
]
TANNENBAUM_B = [
    (n("D5"), 0.5),
    (n("D5"), 0.5), (n("B4"), 0.5), (n("E5"), 1.5), (n("D5"), 0.5),
    (n("D5"), 0.5), (n("C5"), 0.5), (n("C5"), 1.5), (n("C5"), 0.5),
    (n("C5"), 0.5), (n("A4"), 0.5), (n("D5"), 1.5), (n("C5"), 0.5),
    (n("C5"), 0.5), (n("B4"), 0.5), (n("B4"), 1), (REST, 0.5),
]
O_TANNENBAUM = TANNENBAUM_A + TANNENBAUM_B + TANNENBAUM_A

# 8) La Cucaracha(メキシコ・伝承)
# 旋律確認: es.wikipedia "La cucaracha" の LilyPond スコア(C major)。
CUCARACHA_A = [
    (n("G4"), 0.5), (n("G4"), 0.5), (n("G4"), 0.5),
    (n("C5"), 1.5), (n("E5"), 1), (n("G4"), 0.5), (n("G4"), 0.5), (n("G4"), 0.5),
    (n("C5"), 1.5), (n("E5"), 2.5),
    (REST, 1), (n("C5"), 0.5), (n("C5"), 0.5), (n("B4"), 0.5), (n("B4"), 0.5),
    (n("A4"), 0.5), (n("A4"), 0.5),
    (n("G4"), 2.5), (n("G4"), 0.5), (n("G4"), 0.5), (n("G4"), 0.5),
    (n("B4"), 1.5), (n("D5"), 1), (n("G4"), 0.5), (n("G4"), 0.5), (n("G4"), 0.5),
    (n("B4"), 1.5), (n("D5"), 2.5),
    (REST, 1), (n("G4"), 0.5), (n("A4"), 0.5), (n("G4"), 0.5), (n("F4"), 0.5),
    (n("E4"), 0.5), (n("D4"), 0.5),
    (n("C4"), 2),
]
LA_CUCARACHA = CUCARACHA_A

# 9) Щедрик Shchedryk(ウクライナ・伝承。レオントヴィチ編、1921年没=保護期間満了)
# 旋律確認: en.wikipedia "Shchedryk (song)" の LilyPond スコア(soprano声部)。
SHCH_OSTINATO = [(n("Bb4"), 1), (n("A4"), 0.5), (n("Bb4"), 0.5), (n("G4"), 1)]
SHCH_SECOND = [(n("D5"), 1), (n("C5"), 0.5), (n("D5"), 0.5), (n("Bb4"), 1)]
SHCHEDRYK = (
    SHCH_OSTINATO * 4
    + SHCH_SECOND * 2
    + [(n("G5"), 1), (n("G5"), 0.5), (n("G5"), 0.5), (n("F5"), 0.5), (n("Eb5"), 0.5)]
    + [(n("D5"), 1), (n("D5"), 0.5), (n("D5"), 0.5), (n("C5"), 0.5), (n("Bb4"), 0.5)]
    + [(n("C5"), 1), (n("C5"), 0.5), (n("C5"), 0.5), (n("D5"), 0.5), (n("C5"), 0.5)]
    + [(n("G4"), 1), (n("G4"), 0.5), (n("G4"), 0.5), (n("G4"), 1)]
    + [(n("D4"), 0.5), (n("E4"), 0.5), (n("F#4"), 0.5), (n("G4"), 0.5), (n("A4"), 0.5), (n("Bb4"), 0.5)]
    + [(n("C5"), 0.5), (n("D5"), 0.5), (n("C5"), 1), (n("Bb4"), 1)]
    + SHCH_OSTINATO * 4
    + [(n("G4"), 3)]
)

# 10) Londonderry Air(アイルランド・伝承)
# 旋律確認: en.wikipedia "Londonderry Air" の LilyPond スコア(Es-dur)。
LD_M1 = [(n("G4"), 1.5), (n("F4"), 0.5), (n("G4"), 0.5), (n("C5"), 0.5), (n("Bb4"), 0.5), (n("G4"), 0.5)]
LONDONDERRY = (
    [(n("D4"), 0.5), (n("Eb4"), 0.5), (n("F4"), 0.5)]
    + LD_M1
    + [(n("F4"), 0.5), (n("Eb4"), 0.5), (n("C4"), 1), (REST, 0.5), (n("Eb4"), 0.5), (n("G4"), 0.5), (n("Ab4"), 0.5)]
    + [(n("Bb4"), 1.5), (n("C5"), 0.5), (n("Bb4"), 0.5), (n("G4"), 0.5), (n("Eb4"), 0.5), (n("G4"), 0.5)]
    + [(n("F4"), 2), (REST, 0.5), (n("D4"), 0.5), (n("Eb4"), 0.5), (n("F4"), 0.5)]
    + LD_M1
    + [(n("F4"), 0.5), (n("Eb4"), 0.5), (n("C4"), 0.5), (n("B3"), 0.5), (n("C4"), 0.5), (n("D4"), 0.5), (n("Eb4"), 0.5), (n("F4"), 0.5)]
    + [(n("G4"), 1.5), (n("Ab4"), 0.5), (n("G4"), 0.5), (n("F4"), 0.5), (n("Eb4"), 0.5), (n("F4"), 0.5)]
    + [(n("Eb4"), 2), (REST, 0.5), (n("Bb4"), 0.5), (n("C5"), 0.5), (n("D5"), 0.5)]
    + [(n("Eb5"), 1.5), (n("D5"), 0.5), (n("D5"), 0.5), (n("C5"), 0.5), (n("Bb4"), 0.5), (n("G4"), 0.5)]
    + [(n("Bb4"), 0.5), (n("G4"), 0.5), (n("Eb4"), 1), (REST, 0.5), (n("Bb4"), 0.5), (n("C5"), 0.5), (n("D5"), 0.5)]
    + [(n("Eb5"), 1.5), (n("D5"), 0.5), (n("D5"), 0.5), (n("C5"), 0.5), (n("Bb4"), 0.5), (n("G4"), 0.5)]
    + [(n("F4"), 2), (REST, 0.5), (n("Bb4"), 0.5), (n("Bb4"), 0.5), (n("Bb4"), 0.5)]
    + [(n("G5"), 1.5), (n("F5"), 0.5), (n("F5"), 0.5), (n("Eb5"), 0.5), (n("C5"), 0.5), (n("Eb5"), 0.5)]
    + [(n("Bb4"), 0.5), (n("G4"), 0.5), (n("Eb4"), 1), (REST, 0.5), (n("D4"), 0.5), (n("Eb4"), 0.5), (n("F4"), 0.5)]
    + [(n("G4"), 0.5), (n("C5"), 0.5), (n("Bb4"), 0.5), (n("G4"), 0.5), (n("F4"), 0.5), (n("Eb4"), 0.5), (n("C4"), 0.5), (n("D4"), 0.5)]
    + [(n("Eb4"), 2.5)]
)


# --- 曲定義 -----------------------------------------------------------------
# id, 表示用タイトル(ja), 由来, テンポ(四分音符BPM), 旋律, 反復時のハモリ用音階
SONGS = [
    {
        "id": "folk_sakura",
        "title": "さくらさくら(日本の伝承曲・自作編曲)",
        "composer": "Japanese traditional",
        "melodySource": "https://commons.wikimedia.org/wiki/File:Sakura.song.png",
        "bpm": 88,
        "melody": SAKURA,
        "harmonize": None,
    },
    {
        "id": "folk_au_clair_de_la_lune",
        "title": "Au clair de la lune(フランスの伝承曲・自作編曲)",
        "composer": "French traditional",
        "melodySource": "https://fr.wikipedia.org/wiki/Au_clair_de_la_lune",
        "bpm": 104,
        "melody": AU_CLAIR,
        "harmonize": None,
    },
    {
        "id": "folk_amazing_grace",
        "title": "Amazing Grace(New Britain の伝承旋律・自作編曲)",
        "composer": "American traditional",
        "melodySource": "https://en.wikipedia.org/wiki/Amazing_Grace",
        "bpm": 84,
        "melody": AMAZING_GRACE,
        "harmonize": pcs("G"),
    },
    {
        "id": "folk_mo_li_hua",
        "title": "茉莉花(中国の伝承曲・自作編曲)",
        "composer": "Chinese traditional",
        "melodySource": "https://en.wikipedia.org/wiki/Mo_Li_Hua",
        "bpm": 96,
        "melody": MO_LI_HUA,
        "harmonize": None,
    },
    {
        "id": "folk_arirang",
        "title": "아리랑 アリラン(韓国の伝承曲・自作編曲)",
        "composer": "Korean traditional",
        "melodySource": "https://en.wikipedia.org/wiki/Arirang",
        "bpm": 108,
        "melody": ARIRANG,
        "harmonize": pcs("F"),
    },
    {
        "id": "folk_auld_lang_syne",
        "title": "Auld Lang Syne(スコットランドの伝承曲・自作編曲)",
        "composer": "Scottish traditional",
        "melodySource": "https://en.wikipedia.org/wiki/Auld_Lang_Syne",
        "bpm": 92,
        "melody": AULD_LANG_SYNE,
        "harmonize": pcs("F"),
    },
    {
        "id": "folk_o_tannenbaum",
        "title": "O Tannenbaum(ドイツの伝承曲・自作編曲)",
        "composer": "German traditional",
        "melodySource": "https://en.wikipedia.org/wiki/O_Tannenbaum",
        "bpm": 100,
        "melody": O_TANNENBAUM,
        "harmonize": pcs("G"),
    },
    {
        "id": "folk_la_cucaracha",
        "title": "La Cucaracha(メキシコの伝承曲・自作編曲)",
        "composer": "Mexican traditional",
        "melodySource": "https://es.wikipedia.org/wiki/La_cucaracha",
        "bpm": 120,
        "melody": LA_CUCARACHA,
        "harmonize": pcs("C"),
    },
    {
        "id": "folk_shchedryk",
        "title": "Щедрик シチェドリク(ウクライナの伝承曲・自作編曲)",
        "composer": "Ukrainian traditional",
        "melodySource": "https://en.wikipedia.org/wiki/Shchedryk_(song)",
        "bpm": 132,
        "melody": SHCHEDRYK,
        "harmonize": None,
    },
    {
        "id": "folk_londonderry_air",
        "title": "Londonderry Air(アイルランドの伝承曲・自作編曲)",
        "composer": "Irish traditional",
        "melodySource": "https://en.wikipedia.org/wiki/Londonderry_Air",
        "bpm": 84,
        "melody": LONDONDERRY,
        "harmonize": None,
    },
]


def build_score(song):
    melody = song["melody"]
    score = list(melody)
    if song["harmonize"]:
        score += [(REST, 2)]
        score += third_below(melody, song["harmonize"])
    return score


def write_midi(song, out_dir: Path):
    mf = mido.MidiFile(ticks_per_beat=TICKS_PER_BEAT)
    track = mido.MidiTrack()
    mf.tracks.append(track)
    track.append(mido.MetaMessage("set_tempo", tempo=int(60_000_000 / song["bpm"]), time=0))

    pending_delay = 0
    count = 0
    for entry, beats in build_score(song):
        beat_ticks = int(round(beats * TICKS_PER_BEAT))
        if entry is REST:
            pending_delay += beat_ticks
            continue
        notes = entry if isinstance(entry, list) else [entry]
        gate_ticks = max(1, int(beat_ticks * GATE))
        for i, note in enumerate(notes):
            track.append(mido.Message("note_on", note=note, velocity=VELOCITY,
                                      time=pending_delay if i == 0 else 0))
            pending_delay = 0
        for i, note in enumerate(notes):
            track.append(mido.Message("note_off", note=note, velocity=0,
                                      time=gate_ticks if i == 0 else 0))
        pending_delay = beat_ticks - gate_ticks
        count += 1

    out = out_dir / f"{song['id']}.mid"
    mf.save(str(out))
    return out, count


def main():
    out_dir = Path(__file__).parent / "source_midi"
    out_dir.mkdir(parents=True, exist_ok=True)
    for song in SONGS:
        lo = min(x for e, _ in build_score(song) if e is not REST
                 for x in (e if isinstance(e, list) else [e]))
        hi = max(x for e, _ in build_score(song) if e is not REST
                 for x in (e if isinstance(e, list) else [e]))
        assert 48 <= lo and hi <= 92, f"{song['id']}: 音域外 {lo}-{hi}"
        out, count = write_midi(song, out_dir)
        print(f"{song['id']:<28} events={count:>4} range={lo}-{hi} -> {out.name}")


if __name__ == "__main__":
    main()
