"use strict";

// ピアノタイピングゲーム v0 演奏モード
// SPEC.md セクション3・6・9・10に準拠。

// --- SPEC §9 キーマッピング -------------------------------------------------
// 4段、各段左から右へ半音上昇。C3(MIDI 48)からG#6(MIDI 92)まで連続クロマチック45鍵。
// 物理キーボード上は下段(Z段)が最低音、上に行くほど高音になる。
// UI表示上は実物のキーボード配置に合わせ、数字段を上、Z段を下に描画する。

const KEY_ROWS = [
  {
    name: "数字段",
    codes: ["Digit1", "Digit2", "Digit3", "Digit4", "Digit5", "Digit6", "Digit7", "Digit8", "Digit9", "Digit0", "Minus", "Equal"],
    labels: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "-", "="],
    range: "A5-G#6",
    color: "#b195e8", // SPEC §14.2 段カラー: 紫
  },
  {
    name: "Q段",
    codes: ["KeyQ", "KeyW", "KeyE", "KeyR", "KeyT", "KeyY", "KeyU", "KeyI", "KeyO", "KeyP", "BracketLeft", "BracketRight"],
    labels: ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P", "[", "]"],
    range: "A4-G#5",
    color: "#6fa8dc", // 青
  },
  {
    name: "A段",
    codes: ["KeyA", "KeyS", "KeyD", "KeyF", "KeyG", "KeyH", "KeyJ", "KeyK", "KeyL", "Semicolon", "Quote"],
    labels: ["A", "S", "D", "F", "G", "H", "J", "K", "L", ";", "'"],
    range: "A#3-G#4",
    color: "#63c193", // 緑
  },
  {
    name: "Z段",
    codes: ["KeyZ", "KeyX", "KeyC", "KeyV", "KeyB", "KeyN", "KeyM", "Comma", "Period", "Slash"],
    labels: ["Z", "X", "C", "V", "B", "N", "M", ",", ".", "/"],
    range: "C3-A3",
    color: "#e0a458", // 橙
  },
];

// キー刻印の表示ラベル補正(SPEC §9: 判定はKeyboardEvent.code=物理位置ベースで
// レイアウト非依存だが、画面に見せる刻印は物理キーキャップに合わせる)。
// 注意した実挙動(2026-07-16):
// - Keyboard Layout Map APIはmacOSのJISキーボードでUS刻印を返すことがある -> 不採用
// - e.keyからの自習補正は、入力ソースがUS(ABC)のとき物理キーキャップと逆方向に
//   書き換えてしまう(JISの@キーがe.key="["になる) -> 不採用
// 結論: このMacの物理キーキャップ(JIS)に合わせた静的な刻印で固定する。
const JIS_LABEL_OVERRIDES = {
  Equal: "^", // JISでは0の2つ右は ^
  BracketLeft: "@", // JISではPの右は @
  BracketRight: "[", // JISでは @ の右は [(「)
  Quote: ":", // JISでは ; の右は :
};

function applyKeyboardLayoutLabels() {
  Object.entries(JIS_LABEL_OVERRIDES).forEach(([code, label]) => {
    CODE_TO_LABEL[code] = label;
    const keyEl = keyElByCode[code];
    if (keyEl) {
      const labelEl = keyEl.querySelector(".key-label");
      if (labelEl) labelEl.textContent = label;
    }
  });
  renderGuideStrip(); // 描画済みのガイドブロックの刻印も更新する
}

// SPEC §14.2: 段カラーの逆引き(コード→色)
const CODE_TO_ROW_COLOR = {};
KEY_ROWS.forEach((row) => {
  row.codes.forEach((code) => {
    CODE_TO_ROW_COLOR[code] = row.color;
  });
});

const MIDI_NOTE_MIN = 48; // C3

// KEY_ROWSは表示上「数字段が先頭」だが、音域としてはZ段が最低音。
// ここでの並び(codeOrderLowToHigh)は前処理スクリプトと同じ順序(C3から半音ずつ上昇)にする。
const CODE_ORDER_LOW_TO_HIGH = [
  ...KEY_ROWS[3].codes, // Z段
  ...KEY_ROWS[2].codes, // A段
  ...KEY_ROWS[1].codes, // Q段
  ...KEY_ROWS[0].codes, // 数字段
];

const CODE_TO_MIDI = {};
CODE_ORDER_LOW_TO_HIGH.forEach((code, i) => {
  CODE_TO_MIDI[code] = MIDI_NOTE_MIN + i;
});

// キーラベル(画面表示用の刻印文字)。ガイド帯のブロック内表示に使う。
const CODE_TO_LABEL = {};
KEY_ROWS.forEach((row) => {
  row.codes.forEach((code, i) => {
    CODE_TO_LABEL[code] = row.labels[i];
  });
});

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
function midiToNoteName(n) {
  const octave = Math.floor(n / 12) - 1;
  return `${NOTE_NAMES[n % 12]}${octave}`;
}
function midiToFreq(n) {
  return 440 * Math.pow(2, (n - 69) / 12);
}

// --- Web Audio 合成音(v0はレイヤードオシレータ+エンベロープ) -----------------

class PianoSynth {
  constructor() {
    this.ctx = null;
    this.voices = new Map(); // code -> { oscillators, gainNode }
  }

  ensureContext() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume();
    }
  }

  noteOn(code, midiNote, velocity) {
    this.ensureContext();
    this.noteOff(code, true); // 既存の発音があれば即時停止してから鳴らし直す

    const ctx = this.ctx;
    const now = ctx.currentTime;
    const freq = midiToFreq(midiNote);
    const vel = Math.max(1, Math.min(127, velocity)) / 127;

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0, now);
    masterGain.connect(ctx.destination);

    // ピアノらしさを出すため、基音+倍音を複数オシレータで重ねる。
    const partials = [
      { ratio: 1, gain: 1.0 },
      { ratio: 2, gain: 0.5 },
      { ratio: 3, gain: 0.22 },
      { ratio: 4, gain: 0.1 },
    ];

    const oscillators = partials.map(({ ratio, gain }) => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq * ratio, now);
      const partialGain = ctx.createGain();
      partialGain.gain.setValueAtTime(gain, now);
      osc.connect(partialGain);
      partialGain.connect(masterGain);
      osc.start(now);
      return osc;
    });

    // アタック→減衰(ピアノは打鍵直後が最大音量で、そのあとゆっくり減衰する)
    const peak = 0.28 * vel;
    masterGain.gain.linearRampToValueAtTime(peak, now + 0.008);
    masterGain.gain.exponentialRampToValueAtTime(Math.max(peak * 0.35, 0.001), now + 0.6);

    this.voices.set(code, { oscillators, masterGain, startedAt: now });
  }

  noteOff(code, immediate) {
    const voice = this.voices.get(code);
    if (!voice) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const releaseTime = immediate ? 0.02 : 0.25;

    voice.masterGain.gain.cancelScheduledValues(now);
    const currentGain = voice.masterGain.gain.value;
    voice.masterGain.gain.setValueAtTime(currentGain, now);
    voice.masterGain.gain.exponentialRampToValueAtTime(0.0001, now + releaseTime);

    const stopAt = now + releaseTime + 0.02;
    voice.oscillators.forEach((osc) => {
      try {
        osc.stop(stopAt);
      } catch (e) {
        // 既に停止している場合は無視
      }
    });

    this.voices.delete(code);
  }
}

// --- Salamanderサンプル音源(SPEC §22) ---------------------------------------
// Salamander Grand Piano by Alexander Holm (CC-BY 3.0)。短3度間隔の17サンプルを
// 最寄りの音からピッチシフトして全音域(C3〜G#6)をカバーする。読み込み完了までは
// 従来のオシレータ合成音(PianoSynth)にフォールバックする。

// サンプル先頭の無音区間の長さ(秒)を求める。Salamanderサンプル自体の約10msの
// 立ち上がり無音に加え、Safariのmp3デコードはエンコーダ遅延(約26〜50ms)を先頭に
// 残すため、無音のまま鳴らすと打鍵から発音まで体感できる遅れになる。再生開始位置を
// ここまで進めてスキップする。アタックを削らないよう2ms手前で止める。
function leadingSilenceSeconds(buf) {
  const data = buf.getChannelData(0);
  let peak = 0;
  for (let i = 0; i < data.length; i++) {
    const a = Math.abs(data[i]);
    if (a > peak) peak = a;
  }
  const thresh = peak * 0.02;
  let first = 0;
  for (let i = 0; i < data.length; i++) {
    if (Math.abs(data[i]) > thresh) {
      first = i;
      break;
    }
  }
  return Math.max(0, first / buf.sampleRate - 0.002);
}

