# Keynata

**Your keyboard is the piano. Your typing is the tempo.**

Keynata turns a normal computer keyboard into a piano. Every key is mapped to a
fixed pitch, and the score tells you which keys come next; how fast you play,
how long you hold each note, and where you breathe are entirely yours. There is
no metronome and no fixed timeline: the guide follows your tempo instead of the
other way around, and a note sounds for exactly as long as you hold the key. The
result is closer to playing an instrument than to a typing test, which is why
the repertoire is real piano music rather than word lists.

[Japanese version of this document / 日本語版はこちら](README.ja.md)

## Play

Online: the site is published with GitHub Pages. (The URL is added here once the
repository is published.)

Locally, a static file server is all you need. Opening `index.html` through
`file://` does not work, because the song data is loaded with `fetch`.

```bash
git clone https://github.com/carf-coder/keynata.git
cd keynata
python3 -m http.server 8000
# then open http://localhost:8000
```

Requirements: a desktop browser with Web Audio and a physical keyboard. Phones
and tablets can display the app but cannot play it.

## How to play

1. Press **Play**. Browsers only allow audio after a user gesture, so this first
   click is what wakes up the sound.
2. A short intro puts four notes in front of you with no explanation, no
   settings and no score. Play them, and you have already performed.
3. Choose a piece from the list. Levels run from 1 (a five-note scale) to 7
   (Chopin's Fantaisie-Impromptu).
4. The blue outline is the key to press next. Chords are shown as several keys
   at once and require holding them together.
5. Hold a key and the note sustains; release it and the note stops. Release
   early for staccato, late for legato. Nothing scores you for it.
6. Every mapped key sounds when pressed, right or wrong. Only the correct key
   advances the score.

Settings (assist level, tempo reference, chord reduction) and the full
explanation are collapsed by default. The language switch in the top right
toggles English and Japanese without interrupting a performance.

## What makes it different

- **No quantisation.** The piece stores relative durations and onset gaps, not
  absolute times. Your playing supplies the clock.
- **Articulation from key release.** Note length comes from the actual
  keydown-to-keyup interval, so phrasing, staccato and legato are real
  properties of your performance rather than presets.
- **A tempo estimate that follows you.** A moving average over the last few
  intervals estimates the current beat length, and the piano-roll guide moves at
  that speed. Slow down and the guide slows with you.
- **Physical key positions.** Mapping uses `KeyboardEvent.code`, so QWERTY,
  AZERTY and QWERTZ layouts all play the same physical keys.
- **Static and small.** Plain HTML, CSS and JavaScript with no framework and no
  build step for development. The published build is roughly 3 MB in total.
- **No tracking.** No analytics, no ads, no accounts, no server. Preferences are
  kept in `localStorage` only.

## Repertoire

47 pieces, all public domain or CC0: 37 human-written pieces (table below) plus
10 AI-composed pieces from Keynata Commons (see the next section). Classical pieces come from the
[Mutopia Project](https://www.mutopiaproject.org/), taken only from piece pages
whose `Copyright:` line reads `Public Domain`; CC-BY-SA engravings were rejected
even when the same composer was available elsewhere. Folk pieces and practice
drills are original arrangements of traditional melodies, released as CC0.

Notes outside the playable range (C3-G#6) are shifted by an octave, and chords
larger than six notes are thinned; both are recorded per piece in the
`octaveAdjustedNotes` and `droppedNotes` fields of the song JSON.

| Lv | Piece | Source | License | Events |
|---|---|---|---|---|
| 1 | First steps (C major scale & Twinkle Twinkle) | `tools/make_practice_song.py` | CC0 | 79 |
| 1 | Au clair de la lune (France, traditional) | `tools/make_world_folk.py` | CC0 | 44 |
| 1 | Sakura Sakura (Japan, traditional) | `tools/make_world_folk.py` | CC0 | 50 |
| 2 | Folk medley (Butterfly, Mary Had a Little Lamb, When the Saints) | `tools/make_practice_song_lv2.py` | CC0 | 86 |
| 2 | Mo Li Hua, Jasmine Flower (China, traditional) | `tools/make_world_folk.py` | CC0 | 67 |
| 2 | Amazing Grace (New Britain tune, traditional) | `tools/make_world_folk.py` | CC0 | 70 |
| 2 | O Tannenbaum (Germany, traditional) | `tools/make_world_folk.py` | CC0 | 92 |
| 2 | Auld Lang Syne (Scotland, traditional) | `tools/make_world_folk.py` | CC0 | 112 |
| 3 | Black keys and chords: a first drill | `tools/make_practice_song_lv3.py` | CC0 | 33 |
| 3 | Beethoven - Ode to Joy (from Symphony No. 9) | `tools/make_ode_to_joy.py` | CC0 | 124 |
| 3 | Arirang (Korea, traditional) | `tools/make_world_folk.py` | CC0 | 118 |
| 3 | La Cucaracha (Mexico, traditional) | `tools/make_world_folk.py` | CC0 | 68 |
| 3 | Shchedryk (Ukraine, traditional) | `tools/make_world_folk.py` | CC0 | 70 |
| 3 | Londonderry Air (Ireland, traditional) | `tools/make_world_folk.py` | CC0 | 92 |
| 3 | Tchaikovsky - Old French Song (Album for the Young) | [Mutopia #2080](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=2080) | Public domain | 115 |
| 4 | Satie - Gymnopedie No. 1 | [Mutopia #37](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=37) | Public domain / CC0 | 112 |
| 4 | Satie - Gymnopedie No. 2 | [Mutopia #38](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=38) | Public domain | 147 |
| 4 | Satie - Gymnopedie No. 3 | [Mutopia #39](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=39) | Public domain | 142 |
| 4 | Tchaikovsky - Morning Prayer (Album for the Young) | [Mutopia #2032](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=2032) | Public domain | 95 |
| 4 | Chopin - Prelude Op. 28 No. 7 | [Mutopia #470](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=470) | Public domain | 49 |
| 4 | Chopin - Prelude Op. 28 No. 20 | [Mutopia #472](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=472) | Public domain | 61 |
| 4 | Bach - Polonaise in F major | [Mutopia #1013](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1013) | Public domain | 146 |
| 4 | Schumann - Traumerei (Scenes from Childhood) | [Mutopia #504](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=504) | Public domain | 166 |
| 4 | Mozart - Sonata K. 331, theme of the 1st movement | [Mutopia #614](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=614) | Public domain | 180 |
| 4 | Tchaikovsky - March of the Wooden Soldiers (Album for the Young) | [Mutopia #1806](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1806) | Public domain | 144 |
| 5 | Bach - Prelude in C, BWV 846 | [Mutopia #5](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=5) | Public domain / CC0 | 545 |
| 5 | Chopin - Prelude Op. 28 No. 4 | [Mutopia #468](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=468) | Public domain | 191 |
| 5 | Beethoven - Minuet in E flat, WoO 82 | [Mutopia #904](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=904) | Public domain | 512 |
| 5 | Bach - Invention No. 8, BWV 779 | [Mutopia #61](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=61) | Public domain | 373 |
| 5 | Schubert - Moment Musical No. 3, D. 780 | [Mutopia #1023](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1023) | Public domain | 427 |
| 6 | Beethoven - Fur Elise | [Mutopia #931](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=931) | Public domain / CC0 | 663 |
| 6 | Beethoven - Sonata No. 8 Pathetique, 2nd mvt | [Mutopia #295](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=295) | Public domain | 730 |
| 6 | Joplin - The Entertainer | [Mutopia #263](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=263) | Public domain | 972 |
| 6 | Joplin - Maple Leaf Rag | [Mutopia #23](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=23) | Public domain | 1005 |
| 7 | Debussy - Clair de Lune | [Mutopia #1778](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1778) | Public domain / CC0 | 763 |
| 7 | Chopin - Waltz Op. 64 No. 1, Minute Waltz | [Mutopia #483](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=483) | Public domain | 734 |
| 7 | Chopin - Fantaisie-Impromptu Op. 66 | [Mutopia #1693](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1693) | Public domain | 2519 |

### AI Composed (Keynata Commons)

Ten of the 47 pieces are machine-composed and listed under their own
**AI Composed (Keynata Commons)** group in the piece selector, never mixed in
with the human repertoire. They come from
[Keynata Commons](https://carf-coder.github.io/keynata-commons/), a library of
CC0 pieces written by a rule-based generator: the engine builds a harmonic plan
(cadences, modulations and form such as AB, ABA or rondo) and then writes melody
and accompaniment against classical voice-leading constraints - it is not a
neural model trained on other people's recordings.

Every published track is screened for similarity against the reference corpus
before it enters Commons, and only tracks that are already published there can
be converted for Keynata, so nothing reaches the game without passing that gate.
The converted scores are additionally checked against fixed playability gates
(chord size, note density, length, octave-shift rate, licence wording) measured
from the existing 37 pieces.

Each piece is released as `CC0 (Keynata Commons, AI-generated)`. The song JSON
records its origin in `commonsTrackId` and in `sourceUrl`, which links back to
the Commons page for that track.

| Lv | Piece | Commons track | License | Events |
|---|---|---|---|---|
| 3 | AI Composed No. 12201 | [karaoke_12201](https://carf-coder.github.io/keynata-commons/#karaoke_12201) | CC0 | 508 |
| 3 | AI Composed No. 12280 | [karaoke_12280](https://carf-coder.github.io/keynata-commons/#karaoke_12280) | CC0 | 524 |
| 3 | AI Composed No. 12627 | [karaoke_12627](https://carf-coder.github.io/keynata-commons/#karaoke_12627) | CC0 | 501 |
| 3 | AI Composed No. 12737 | [karaoke_12737](https://carf-coder.github.io/keynata-commons/#karaoke_12737) | CC0 | 433 |
| 4 | AI Composed No. 4104 | [classical_piano_4104](https://carf-coder.github.io/keynata-commons/#classical_piano_4104) | CC0 | 138 |
| 4 | AI Composed No. 4138 | [classical_piano_4138](https://carf-coder.github.io/keynata-commons/#classical_piano_4138) | CC0 | 124 |
| 4 | AI Composed No. 5306 | [classical_piano_5306](https://carf-coder.github.io/keynata-commons/#classical_piano_5306) | CC0 | 56 |
| 5 | AI Composed No. 4001 | [classical_piano_4001](https://carf-coder.github.io/keynata-commons/#classical_piano_4001) | CC0 | 201 |
| 5 | AI Composed No. 5702 | [classical_piano_5702](https://carf-coder.github.io/keynata-commons/#classical_piano_5702) | CC0 | 406 |
| 5 | AI Composed No. 5901 | [classical_piano_5901](https://carf-coder.github.io/keynata-commons/#classical_piano_5901) | CC0 | 442 |

The four `karaoke_*` tracks are single-line melodies (one key at a time, with a
rest every two bars); the six `classical_piano_*` tracks are two-voice piano
pieces of the same kind as the existing repertoire.

## Credits

Piano samples: **Salamander Grand Piano** by Alexander Holm, licensed
[CC-BY 3.0](https://creativecommons.org/licenses/by/3.0/), taken from the mp3
build distributed with Tone.js. Seventeen samples at minor-third spacing cover
C3-C7 and are pitch-shifted for the rest of the range. The attribution is shown
in the footer of the application and must stay there in any redistribution. If
the samples fail to load, the app falls back to oscillator synthesis.

## Repository layout

```
index.html            entry point
i18n.js               en/ja string table and language resolution
app.js                key handling, audio, progression, song list
style.css             styling
songs/*.json          preprocessed song data (generated)
samples/*.mp3         Salamander Grand Piano samples
tools/
  preprocess_midi.py        MIDI to song JSON
  make_world_folk.py        original folk arrangements (CC0)
  make_practice_song*.py    original practice scores
  make_ode_to_joy.py        original arrangement of Ode to Joy
  build_site.py             public build into dist/
  source_midi/              source MIDI files
.github/workflows/pages.yml build and deploy to GitHub Pages
```

## Building the published site

```bash
python3 tools/build_site.py     # standard library only, no dependencies
```

The build writes `dist/` and runs five validation gates. If any gate fails the
script exits non-zero and removes `dist/`, so a failing build cannot be
deployed:

1. **No private songs.** Output paths and file contents are scanned for
   `songs_private` / `source_midi_private` and for every song id registered in
   `songs_private/index.json`. Exactly two known lines of `app.js` are
   allowlisted; anything else is a failure.
2. **Licenses.** Every `dist/songs/*.json` license must state public domain or
   CC0 and must not contain CC-BY, ShareAlike or NonCommercial terms. (The
   CC-BY audio credit lives in the UI text, not in song data.)
3. **No emoji** anywhere in the output.
4. **Reference integrity.** Local assets referenced by `index.html` exist, and
   every song file listed in `SONG_LIST` exists in `dist/songs/`.
5. **Summary.** Piece count, sizes and the reduction achieved by minification.

Song JSON is re-emitted without whitespace and verified to re-parse to a value
identical to the source, which currently removes about 52% of the song payload
(3.9 MB to 1.9 MB). The repository keeps the readable, indented originals.

Pushing to `main` runs `.github/workflows/pages.yml`, which performs the same
build and publishes `dist/` to GitHub Pages.

## Regenerating song data

```bash
python3 -m venv venv
./venv/bin/pip install mido

./venv/bin/python tools/preprocess_midi.py \
  tools/source_midi/bwv846_prelude1_mutopia.mid \
  songs/bwv846.json \
  --title "Prelude in C major, BWV 846" \
  --composer "Johann Sebastian Bach" \
  --source-url "https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=5" \
  --license "Public Domain / CC0 (Mutopia Project)"
```

The converter stops with an error if a chord exceeds six simultaneous notes or
if a note cannot be brought into the C3-G#6 range by octave shifting.

## Private songs (local only, never published)

`songs_private/` exists so that the author can practise copyrighted music under
the private-use exception of Japanese copyright law. It is listed in
`.gitignore`, it is never committed, and the public build fails loudly if
anything from it reaches the output. Nothing in that directory is distributed,
and none of it is part of this repository.

## Contributing

Bug reports and playability feedback are welcome. For new pieces, only public
domain or CC0 material can be accepted: CC-BY, CC-BY-SA and NonCommercial
sources are out of scope, because the obligations they carry do not belong in a
freely redistributable repository. Please include the source page showing the
licence, and generate the JSON with `tools/preprocess_midi.py` rather than by
hand.

## Development note

This project is built in collaboration with an AI coding agent (Claude Code);
the design decisions and the verification are the author's.

## Licence

Code: MIT, see [LICENSE](LICENSE). Song data: public domain or CC0, per the
table above. Piano samples: CC-BY 3.0, attribution required.

## Known limitations

- Keyboard input and audio are verified by hand in a browser; there is no
  automated test for them.
- Mobile devices can load the page but cannot play it.
- One piece ends on a chord that asks for the same physical key twice, a
  side effect of octave correction.