const SAMPLE_FILES = {
  48: "C3", 51: "Ds3", 54: "Fs3", 57: "A3",
  60: "C4", 63: "Ds4", 66: "Fs4", 69: "A4",
  72: "C5", 75: "Ds5", 78: "Fs5", 81: "A5",
  84: "C6", 87: "Ds6", 90: "Fs6", 93: "A6",
  96: "C7",
};

class SamplePiano {
  constructor() {
    this.ctx = null;
    this.buffers = new Map(); // sampleMidi -> AudioBuffer
    this.startOffsets = new Map(); // sampleMidi -> 先頭無音をスキップする再生開始位置(秒)
    this.voices = new Map(); // code -> { source, gainNode }
    this.loaded = false;
    this.loading = null;
  }

  ensureContext() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume();
    }
  }

  load() {
    if (this.loading) return this.loading;
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    this.loading = Promise.all(
      Object.entries(SAMPLE_FILES).map(async ([midi, name]) => {
        const res = await fetch(`samples/${name}.mp3`);
        if (!res.ok) throw new Error(t("error.sampleFetch", { name, status: res.status }));
        const buf = await this.ctx.decodeAudioData(await res.arrayBuffer());
        this.buffers.set(Number(midi), buf);
        this.startOffsets.set(Number(midi), leadingSilenceSeconds(buf));
      })
    ).then(() => {
      this.loaded = true;
    });
    return this.loading;
  }

  nearestSampleMidi(midiNote) {
    let best = null;
    for (const m of this.buffers.keys()) {
      if (best === null || Math.abs(m - midiNote) < Math.abs(best - midiNote)) best = m;
    }
    return best;
  }

  noteOn(code, midiNote, velocity) {
    this.ensureContext();
    this.noteOff(code, true);
    const sampleMidi = this.nearestSampleMidi(midiNote);
    if (sampleMidi === null) return;

    const source = this.ctx.createBufferSource();
    source.buffer = this.buffers.get(sampleMidi);
    source.playbackRate.value = Math.pow(2, (midiNote - sampleMidi) / 12);

    const gainNode = this.ctx.createGain();
    const vel = Math.max(1, Math.min(127, velocity)) / 127;
    gainNode.gain.value = 0.9 * Math.pow(vel, 1.5);

    source.connect(gainNode);
    gainNode.connect(this.ctx.destination);
    source.start(0, this.startOffsets.get(sampleMidi) || 0);
    this.voices.set(code, { source, gainNode });
  }

  noteOff(code, immediate) {
    const voice = this.voices.get(code);
    if (!voice) return;
    const now = this.ctx.currentTime;
    const releaseTime = immediate ? 0.02 : 0.25;

    voice.gainNode.gain.cancelScheduledValues(now);
    voice.gainNode.gain.setValueAtTime(Math.max(voice.gainNode.gain.value, 0.0001), now);
    voice.gainNode.gain.exponentialRampToValueAtTime(0.0001, now + releaseTime);
    try {
      voice.source.stop(now + releaseTime + 0.02);
    } catch (e) {
      // 既に停止している場合は無視
    }
    this.voices.delete(code);
  }
}

// --- 曲データ・進行状態 ------------------------------------------------------

const state = {
  song: null,
  currentEventIndex: 0,
  heldCodes: new Set(),
  satisfiedCodes: new Set(), // SPEC §20: 現在イベントで既に押された正解キーの累積(ロール入力許容)
  freshPressInEvent: false, // 現在イベント中に新しい打鍵が1つ以上あったか(押しっぱなし引き継ぎだけでの自動進行を防ぐ)
  // --- SPEC §13.3 テンポ推定用の状態 ---
  tempoSamples: [], // 直近N=4件の「実際の発音間隔(秒) / onsetDeltaRatio」
  lastOnsetTime: null, // 直近に消化したイベントの実際の発音時刻(秒、performance.now()ベース)
  // --- SPEC §14.2 時間駆動スクロール用の状態 ---
  positions: [], // 各イベントの累積発音位置(四分音符=1.0基準)
  scrollOffsetPx: 0, // ガイド帯の現在のスクロール量(px)
  lastTickTs: null, // 直近のrequestAnimationFrameタイムスタンプ
  arrivedEventIndex: -1, // ready脈動を発火済みのイベントインデックス
  rafId: null,
  autoCutTimers: new Map(), // SPEC §15: code -> 長押し自動ノートオフのタイマーID
  assistMode: "standard", // SPEC §16: "none" | "standard" | "full"
  tempoMode: "auto", // SPEC §17: "auto"(自分のテンポ推定) | "original"(原曲テンポ固定)
  chordMode: "full", // SPEC §21.1: "full" | "melody_bass" | "melody"
  rawSongData: null, // 現在の曲の元データ(和音簡略化フィルタ前)
  currentSongId: null,
  songCatalog: null, // SPEC §23: 収録曲+私的利用曲の結合リスト
  // --- SPEC_I18N_ONBOARDING §3 オンボーディング ---
  introActive: false, // イントロ譜面の進行中
  introEnding: false, // 終了処理の多重起動防止
  savedAssistMode: null, // イントロ中に退避したユーザー設定
  savedChordMode: null,
  // --- SPEC_SONGS_INTRO WP1 毎回変わるイントロ ---
  introFirstVisit: false, // このセッションが初回訪問か(着地規則の分岐に使う)
  introPieceName: null, // イントロで弾いた曲の表示名(確認表示で明かす)
};

// SPEC §15: 標準モードでは目標保持時間の1.25倍を超えたら自動でノートオフする
// (猶予=レガートの重なり許容)。フル補助では猶予なし(×1.0)で楽譜の音価通りに切る。
const AUTO_CUT_GRACE = 1.25;
const ASSIST_STORAGE_KEY = "pianoTypingGame.assistMode";
const TEMPO_STORAGE_KEY = "pianoTypingGame.tempoMode";
const CHORD_STORAGE_KEY = "pianoTypingGame.chordMode";

// SPEC §21.1: 和音簡略化(譜面の厚さ)。実行時フィルタで曲JSONは変更しない。
// melody=最高音のみ、melody_bass=最高音+最低音(最大2音)、full=そのまま。
function applyChordMode(events, mode) {
  if (mode === "full") return events;
  return events.map((ev) => {
    if (ev.keys.length <= 1) return ev;
    let maxIdx = 0;
    let minIdx = 0;
    ev.midiNotes.forEach((n, i) => {
      if (n > ev.midiNotes[maxIdx]) maxIdx = i;
      if (n < ev.midiNotes[minIdx]) minIdx = i;
    });
    const indices = mode === "melody" ? [maxIdx] : [...new Set([maxIdx, minIdx])];
    indices.sort((a, b) => ev.midiNotes[a] - ev.midiNotes[b]);
    return {
      ...ev,
      keys: indices.map((i) => ev.keys[i]),
      midiNotes: indices.map((i) => ev.midiNotes[i]),
      durationRatios: indices.map((i) => ev.durationRatios[i]),
      velocities: indices.map((i) => ev.velocities[i]),
    };
  });
}

const TEMPO_SAMPLE_COUNT = 4; // SPEC §13.3: N=4
const DEFAULT_QUARTER_SECONDS = 1.0; // SPEC §13.3: 既定テンポ(四分音符=60相当)

// SPEC §22: サンプル音源を優先し、読み込み前・失敗時はオシレータ合成にフォールバック。
// noteOffは両方に流す(各自が自分のvoicesだけを処理するため安全)。
const oscSynth = new PianoSynth();
const samplePiano = new SamplePiano();

// Safari/macOSは無音が続くと音声出力デバイスを省電力状態に落とし、次の発音の
// 立ち上がりに追加の遅延が乗ることがある。聴こえない極小レベルのノイズをループ
// 再生し続けてデバイスを起こしたままにする(-80dBFS相当、体感不可)。
let keepAliveStarted = false;
function startKeepAlive(ctx) {
  if (keepAliveStarted) return;
  keepAliveStarted = true;
  const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() * 2 - 1) * 0.0001;
  }
  const source = ctx.createBufferSource();
  source.buffer = buf;
  source.loop = true;
  source.connect(ctx.destination);
  source.start();
}

const synth = {
  ensureContext() {
    samplePiano.ensureContext();
    oscSynth.ctx = samplePiano.ctx; // AudioContextを共有する
    startKeepAlive(samplePiano.ctx);
  },
  noteOn(code, midiNote, velocity) {
    this.ensureContext();
    if (samplePiano.loaded) {
      samplePiano.noteOn(code, midiNote, velocity);
    } else {
      oscSynth.noteOn(code, midiNote, velocity);
    }
  },
  noteOff(code, immediate) {
    samplePiano.noteOff(code, immediate);
    oscSynth.noteOff(code, immediate);
  },
};

const els = {
  title: document.getElementById("song-title"),
  license: document.getElementById("song-license"),
  progressText: document.getElementById("progress-text"),
  progressBarInner: document.getElementById("progress-bar-inner"),
  keyboard: document.getElementById("keyboard"),
  errorBox: document.getElementById("error-box"),
  startOverlay: document.getElementById("start-overlay"),
  startButton: document.getElementById("start-button"),
  guideTrack: document.getElementById("guide-track"),
  skipIntroButton: document.getElementById("skip-intro-button"),
  introCue: document.getElementById("intro-cue"),
  introCount: document.getElementById("intro-count"),
  introConfirm: document.getElementById("intro-confirm"),
  introConfirmPiece: document.getElementById("intro-confirm-piece"),
  songSelect: document.getElementById("song-select"),
  tempoEstimateText: document.getElementById("tempo-estimate-text"),
};

function nowSeconds() {
  return performance.now() / 1000;
}

// SPEC §17: 原曲テンポ(曲データJSONのtempoMicrosecondsPerBeat)の四分音符1個分の秒数
function originalQuarterSeconds() {
  if (state.song && state.song.tempoMicrosecondsPerBeat) {
    return state.song.tempoMicrosecondsPerBeat / 1_000_000;
  }
  return DEFAULT_QUARTER_SECONDS;
}

// SPEC §13.3・§17: ガイドの基準テンポ(四分音符1個分の秒数)。
// tempoMode="auto": 直近N=4イベントの移動平均で自分のタイピングから推定(ルバート追従)。
// tempoMode="original": 原曲テンポに固定(opt-inのメトロノーム的ガイド)。
// いずれも表示・補助用で、進行判定には使わない。
function estimatedQuarterSeconds() {
  if (state.tempoMode === "original") return originalQuarterSeconds();
  if (state.tempoSamples.length === 0) return DEFAULT_QUARTER_SECONDS;
  const sum = state.tempoSamples.reduce((a, b) => a + b, 0);
  return sum / state.tempoSamples.length;
}

// completedIndex: たった今、必要キーが揃って進行条件を満たした(=実際に発音した)イベントの
// インデックス。このイベントのonsetDeltaRatioと、直前の発音時刻からの実経過時間を比較し、
// テンポ推定のサンプルへ加える(SPEC §13.3)。
function recordOnsetSample(completedIndex) {
  const now = nowSeconds();
  const ev = state.song.events[completedIndex];
  if (state.lastOnsetTime !== null && ev.onsetDeltaRatio > 0) {
    const actualSeconds = now - state.lastOnsetTime;
    const sample = actualSeconds / ev.onsetDeltaRatio;
    state.tempoSamples.push(sample);
    if (state.tempoSamples.length > TEMPO_SAMPLE_COUNT) {
      state.tempoSamples.shift();
    }
  }
  state.lastOnsetTime = now;
}

const keyElByCode = {};

function buildKeyboardUI() {
  els.keyboard.innerHTML = "";
  KEY_ROWS.forEach((row) => {
    const rowEl = document.createElement("div");
    rowEl.className = "key-row";

    const hintEl = document.createElement("div");
    hintEl.className = "row-hint";
    hintEl.textContent = row.range;
    hintEl.style.color = row.color; // SPEC §14.2 段カラーで鍵盤とガイド帯をひも付ける
    rowEl.appendChild(hintEl);

    row.codes.forEach((code, i) => {
      const keyEl = document.createElement("div");
      keyEl.className = "key";
      keyEl.dataset.code = code;
      keyEl.style.setProperty("--row-color", row.color); // SPEC §14.2 段カラー

      // SPEC §14.1: 保持ガイドの充填スイープはキー自体の中に描く
      const fillEl = document.createElement("div");
      fillEl.className = "key-fill";

      // SPEC §14.1: 押すタイミングの接近表示(下から満ちる青い光。満ちきり=押す瞬間)
      const approachEl = document.createElement("div");
      approachEl.className = "key-approach";

      const labelEl = document.createElement("div");
      labelEl.className = "key-label";
      labelEl.textContent = row.labels[i];

      const noteEl = document.createElement("div");
      noteEl.className = "note-label";
      noteEl.textContent = midiToNoteName(CODE_TO_MIDI[code]);

      keyEl.appendChild(approachEl);
      keyEl.appendChild(fillEl);
      keyEl.appendChild(labelEl);
      keyEl.appendChild(noteEl);
      rowEl.appendChild(keyEl);
      keyElByCode[code] = keyEl;
    });

    els.keyboard.appendChild(rowEl);
  });
}

// --- ピアノロール型ガイド帯(SPEC.md §13.2・§14.2) --------------------------
// v0.2: 帯は時間駆動で連続スクロールする。現在イベントのブロックが再生線に到達した
// 瞬間=押すべき瞬間で、キーのready脈動(§14.1)と同期する。点滅方式は廃止。

const GUIDE_PIXELS_PER_BEAT = 120; // 四分音符1つ分の幅(横幅・間隔の比例スケール)
const GUIDE_MIN_ROW_WIDTH = 32; // 刻印が読めるよう最低幅を確保(SPEC §21.2)
const GUIDE_WINDOW_SIZE = 12; // 一度に描画する先読みイベント数

function renderGuideStrip() {
  if (!els.guideTrack || !state.song) return;

  els.guideTrack.innerHTML = "";
  const events = state.song.events;
  const startIndex = state.currentEventIndex;
  const endIndex = Math.min(startIndex + GUIDE_WINDOW_SIZE, events.length);

  for (let i = startIndex; i < endIndex; i += 1) {
    const ev = events[i];

    const blockEl = document.createElement("div");
    blockEl.className = "guide-block";
    blockEl.dataset.eventIndex = String(i);
    // 位置は曲全体の累積発音位置から算出する(帯全体をtranslateXで動かす)
    blockEl.style.left = `${state.positions[i] * GUIDE_PIXELS_PER_BEAT}px`;
    if (i === startIndex) blockEl.classList.add("is-current");

    // SPEC §14.2: 和音は音高降順(高い音が上)に積み、段カラーで鍵盤とひも付ける
    const notes = ev.keys.map((code, j) => ({
      code,
      midi: ev.midiNotes[j],
      durationRatio: ev.durationRatios[j],
    }));
    notes.sort((a, b) => b.midi - a.midi);

    notes.forEach(({ code, midi, durationRatio }) => {
      const rowEl = document.createElement("div");
      rowEl.className = "guide-note-row";
      rowEl.dataset.code = code;
      rowEl.style.width = `${Math.max(GUIDE_MIN_ROW_WIDTH, durationRatio * GUIDE_PIXELS_PER_BEAT)}px`;
      const rowColor = CODE_TO_ROW_COLOR[code] || "#888";
      rowEl.style.borderLeft = `3px solid ${rowColor}`;
      rowEl.style.background = `${rowColor}33`; // 段カラーの薄い背景(alpha 0.2)

      // SPEC §21.2: 刻印のみ表示(音名併記はユーザー判断で廃止)。
      // 紛らわしい記号(英数字以外)は拡大描画する。
      const label = CODE_TO_LABEL[code] || code;
      const labelEl = document.createElement("span");
      labelEl.className = "guide-note-key-label";
      if (!/^[0-9A-Za-z]$/.test(label)) labelEl.classList.add("punct");
      labelEl.textContent = label;
      labelEl.style.color = rowColor;

      rowEl.appendChild(labelEl);
      blockEl.appendChild(rowEl);
    });

    els.guideTrack.appendChild(blockEl);
  }

  updateTempoEstimateText();
}

// SPEC §14.2: 時間駆動スクロール。推定テンポに比例した速度で帯を左へ流し、
// 現在イベントの位置(=再生線への到達)で止める。ユーザーが先行して大きく遅れたら
// 速度をブーストして追いつく(指揮者的追従)。表示のみで判定には使わない(§14.3)。
function guideScrollTick(ts) {
  state.rafId = requestAnimationFrame(guideScrollTick);
  if (!state.song || state.positions.length === 0) return;
  if (state.lastTickTs === null) {
    state.lastTickTs = ts;
    return;
  }
  const dt = Math.min(0.1, (ts - state.lastTickTs) / 1000);
  state.lastTickTs = ts;

  const lastIndex = state.song.events.length - 1;
  const idx = Math.min(state.currentEventIndex, lastIndex);
  const targetPx = state.positions[idx] * GUIDE_PIXELS_PER_BEAT;

  if (state.scrollOffsetPx < targetPx) {
    const baseRate = GUIDE_PIXELS_PER_BEAT / estimatedQuarterSeconds(); // px/秒
    const behind = targetPx - state.scrollOffsetPx;
    // 1.5拍以上遅れていたら追いつきブースト(ユーザーが推定テンポより速い場合)
    const boost = behind > GUIDE_PIXELS_PER_BEAT * 1.5 ? behind * 4 : 0;
    state.scrollOffsetPx = Math.min(targetPx, state.scrollOffsetPx + (baseRate + boost) * dt);
    els.guideTrack.style.transform = `translateX(${-state.scrollOffsetPx}px)`;
  }

  // 再生線への到達=押すべき瞬間。キーのready脈動と帯のarrived表示を同期発火(§14.1)
  if (
    state.scrollOffsetPx >= targetPx - 0.5 &&
    state.arrivedEventIndex !== state.currentEventIndex &&
    state.currentEventIndex <= lastIndex
  ) {
    state.arrivedEventIndex = state.currentEventIndex;
    markArrival();
  }

  updateApproachBars();
}

// SPEC §14.1: 押すタイミングの接近を鍵盤上でも示す。次に押すキーの内部を、
// 待ち時間の経過率に合わせて下から青い光で満たす。満ちきり=押す瞬間(ready脈動と同期)。
// 帯を見なくても鍵盤だけで「どのキーを・いつ押すか」が完結する。表示のみ(§14.3)。
function updateApproachBars() {
  const idx = state.currentEventIndex;
  if (!state.song || idx >= state.song.events.length) return;
  const targetPx = state.positions[idx] * GUIDE_PIXELS_PER_BEAT;
  const startPx = idx === 0 ? 0 : state.positions[idx - 1] * GUIDE_PIXELS_PER_BEAT;
  const span = targetPx - startPx;
  const fraction = span <= 0 ? 1 : Math.min(1, Math.max(0, (state.scrollOffsetPx - startPx) / span));
  requiredCodesForCurrentEvent().forEach((code) => {
    const keyEl = keyElByCode[code];
    if (!keyEl) return;
    const bar = keyEl.querySelector(".key-approach");
    if (bar) bar.style.height = `${fraction * 100}%`;
  });
}

function markArrival() {
  const blockEl = els.guideTrack.querySelector(
    `.guide-block[data-event-index="${state.currentEventIndex}"]`
  );
  if (blockEl) blockEl.classList.add("arrived");
  requiredCodesForCurrentEvent().forEach((code) => {
    const keyEl = keyElByCode[code];
    if (keyEl) keyEl.classList.add("ready");
  });
}

function updateTempoEstimateText() {
  if (!els.tempoEstimateText) return;
  const quarterSeconds = estimatedQuarterSeconds();
  const bpm = Math.round(60 / quarterSeconds);
  let label;
  if (state.tempoMode === "original") {
    label = t("tempo.estimate.original");
  } else {
    label = state.tempoSamples.length > 0 ? t("tempo.estimate.estimated") : t("tempo.estimate.default");
  }
  els.tempoEstimateText.textContent = t("tempo.estimate.value", { label, bpm });
}

function currentEvent() {
  if (!state.song) return null;
  return state.song.events[state.currentEventIndex] || null;
}

function requiredCodesForCurrentEvent() {
  const ev = currentEvent();
  if (!ev) return new Set();
  return new Set(ev.keys); // 重複キーは1つの物理キーとして扱う(README参照)
}

function refreshGuideHighlight() {
  Object.values(keyElByCode).forEach((el) => {
    el.classList.remove("guide", "ready");
    const bar = el.querySelector(".key-approach");
    if (bar) bar.style.height = "0%"; // イベント消化で接近表示をリセット
  });
  const required = requiredCodesForCurrentEvent();
  required.forEach((code) => {
    const el = keyElByCode[code];
    if (el) el.classList.add("guide");
  });
}

function refreshProgressUI() {
  if (!state.song) return;
  const total = state.song.events.length;
  const done = state.currentEventIndex;
  els.progressText.textContent = `${done} / ${total}`;
  const pct = total === 0 ? 0 : Math.min(100, (done / total) * 100);
  els.progressBarInner.style.width = `${pct}%`;
  if (state.introActive && els.introCount) {
    els.introCount.textContent = t("intro.progress", { done, total });
  }
}

// SPEC §2: 強弱は楽譜値を使用する。現在のイベントの正解キーなら対応するベロシティ、
// 誤打鍵・イベント外は既定値で鳴らす。
const DEFAULT_VELOCITY = 80;
function velocityForCode(code) {
  const ev = currentEvent();
  if (ev) {
    const idx = ev.keys.indexOf(code);
    if (idx !== -1 && Array.isArray(ev.velocities) && ev.velocities[idx] != null) {
      return ev.velocities[idx];
    }
  }
  return DEFAULT_VELOCITY;
}

// SPEC §20: 和音判定は「同時押し」ではなく「現在イベント中に必要キーを全部押した(累積)」。
// 一般キーボードのゴースト/ブロッキングで3音以上の同時押しが物理的に届かない組合せが
// あるため、ロール入力(ばらして順に押す)でも和音が成立するようにする(2026-07-18)。
function checkProgress() {
  const required = requiredCodesForCurrentEvent();
  if (required.size === 0) return;
  if (!state.freshPressInEvent) return; // 引き継ぎだけでは進行しない(同音連打は再打鍵が必要)
  for (const code of required) {
    if (!state.satisfiedCodes.has(code)) return; // まだ押されていない必要キーがある
  }
  // 現在のイベントの必要キーが全て押された -> 進行
  state.satisfiedCodes.clear();
  state.freshPressInEvent = false;
  const completedIndex = state.currentEventIndex;
  recordOnsetSample(completedIndex); // SPEC §13.3: テンポ推定サンプルの更新
  state.currentEventIndex += 1;
  // 押しっぱなしのキーが次イベントの正解キーでもある場合は「押済み」として引き継ぐ。
  // 連続する和音で共通音(例: G+S -> G+I のG)を保持したまま弾き継げるようにする
  // (実ピアノの指の保持・タイと同じ扱い。音は再打鍵しない限り鳴り直さない)。
  requiredCodesForCurrentEvent().forEach((code) => {
    if (state.heldCodes.has(code)) state.satisfiedCodes.add(code);
  });
  refreshGuideHighlight();
  refreshProgressUI();
  renderGuideStrip(); // SPEC §13.2: イベント消化駆動でガイド帯を進める(時計駆動にしない)
  if (state.currentEventIndex >= state.song.events.length) {
    const total = state.song.events.length;
    els.progressText.textContent = t("progress.complete", { done: total, total });
    // SPEC_I18N_ONBOARDING §3.2: イントロ譜面を弾き切ったら確認表示へ
    if (state.introActive) endIntro(true);
  }
}

function onKeyDown(e) {
  const code = e.code;
  // SPEC_I18N_ONBOARDING §3.4: イントロ中はEscで抜けられる(抜けてもオンボード済み扱い)
  if (state.introActive && code === "Escape") {
    e.preventDefault();
    endIntro(false);
    return;
  }
  if (!(code in CODE_TO_MIDI)) return;
  // preventDefaultはリピートイベントにも必ずかける。リピートを素通しすると、
  // フォーカスが曲選択select等に残っている場合にブラウザの型打ち選択が発動し、
  // 長押し中に曲が勝手に切り替わる(2026-07-17バグ修正)。
  e.preventDefault();
  if (e.repeat) return; // キーリピートは無視(SPEC §3)

  if (state.heldCodes.has(code)) return; // 二重keydown防止
  state.heldCodes.add(code);
  if (requiredCodesForCurrentEvent().has(code)) {
    state.satisfiedCodes.add(code); // SPEC §20: 正解キーの押下を累積(ロール入力許容)
    state.freshPressInEvent = true;
  }

  const midiNote = CODE_TO_MIDI[code];
  cancelAutoCut(code); // SPEC §16: 前回発音の残タイマーが新しい音を切る事故を防ぐ
  synth.noteOn(code, midiNote, velocityForCode(code)); // マッピングされたキーは常に発音する(SPEC §6)

  const keyEl = keyElByCode[code];
  if (keyEl) keyEl.classList.add("held");

  startHoldGuideFill(code); // SPEC §13.3 保持ガイド(表示のみ、判定には影響しない)
  scheduleAutoCut(code); // SPEC §15 長押しの自動ノートオフ(進行判定には影響しない)
  checkProgress();
}

function onKeyUp(e) {
  const code = e.code;
  if (!(code in CODE_TO_MIDI)) return;
  e.preventDefault();

  state.heldCodes.delete(code);

  // SPEC §16 フル補助: 楽譜の音価タイマーが生きている音はkeyupで切らず、
  // タイマーに任せて楽譜の長さまで鳴らし続ける(スタッカートも自動再現)。
  const fullAssistPending = state.assistMode === "full" && state.autoCutTimers.has(code);
  if (!fullAssistPending) {
    synth.noteOff(code, false);
    cancelAutoCut(code);
  }

  const keyEl = keyElByCode[code];
  if (keyEl) keyEl.classList.remove("held");

  stopHoldGuideFill(code);
}

// SPEC §15・§16: 現在イベントの正解キーとして押された音の自動ノートオフ。
// 補助なし: 何もしない(押す・離す両方ユーザーの手)。
// 標準: 目標保持時間の1.25倍を超えたら切る(早離しは自由)。
// フル補助: 猶予なしで楽譜の音価通りに切る(keyup側でも切らない=長さ全自動)。
// いずれも誤打鍵・イベント外キーは対象外。音だけを切り、押下状態・進行判定には影響しない。
function scheduleAutoCut(code) {
  if (state.assistMode === "none") return;
  const ev = currentEvent();
  if (!ev) return;
  const idx = ev.keys.indexOf(code);
  if (idx === -1) return;

  const targetSeconds = estimatedQuarterSeconds() * ev.durationRatios[idx];
  const grace = state.assistMode === "full" ? 1.0 : AUTO_CUT_GRACE;
  const cutSeconds = targetSeconds * grace;
  const timerId = setTimeout(() => {
    state.autoCutTimers.delete(code);
    synth.noteOff(code, false); // 通常のリリースエンベロープで自然に切る
  }, cutSeconds * 1000);
  state.autoCutTimers.set(code, timerId);
}

function cancelAutoCut(code) {
  const timerId = state.autoCutTimers.get(code);
  if (timerId !== undefined) {
    clearTimeout(timerId);
    state.autoCutTimers.delete(code);
  }
}

// SPEC §14.1 保持ガイド: 現在のイベントの正解キーが押されたら、推定テンポ×durationRatioを
// 目標保持時間として、押されたキー自体の内部を充填スイープで塗る。塗り切り=離す瞬間。
// 視線を鍵盤から動かさずに保持時間が分かる。表示のみで、ノートオフの強制やスコアリングは
// 行わない(§14.3)。
function startHoldGuideFill(code) {
  const ev = currentEvent();
  if (!ev) return;
  const idx = ev.keys.indexOf(code);
  if (idx === -1) return; // 現在のイベントに含まれないキー(誤打鍵)はガイド対象外
  const keyEl = keyElByCode[code];
  if (!keyEl) return;
  const fillEl = keyEl.querySelector(".key-fill");
  if (!fillEl) return;

  const targetSeconds = estimatedQuarterSeconds() * ev.durationRatios[idx];
  fillEl.style.transitionDuration = "0s";
  fillEl.style.width = "0%";
  // reflowを挟んでからtransitionを効かせる(0%→100%への遷移を発火させるため)
  void fillEl.offsetHeight;
  fillEl.style.transitionDuration = `${Math.max(0.01, targetSeconds)}s`;
  fillEl.style.width = "100%";
}

function stopHoldGuideFill(code) {
  const keyEl = keyElByCode[code];
  if (!keyEl) return;
  const fillEl = keyEl.querySelector(".key-fill");
  if (!fillEl) return;
  fillEl.style.transitionDuration = "0.08s";
  fillEl.style.width = "0%";
}

// SPEC §16: 補助レベルの選択UI。選択はlocalStorageに保存し次回も維持する。
function initAssistSelect() {
  let saved = null;
  try {
    saved = localStorage.getItem(ASSIST_STORAGE_KEY);
  } catch (e) {
    // localStorage不可の環境では既定値のまま
  }
  if (saved === "none" || saved === "standard" || saved === "full") {
    state.assistMode = saved;
  }
  document.querySelectorAll('input[name="assist"]').forEach((input) => {
    input.checked = input.value === state.assistMode;
    input.addEventListener("change", () => {
      if (!input.checked) return;
      state.assistMode = input.value;
      try {
        localStorage.setItem(ASSIST_STORAGE_KEY, input.value);
      } catch (e) {
        // 保存できなくても動作は継続
      }
      input.blur(); // 演奏キーがフォーム部品に飛ばないようフォーカスを外す
    });
  });
}

// SPEC §21.1: 和音簡略化(譜面の厚さ)の選択UI。変更時は現在の曲を再適用して先頭から。
function initChordSelect() {
  let saved = null;
  try {
    saved = localStorage.getItem(CHORD_STORAGE_KEY);
  } catch (e) {
    // localStorage不可の環境では既定値のまま
  }
  if (saved === "full" || saved === "melody_bass" || saved === "melody") {
    state.chordMode = saved;
  }
  document.querySelectorAll('input[name="chord"]').forEach((input) => {
    input.checked = input.value === state.chordMode;
    input.addEventListener("change", () => {
      if (!input.checked) return;
      state.chordMode = input.value;
      try {
        localStorage.setItem(CHORD_STORAGE_KEY, input.value);
      } catch (e) {
        // 保存できなくても動作は継続
      }
      if (state.currentSongId) selectSong(state.currentSongId); // 再適用+リセット
      input.blur(); // 演奏キーがフォーム部品に飛ばないようフォーカスを外す
    });
  });
}

// SPEC §17: テンポソースの選択UI。選択はlocalStorageに保存し次回も維持する。
// 原曲テンポ選択中もテンポ推定サンプルの記録は継続する(モードを戻した瞬間から推定が効く)。
function initTempoSelect() {
  let saved = null;
  try {
    saved = localStorage.getItem(TEMPO_STORAGE_KEY);
  } catch (e) {
    // localStorage不可の環境では既定値のまま
  }
  if (saved === "auto" || saved === "original") {
    state.tempoMode = saved;
  }
  document.querySelectorAll('input[name="tempo"]').forEach((input) => {
    input.checked = input.value === state.tempoMode;
    input.addEventListener("change", () => {
      if (!input.checked) return;
      state.tempoMode = input.value;
      try {
        localStorage.setItem(TEMPO_STORAGE_KEY, input.value);
      } catch (e) {
        // 保存できなくても動作は継続
      }
      updateTempoEstimateText();
      input.blur(); // 演奏キーがフォーム部品に飛ばないようフォーカスを外す
    });
  });
}

function showError(message) {
  els.errorBox.textContent = message;
  els.errorBox.classList.add("visible");
}

// SPEC §18.2・§19: 曲リストと曲選択(levelでレベル昇順・"Lv.N｜曲名"表示)
// SPEC_I18N_ONBOARDING §2.3: 表示曲名はこのカタログ側の値を正とし、曲JSONのtitle
// (日本語混在)はフォールバックに降格する。曲JSONは変更しない。
// SPEC_SONGS_INTRO WP2: 公開曲はPD/CC0のみ。西洋クラシックに偏らないよう各国の民謡
// (自作編曲・CC0)を入口(Lv1〜3)に厚く置く。レベルは使用キー数・同時音数・速度・
// 跳躍で判定し、Lv1〜7の各段に最低1曲を置く。出典とライセンスは各曲JSONとREADME参照。
const SONG_LIST = [
  {
    id: "practice_beginner", file: "songs/practice_beginner.json", level: 1,
    labels: {
      en: "Lv.1 | First steps (C major scale & Twinkle Twinkle)",
      ja: "Lv.1｜初心者練習譜面(ドレミときらきら星)",
    },
  },
  {
    id: "folk_au_clair_de_la_lune", file: "songs/folk_au_clair_de_la_lune.json", level: 1,
    labels: {
      en: "Lv.1 | Au clair de la lune (France, traditional)",
      ja: "Lv.1｜月の光に(フランス民謡)",
    },
  },
  {
    id: "folk_sakura", file: "songs/folk_sakura.json", level: 1,
    labels: {
      en: "Lv.1 | Sakura Sakura (Japan, traditional)",
      ja: "Lv.1｜さくらさくら(日本の伝承曲)",
    },
  },
  {
    id: "practice_folk_lv2", file: "songs/practice_folk_lv2.json", level: 2,
    labels: {
      en: "Lv.2 | Folk medley (Butterfly, Mary Had a Little Lamb, When the Saints)",
      ja: "Lv.2｜民謡メドレー(ちょうちょ・メリーさん・聖者の行進)",
    },
  },
  {
    id: "folk_mo_li_hua", file: "songs/folk_mo_li_hua.json", level: 2,
    labels: {
      en: "Lv.2 | Mo Li Hua, Jasmine Flower (China, traditional)",
      ja: "Lv.2｜茉莉花(中国民謡)",
    },
  },
  {
    id: "folk_amazing_grace", file: "songs/folk_amazing_grace.json", level: 2,
    labels: {
      en: "Lv.2 | Amazing Grace (New Britain tune, traditional)",
      ja: "Lv.2｜アメイジング・グレイス(伝承曲)",
    },
  },
  {
    id: "folk_o_tannenbaum", file: "songs/folk_o_tannenbaum.json", level: 2,
    labels: {
      en: "Lv.2 | O Tannenbaum (Germany, traditional)",
      ja: "Lv.2｜もみの木(ドイツ民謡)",
    },
  },
  {
    id: "folk_auld_lang_syne", file: "songs/folk_auld_lang_syne.json", level: 2,
    labels: {
      en: "Lv.2 | Auld Lang Syne (Scotland, traditional)",
      ja: "Lv.2｜蛍の光 オールド・ラング・サイン(スコットランド民謡)",
    },
  },
  {
    id: "practice_drill_lv3", file: "songs/practice_drill_lv3.json", level: 3,
    labels: {
      en: "Lv.3 | Black keys and chords: a first drill",
      ja: "Lv.3｜黒鍵と和音の入門ドリル",
    },
  },
  {
    id: "ode_to_joy", file: "songs/ode_to_joy.json", level: 3,
    labels: {
      en: "Lv.3 | Beethoven - Ode to Joy (from Symphony No. 9)",
      ja: "Lv.3｜ベートーヴェン 歓喜の歌(第九より)",
    },
  },
  {
    id: "folk_arirang", file: "songs/folk_arirang.json", level: 3,
    labels: {
      en: "Lv.3 | Arirang (Korea, traditional)",
      ja: "Lv.3｜アリラン(韓国民謡)",
    },
  },
  {
    id: "folk_la_cucaracha", file: "songs/folk_la_cucaracha.json", level: 3,
    labels: {
      en: "Lv.3 | La Cucaracha (Mexico, traditional)",
      ja: "Lv.3｜ラ・クカラチャ(メキシコ民謡)",
    },
  },
  {
    id: "folk_shchedryk", file: "songs/folk_shchedryk.json", level: 3,
    labels: {
      en: "Lv.3 | Shchedryk (Ukraine, traditional)",
      ja: "Lv.3｜シチェドリク(ウクライナ民謡)",
    },
  },
  {
    id: "folk_londonderry_air", file: "songs/folk_londonderry_air.json", level: 3,
    labels: {
      en: "Lv.3 | Londonderry Air (Ireland, traditional)",
      ja: "Lv.3｜ロンドンデリーの歌(アイルランド民謡)",
    },
  },
  {
    id: "tchaikovsky_old_french_song", file: "songs/tchaikovsky_old_french_song.json", level: 3,
    labels: {
      en: "Lv.3 | Tchaikovsky - Old French Song (Album for the Young)",
      ja: "Lv.3｜チャイコフスキー 古いフランスの歌(子供のアルバム)",
    },
  },
  {
    id: "gymnopedie1", file: "songs/gymnopedie1.json", level: 4,
    labels: {
      en: "Lv.4 | Satie - Gymnopedie No. 1",
      ja: "Lv.4｜サティ ジムノペディ第1番",
    },
  },
  {
    id: "gymnopedie2", file: "songs/gymnopedie2.json", level: 4,
    labels: {
      en: "Lv.4 | Satie - Gymnopedie No. 2",
      ja: "Lv.4｜サティ ジムノペディ第2番",
    },
  },
  {
    id: "gymnopedie3", file: "songs/gymnopedie3.json", level: 4,
    labels: {
      en: "Lv.4 | Satie - Gymnopedie No. 3",
      ja: "Lv.4｜サティ ジムノペディ第3番",
    },
  },
  {
    id: "tchaikovsky_morning_prayer", file: "songs/tchaikovsky_morning_prayer.json", level: 4,
    labels: {
      en: "Lv.4 | Tchaikovsky - Morning Prayer (Album for the Young)",
      ja: "Lv.4｜チャイコフスキー 朝の祈り(子供のアルバム)",
    },
  },
  {
    id: "chopin_prelude_op28_7", file: "songs/chopin_prelude_op28_7.json", level: 4,
    labels: {
      en: "Lv.4 | Chopin - Prelude Op. 28 No. 7",
      ja: "Lv.4｜ショパン 前奏曲 Op.28-7",
    },
  },
  {
    id: "chopin_prelude_op28_20", file: "songs/chopin_prelude_op28_20.json", level: 4,
    labels: {
      en: "Lv.4 | Chopin - Prelude Op. 28 No. 20",
      ja: "Lv.4｜ショパン 前奏曲 Op.28-20",
    },
  },
  {
    id: "bach_polonaise_f", file: "songs/bach_polonaise_f.json", level: 4,
    labels: {
      en: "Lv.4 | Bach - Polonaise in F major",
      ja: "Lv.4｜バッハ ポロネーズ ヘ長調",
    },
  },
  {
    id: "schumann_traumerei", file: "songs/schumann_traumerei.json", level: 4,
    labels: {
      en: "Lv.4 | Schumann - Traumerei (Scenes from Childhood)",
      ja: "Lv.4｜シューマン トロイメライ(子供の情景)",
    },
  },
  {
    id: "mozart_kv331_tema", file: "songs/mozart_kv331_tema.json", level: 4,
    labels: {
      en: "Lv.4 | Mozart - Sonata K. 331, theme of the 1st movement",
      ja: "Lv.4｜モーツァルト ソナタ K.331 第1楽章 主題",
    },
  },
  {
    id: "tchaikovsky_wooden_soldiers", file: "songs/tchaikovsky_wooden_soldiers.json", level: 4,
    labels: {
      en: "Lv.4 | Tchaikovsky - March of the Wooden Soldiers (Album for the Young)",
      ja: "Lv.4｜チャイコフスキー 木の兵隊の行進曲(子供のアルバム)",
    },
  },
  {
    id: "bwv846", file: "songs/bwv846.json", level: 5,
    labels: {
      en: "Lv.5 | Bach - Prelude in C, BWV 846",
      ja: "Lv.5｜バッハ 平均律第1番プレリュード BWV846",
    },
  },
  {
    id: "chopin_prelude_op28_4", file: "songs/chopin_prelude_op28_4.json", level: 5,
    labels: {
      en: "Lv.5 | Chopin - Prelude Op. 28 No. 4",
      ja: "Lv.5｜ショパン 前奏曲 Op.28-4",
    },
  },
  {
    id: "beethoven_menuett_woo82", file: "songs/beethoven_menuett_woo82.json", level: 5,
    labels: {
      en: "Lv.5 | Beethoven - Minuet in E flat, WoO 82",
      ja: "Lv.5｜ベートーヴェン メヌエット WoO 82",
    },
  },
  {
    id: "bach_invention8", file: "songs/bach_invention8.json", level: 5,
    labels: {
      en: "Lv.5 | Bach - Invention No. 8, BWV 779",
      ja: "Lv.5｜バッハ インヴェンション第8番 BWV779",
    },
  },
  {
    id: "schubert_moments_musicaux_3", file: "songs/schubert_moments_musicaux_3.json", level: 5,
    labels: {
      en: "Lv.5 | Schubert - Moment Musical No. 3, D. 780",
      ja: "Lv.5｜シューベルト 楽興の時 第3番 D.780",
    },
  },
  {
    id: "fur_elise", file: "songs/fur_elise.json", level: 6,
    labels: {
      en: "Lv.6 | Beethoven - Fur Elise",
      ja: "Lv.6｜ベートーヴェン エリーゼのために",
    },
  },
  {
    id: "beethoven_pathetique_2", file: "songs/beethoven_pathetique_2.json", level: 6,
    labels: {
      en: "Lv.6 | Beethoven - Sonata No. 8 Pathetique, 2nd mvt",
      ja: "Lv.6｜ベートーヴェン 悲愴 第2楽章",
    },
  },
  {
    id: "joplin_entertainer", file: "songs/joplin_entertainer.json", level: 6,
    labels: {
      en: "Lv.6 | Joplin - The Entertainer",
      ja: "Lv.6｜ジョプリン ジ・エンターテイナー",
    },
  },
  {
    id: "joplin_maple_leaf_rag", file: "songs/joplin_maple_leaf_rag.json", level: 6,
    labels: {
      en: "Lv.6 | Joplin - Maple Leaf Rag",
      ja: "Lv.6｜ジョプリン メイプルリーフ・ラグ",
    },
  },
  {
    id: "clair_de_lune", file: "songs/clair_de_lune.json", level: 7,
    labels: {
      en: "Lv.7 | Debussy - Clair de Lune",
      ja: "Lv.7｜ドビュッシー 月の光",
    },
  },
  {
    id: "chopin_minute_waltz", file: "songs/chopin_minute_waltz.json", level: 7,
    labels: {
      en: "Lv.7 | Chopin - Waltz Op. 64 No. 1, Minute Waltz",
      ja: "Lv.7｜ショパン ワルツ Op.64-1 子犬のワルツ",
    },
  },
  {
    id: "chopin_fantaisie_impromptu", file: "songs/chopin_fantaisie_impromptu.json", level: 7,
    labels: {
      en: "Lv.7 | Chopin - Fantaisie-Impromptu Op. 66",
      ja: "Lv.7｜ショパン 幻想即興曲 Op.66",
    },
  },
].sort((a, b) => a.level - b.level);
const SONG_STORAGE_KEY = "pianoTypingGame.songId";
const INTRO_SONG_ID = "ode_to_joy"; // SPEC_I18N_ONBOARDING §3.3 イントロ素材

// カタログ表示名。labels(多言語)を正とし、無い場合は旧label、最後に曲JSONのtitleへ落とす。
function songLabel(entry, fallbackTitle) {
  if (!entry) return fallbackTitle || "";
  if (entry.labels) return entry.labels[getLang()] || entry.labels.en || fallbackTitle || entry.id;
  return entry.label || fallbackTitle || entry.id;
}

// SPEC_SONGS_INTRO WP1-6: 確認表示に添える曲名。カタログのラベルから
// 先頭の "Lv.N |" / "Lv.N｜" を落として曲名だけにする。
function songDisplayName(entry, fallbackTitle) {
  const label = songLabel(entry, fallbackTitle);
  return label.replace(/^\s*Lv\.\d+\s*[|｜]\s*/, "");
}

// SPEC §23: 私的利用曲(songs_private/、配布対象外)。索引が無ければ空扱い。
const PRIVATE_SONG_INDEX = "songs_private/index.json";

async function loadPrivateSongList() {
  try {
    const res = await fetch(PRIVATE_SONG_INDEX);
    if (!res.ok) return [];
    const list = await res.json();
    if (!Array.isArray(list)) return [];
    return list
      .filter((s) => s && s.id && s.file)
      .map((s) => ({
        ...s,
        label: `${s.level != null ? `Lv.${s.level}` : "Lv.?"}｜${s.label || s.id}`,
        isPrivate: true,
      }));
  } catch (e) {
    return [];
  }
}

async function loadSong(file) {
  const res = await fetch(file);
  if (!res.ok) {
    throw new Error(t("error.songFetch", { file, status: res.status }));
  }
  return res.json();
}

// SPEC_I18N_ONBOARDING §3.3: イントロ譜面は新規JSONを作らず、既存曲の先頭N音を
// 実行時に切り出して使う(positionsはloadSongIntoStateで再計算される)。
function makeFragment(song, count) {
  const source = Array.isArray(song.events) ? song.events : [];
  const n = Math.max(0, Math.min(count, source.length));
  const events = source.slice(0, n).map((ev, i) => (i === 0 ? { ...ev, onsetDeltaRatio: 0 } : { ...ev }));
  return { ...song, events, eventCount: events.length };
}

// 曲データを進行状態へ流し込む(取得・カタログ表示とは分離。イントロ譜面も同じ経路を通す)。
function loadSongIntoState(songData) {
  state.song = { ...songData, events: applyChordMode(songData.events, state.chordMode) }; // SPEC §21.1
  state.currentEventIndex = 0;
  state.heldCodes.clear();
  state.satisfiedCodes.clear();
  state.freshPressInEvent = false;
  state.tempoSamples = [];
  state.lastOnsetTime = null;
  state.scrollOffsetPx = 0;
  state.lastTickTs = null;
  state.arrivedEventIndex = -1;
  state.autoCutTimers.forEach((timerId) => clearTimeout(timerId));
  state.autoCutTimers.clear();

  // 累積発音位置の再計算(§14.2)
  let acc = 0;
  state.positions = state.song.events.map((ev, i) => {
    if (i > 0) acc += ev.onsetDeltaRatio;
    return acc;
  });

  if (els.guideTrack) els.guideTrack.style.transform = "translateX(0px)";
  refreshGuideHighlight();
  refreshProgressUI();
  renderGuideStrip();
}

// SPEC §18.2: 曲切替。進行状態・テンポ推定・ガイド帯スクロールをすべてリセットして先頭から。
async function selectSong(songId) {
  const catalog = state.songCatalog || SONG_LIST;
  const entry = catalog.find((s) => s.id === songId) || catalog[0];
  let song;
  try {
    song = await loadSong(entry.file);
  } catch (err) {
    showError(err.message);
    return;
  }

  state.rawSongData = song;
  state.currentSongId = entry.id;
  loadSongIntoState(song);
  refreshSongTexts();
}

// カタログ由来の曲名とライセンス表記。言語切替でも呼び直す(演奏状態は触らない)。
function refreshSongTexts() {
  const song = state.rawSongData;
  if (!song) return;
  const catalog = state.songCatalog || SONG_LIST;
  const entry = catalog.find((s) => s.id === state.currentSongId);
  els.title.textContent = songLabel(entry, song.title);
  els.license.textContent = t("song.credit", { source: song.sourceUrl, license: song.license });
}

// 曲選択の選択肢を(再)構築する。言語切替でも呼び直すため、選択中の曲は維持する。
function refreshSongSelectTexts() {
  const selectEl = document.getElementById("song-select");
  if (!selectEl) return;
  const catalog = state.songCatalog || SONG_LIST;
  const keep = selectEl.value;
  selectEl.innerHTML = "";

  const builtinGroup = document.createElement("optgroup");
  builtinGroup.label = t("song.group.builtin");
  catalog.filter((s) => !s.isPrivate).forEach((s) => {
    const opt = document.createElement("option");
    opt.value = s.id;
    opt.textContent = songLabel(s);
    builtinGroup.appendChild(opt);
  });
  selectEl.appendChild(builtinGroup);

  const privateSongs = catalog.filter((s) => s.isPrivate);
  if (privateSongs.length > 0) {
    // SPEC §23: 私的利用曲は別グループで区別表示(配布対象外であることを常に意識させる)
    const privateGroup = document.createElement("optgroup");
    privateGroup.label = t("song.group.private");
    privateSongs.forEach((s) => {
      const opt = document.createElement("option");
      opt.value = s.id;
      opt.textContent = songLabel(s);
      privateGroup.appendChild(opt);
    });
    selectEl.appendChild(privateGroup);
  }

  if (keep && catalog.some((s) => s.id === keep)) selectEl.value = keep;
}

function initSongSelect(privateSongs) {
  const selectEl = document.getElementById("song-select");
  if (!selectEl) return;
  state.songCatalog = [...SONG_LIST, ...privateSongs];

  refreshSongSelectTexts();

  let saved = null;
  try {
    saved = localStorage.getItem(SONG_STORAGE_KEY);
  } catch (e) {
    // localStorage不可なら既定曲
  }
  const initial = state.songCatalog.some((s) => s.id === saved) ? saved : SONG_LIST[0].id;
  selectEl.value = initial;

  selectEl.addEventListener("change", () => {
    try {
      localStorage.setItem(SONG_STORAGE_KEY, selectEl.value);
    } catch (e) {
      // 保存できなくても動作は継続
    }
    selectSong(selectEl.value);
    selectEl.blur(); // 演奏キーがフォーム部品に飛ばないようフォーカスを外す
  });
  return initial;
}

// --- SPEC_I18N_ONBOARDING §2.4 言語切替UI ------------------------------------

// 言語切替では演奏状態(曲・進捗・テンポ推定)を一切リセットしない。文言だけ差し替える。
function applyLanguage(lang, options) {
  setLang(lang, options);
  document.querySelectorAll(".lang-button").forEach((btn) => {
    const isCurrent = btn.dataset.lang === getLang();
    btn.classList.toggle("is-current", isCurrent);
    btn.disabled = isCurrent; // 選択中は非活性表示
    btn.setAttribute("aria-pressed", isCurrent ? "true" : "false");
  });
  refreshSongSelectTexts();
  refreshSongTexts();
  refreshProgressUI();
  updateTempoEstimateText();
}

function initLangSwitch() {
  document.querySelectorAll(".lang-button").forEach((btn) => {
    btn.addEventListener("click", () => {
      applyLanguage(btn.dataset.lang, { persist: true });
      btn.blur(); // 演奏キーがフォーム部品に吸われないよう必ずフォーカスを外す
    });
  });
}

// --- SPEC_I18N_ONBOARDING §4 段階開示 ----------------------------------------

// details/summaryはキーボード(Tab+Enter/Space)だけで開閉できる。
// マウス操作で開いた場合だけフォーカスを外し、演奏キーがsummaryに残らないようにする
// (キーボード操作時にblurすると操作位置を失うため、ポインタ由来のときだけ外す)。
function initFolds() {
  document.querySelectorAll("details.fold > summary").forEach((summary) => {
    let fromPointer = false;
    summary.addEventListener("mousedown", () => {
      fromPointer = true;
    });
    summary.addEventListener("touchstart", () => {
      fromPointer = true;
    }, { passive: true });
    summary.parentElement.addEventListener("toggle", () => {
      if (fromPointer) {
        summary.blur();
        fromPointer = false;
      }
    });
  });
}

// --- SPEC_I18N_ONBOARDING §3 最初の30秒 --------------------------------------

const ONBOARDED_STORAGE_KEY = "ptg.onboarded";
// SPEC_SONGS_INTRO WP1-3: 直前のイントロ曲を覚えておき、次回はそれを候補から外す。
const LAST_INTRO_STORAGE_KEY = "ptg.lastIntro";
const INTRO_NOTE_COUNT = 4;
const INTRO_CONFIRM_MS = 2200;

function isOnboarded() {
  try {
    return localStorage.getItem(ONBOARDED_STORAGE_KEY) === "1";
  } catch (e) {
    return false; // localStorage不可の環境では毎回イントロを出す(害はない)
  }
}

function markOnboarded() {
  try {
    localStorage.setItem(ONBOARDED_STORAGE_KEY, "1");
  } catch (e) {
    // 保存できなくても動作は継続
  }
}

// SPEC_SONGS_INTRO WP1-2/3: 公開曲(私的利用曲は除く)から毎回ランダムに1曲選ぶ。
// 直前と同じ曲は候補から外す(候補が尽きる場合のみ許す)。
function readLastIntroId() {
  try {
    return localStorage.getItem(LAST_INTRO_STORAGE_KEY);
  } catch (e) {
    return null;
  }
}

function rememberIntroId(songId) {
  try {
    localStorage.setItem(LAST_INTRO_STORAGE_KEY, songId);
  } catch (e) {
    // 保存できなくても動作は継続(その場合は直前除外が効かないだけ)
  }
}

function pickIntroEntry() {
  const lastId = readLastIntroId();
  let candidates = SONG_LIST.filter((s) => s.id !== lastId);
  if (candidates.length === 0) candidates = SONG_LIST.slice();
  return candidates[Math.floor(Math.random() * candidates.length)];
}

// イントロ中は設定・凡例・説明・曲選択・譜面帯を伏せ、鍵盤と最小限の合図だけを見せる。
async function startIntro() {
  let song;
  let entry = pickIntroEntry();
  try {
    song = await loadSong(entry.file);
  } catch (err) {
    // 抽選した曲が読めない場合は既定素材(歓喜の歌)で1回だけ再試行する
    entry = SONG_LIST.find((s) => s.id === INTRO_SONG_ID) || SONG_LIST[0];
    try {
      song = await loadSong(entry.file);
    } catch (err2) {
      // それも読めない場合は通常UIへ素通し(着地規則だけは守る)
      applyIntroLanding(state.introFirstVisit);
      return;
    }
  }
  rememberIntroId(entry.id);
  state.introPieceName = songDisplayName(entry, song.title);

  state.introActive = true;
  state.introEnding = false;
  state.savedAssistMode = state.assistMode;
  state.savedChordMode = state.chordMode;
  state.assistMode = "full"; // §3.3 イントロ中は補助full・和音melody固定
  state.chordMode = "melody";

  document.body.classList.add("intro-mode");
  if (els.introCue) els.introCue.hidden = false;
  loadSongIntoState(makeFragment(song, INTRO_NOTE_COUNT));
}

// completed=true(4音弾き切り)のときだけ確認表示を挟む。Esc・失敗時は即座に抜ける。
function endIntro(completed) {
  if (!state.introActive || state.introEnding) return;
  state.introEnding = true;
  if (completed && els.introConfirm) {
    // WP1-6: 弾き終えてから初めて曲名を明かす
    if (els.introConfirmPiece) {
      els.introConfirmPiece.textContent = state.introPieceName
        ? t("intro.wasPiece", { title: state.introPieceName })
        : "";
    }
    els.introConfirm.hidden = false;
    setTimeout(finishIntro, INTRO_CONFIRM_MS);
  } else {
    finishIntro();
  }
}

function finishIntro() {
  state.introActive = false;
  state.introEnding = false;
  document.body.classList.remove("intro-mode");
  if (els.introCue) els.introCue.hidden = true;
  if (els.introConfirm) els.introConfirm.hidden = true;

  // イントロ中に退避したユーザー設定を戻す(和音モードは常にユーザー値へ)
  state.chordMode = state.savedChordMode !== null ? state.savedChordMode : state.chordMode;
  state.assistMode = state.savedAssistMode !== null ? state.savedAssistMode : state.assistMode;
  state.savedAssistMode = null;
  state.savedChordMode = null;
  state.introPieceName = null;

  applyIntroLanding(state.introFirstVisit);
}

// SPEC_SONGS_INTRO WP1-5: イントロ後(スキップ・Escを含む)の着地。
// 初回訪問だけ歓喜の歌+補助fullへ誘導し、再訪では保存済みの曲・設定にそのまま戻す。
function applyIntroLanding(firstVisit) {
  markOnboarded();
  state.introFirstVisit = false;
  if (firstVisit) {
    state.assistMode = "full";
    try {
      localStorage.setItem(ASSIST_STORAGE_KEY, state.assistMode);
      localStorage.setItem(SONG_STORAGE_KEY, INTRO_SONG_ID);
    } catch (e) {
      // 保存できなくても動作は継続
    }
    syncSettingRadios();
    if (els.songSelect) els.songSelect.value = INTRO_SONG_ID;
    selectSong(INTRO_SONG_ID);
    return;
  }
  // 再訪: 曲は差し替えず、イントロ前に読み込んであったユーザーの曲へ戻す
  syncSettingRadios();
  if (state.rawSongData) loadSongIntoState(state.rawSongData);
  refreshSongTexts();
}

// 状態→ラジオの反映(イントロ終了後など、JS側から設定を変えたとき用)
function syncSettingRadios() {
  document.querySelectorAll('input[name="assist"]').forEach((input) => {
    input.checked = input.value === state.assistMode;
  });
  document.querySelectorAll('input[name="chord"]').forEach((input) => {
    input.checked = input.value === state.chordMode;
  });
  document.querySelectorAll('input[name="tempo"]').forEach((input) => {
    input.checked = input.value === state.tempoMode;
  });
}

// オーバーレイ(音声有効化のユーザー操作)。
// SPEC_SONGS_INTRO WP1-1: イントロは訪問のたびに実行する(onboardedによる出し分けは廃止)。
// onboardedは「イントロ後の着地を初回と再訪で分ける」ためだけに残す(WP1-5)。
function initStartOverlay() {
  state.introFirstVisit = !isOnboarded();
  if (els.skipIntroButton) els.skipIntroButton.hidden = false; // 毎回スキップできる

  els.startButton.addEventListener("click", () => {
    synth.ensureContext();
    els.startOverlay.classList.add("hidden");
    els.startButton.blur();
    startIntro();
  });

  if (els.skipIntroButton) {
    els.skipIntroButton.addEventListener("click", () => {
      synth.ensureContext();
      els.startOverlay.classList.add("hidden");
      els.skipIntroButton.blur();
      applyIntroLanding(state.introFirstVisit); // §3.4 + WP1-7 スキップも着地規則に従う
    });
  }
}

async function init() {
  applyLanguage(resolveLang()); // SPEC_I18N_ONBOARDING §2.1(保存は明示的な切替時のみ)
  initLangSwitch();
  initFolds();
  buildKeyboardUI();
  initAssistSelect();
  initTempoSelect();
  initChordSelect();
  const privateSongs = await loadPrivateSongList(); // SPEC §23
  const initialSongId = initSongSelect(privateSongs);
  await selectSong(initialSongId || SONG_LIST[0].id);
  if (!state.song) return; // 読み込み失敗(エラー表示済み)

  applyKeyboardLayoutLabels(); // 物理キーキャップ(JIS)の刻印に表示を合わせる
  state.rafId = requestAnimationFrame(guideScrollTick); // 時間駆動スクロール開始(§14.2)

  // SPEC §22: サンプル音源の先読み(失敗しても合成音フォールバックで動作継続)
  samplePiano.load().catch((err) => {
    console.warn(t("error.sampleLoad"), err);
  });

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  initStartOverlay();
}

init();
