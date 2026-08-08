"use strict";

// SPEC_I18N_ONBOARDING §2: 英語ファーストi18n。
// - 英語が正。日本語は既存文言をそのまま移植する。
// - 未訳キーは英語にフォールバックし、コンソール警告を出す(サイレント欠落禁止)。
// - 文言テーブルはこのファイルに閉じ込め、app.jsを肥大させない。
// - 作品名は app.title の1か所だけを変更すれば全画面に反映される({appTitle}で参照)。

const I18N = {
  en: {
    "app.title": "Keynata",
    "app.eyebrow": "Play piano by typing",
    "app.tagline": "Your keyboard is the piano. Your typing is the tempo.",
    "app.subtitle":
      "Trace a piece on your keyboard. Tempo, timing and note length all follow your own typing.",

    "lang.label": "Language",
    "lang.en": "EN",
    "lang.ja": "日本語",

    "overlay.play": "Play",
    "overlay.playHint": "Turns the sound on",
    "overlay.skip": "Skip intro",

    "intro.cue": "Play the keys that light up. Four notes, no rush.",
    "intro.progress": "{done} / {total}",
    "intro.done": "That was you playing.",
    "intro.wasPiece": "That was the opening of {title}.",

    "song.select": "Choose a piece",
    "song.now": "Piece",
    "song.loading": "Loading...",
    "song.group.builtin": "Pieces",
    "song.group.aiComposed": "AI Composed (Keynata Commons)",
    "song.group.private": "Private use only (not distributed)",
    "song.credit": "Source: {source} / License: {license}",

    "progress.label": "Progress",
    "progress.complete": "{done} / {total} (complete)",

    "legend.next": "Next key to press (blue frame, light rising from below)",
    "legend.ready": "Light is full and pulsing: press now",
    "legend.held": "Held down (release when the sweep reaches the far edge)",

    "settings.summary": "Settings",

    "assist.title": "Assist (difficulty):",
    "assist.full": "Full assist (easy) — note length is automatic. Just focus on when to press",
    "assist.standard": "Standard — only long notes are cut for you. Short staccato is yours",
    "assist.none": "No assist (advanced) — press and release are both yours. Full freedom",

    "tempo.title": "Guide tempo:",
    "tempo.auto": "Your tempo — estimated from your typing (the guide follows if you bend it)",
    "tempo.original": "Original tempo — fixed to the score (to learn the real speed)",

    "chord.title": "Chords (how thick the score is):",
    "chord.melody": "Melody only — chords thinned to the top note. One hand, one key at a time",
    "chord.melodyBass": "Melody + bass — top and bottom notes, at most two keys",
    "chord.full": "Full chords — exactly as written",

    "guide.header":
      "Rhythm preview (the strip flows at your tempo; a block reaching the left line is the moment to press. Colors match the keyboard rows)",
    "tempo.estimate.value": "{label}: quarter note = {bpm}",
    "tempo.estimate.original": "Original tempo (fixed)",
    "tempo.estimate.estimated": "Your tempo",
    "tempo.estimate.default": "Default tempo (provisional)",

    "howto.summary": "How to play",
    "howto.p1":
      "Only three things: <strong>(1) press the key with the blue frame (2) press when the blue light inside it has filled up and started to pulse (3) release around the time the sweep reaches the right edge (how release is handled depends on the Assist setting).</strong> The strip at the top previews the rhythm; you can play from the keyboard alone.",
    "howto.p2":
      "If in doubt, start with Full assist. Pressing in time is enough to make music. Move on to Standard (practising release) and then No assist (full freedom).",
    "howto.p3":
      "The tempo is not a metronome: it is estimated from your recent typing. Play fast and the guide moves fast, play slowly and it waits. Every guide is a hint only, and ignoring it never affects progress. Mapped keys always sound, even wrong ones, but the piece only advances on the right key.",
    "howto.p4":
      "Chords do not need to be simultaneous: press the required keys one after another and the chord counts (rolled playing). Some keyboards cannot register three or more keys at once, so if a chord will not go through, roll it quickly.",

    "credit.audio": "Audio: Salamander Grand Piano by Alexander Holm (CC-BY 3.0)",

    "error.songFetch":
      "Could not load {file} (HTTP {status}). Reload the page to try again. If you opened this file directly from disk, serve it over a local server instead (see README.md).",
    "error.sampleFetch": "Could not fetch samples/{name}.mp3 (HTTP {status})",
    "error.sampleLoad": "Failed to load the sampled piano. Falling back to the synthesized tone:",
  },

  ja: {
    "app.title": "Keynata",
    "app.eyebrow": "タイピングでピアノを弾く",
    "app.tagline": "キーボードがピアノになる。テンポはあなたのタイピング。",
    "app.subtitle":
      "キーボードで曲をなぞって演奏する。テンポ・間・音の長さは自分のタイピングに従う。",

    "lang.label": "言語",
    "lang.en": "EN",
    "lang.ja": "日本語",

    "overlay.play": "はじめる",
    "overlay.playHint": "音声を有効化します",
    "overlay.skip": "イントロを飛ばす",

    "intro.cue": "光ったキーを押してください。4音だけです。",
    "intro.progress": "{done} / {total}",
    "intro.done": "いまのは、あなたの演奏です。",
    "intro.wasPiece": "いまのは{title}の冒頭です。",

    "song.select": "曲を選ぶ",
    "song.now": "曲",
    "song.loading": "読み込み中...",
    "song.group.builtin": "収録曲",
    "song.group.aiComposed": "AI作曲 (Keynata Commons)",
    "song.group.private": "私的利用曲(配布不可)",
    "song.credit": "出典: {source} / ライセンス: {license}",

    "progress.label": "進捗",
    "progress.complete": "{done} / {total} (完奏)",

    "legend.next": "次に押すキー(青枠・下から光が満ちる)",
    "legend.ready": "満ちきって脈動=今が押す瞬間",
    "legend.held": "押鍵中(塗りが端まで届いたら離す)",

    "settings.summary": "設定",

    "assist.title": "補助(難易度):",
    "assist.full": "フル補助(かんたん) — 音の長さは全自動。押すタイミングだけに集中",
    "assist.standard": "標準 — 長押しだけ自動で切る。早めに離すスタッカートは自由",
    "assist.none": "補助なし(上級) — 押す・離すの両方が自分の手。完全な表現の自由",

    "tempo.title": "ガイドのテンポ:",
    "tempo.auto": "自分のテンポ — あなたのタイピングから自動推定(揺らせばガイドも追従)",
    "tempo.original": "原曲テンポ — 楽譜の速さに固定(原曲の速さを体で覚える練習用)",

    "chord.title": "和音(譜面の厚さ):",
    "chord.melody": "旋律のみ — 和音を最高音1音に間引く。完全片手・単音の譜面になる",
    "chord.melodyBass": "旋律+バス — 最高音と最低音の最大2音。和音の響きを残しつつ楽に",
    "chord.full": "フル和音 — 楽譜のまま(原曲どおり)",

    "guide.header":
      "リズム先読み(帯はあなたのテンポで流れ、ブロックが左端の線に着いた瞬間=押す瞬間。色は鍵盤の段と対応)",
    "tempo.estimate.value": "{label}: 四分音符={bpm}",
    "tempo.estimate.original": "原曲テンポ(固定)",
    "tempo.estimate.estimated": "推定テンポ",
    "tempo.estimate.default": "既定テンポ(仮)",

    "howto.summary": "遊び方",
    "howto.p1":
      "遊び方は3つだけ: <strong>(1) 青枠のキーを押す (2) 押すタイミングは、キーの中を下から満ちる青い光が満ちきって脈動した瞬間 (3) 離すのは塗りが右端に届いた頃(離し方の扱いは「設定」の補助で選べます)。</strong>上部の帯は先のリズムの予告で、見なくても鍵盤だけで演奏できます。",
    "howto.p2":
      "迷ったらフル補助から始めてください。押すタイミングだけで曲になります。慣れたら標準(離す表現の練習)→補助なし(完全な自由)へ進むのがおすすめです。",
    "howto.p3":
      "テンポはメトロノームではなく、あなたの直近のタイピングから自動で推定されます。速く弾けばガイドも速く、ゆっくり弾けばガイドもゆっくりになります。ガイドはすべて目安の表示で、無視して自由に演奏しても進行判定には影響しません。マッピングされたキーは(間違ったキーでも)常に音が鳴りますが、曲は正しいキーを押すまで進みません。",
    "howto.p4":
      "和音は同時押しでなくても、必要なキーを順に押せば成立します(ロール奏法)。キーボードによっては3キー以上の同時押しが物理的に認識されない組合せがあるため、和音がうまく入らないときは素早くばらして押してください。",

    "credit.audio": "音源: Salamander Grand Piano by Alexander Holm (CC-BY 3.0)",

    "error.songFetch":
      "{file} の取得に失敗しました(HTTP {status})。 ローカルサーバー経由で開いていますか？ README.md参照。",
    "error.sampleFetch": "samples/{name}.mp3 の取得に失敗(HTTP {status})",
    "error.sampleLoad": "サンプル音源の読み込みに失敗。合成音で動作します:",
  },
};

const LANG_STORAGE_KEY = "ptg.lang";
const SUPPORTED_LANGS = ["en", "ja"];
let currentLang = "en";
const warnedKeys = new Set();

// SPEC §2.1 優先順: ?lang= > localStorage > navigator.language(ja) > 既定en
function resolveLang() {
  let fromQuery = null;
  try {
    fromQuery = new URLSearchParams(window.location.search).get("lang");
  } catch (e) {
    // URLSearchParams非対応環境では無視
  }
  if (SUPPORTED_LANGS.includes(fromQuery)) return fromQuery;

  let saved = null;
  try {
    saved = localStorage.getItem(LANG_STORAGE_KEY);
  } catch (e) {
    // localStorage不可なら次の優先度へ
  }
  if (SUPPORTED_LANGS.includes(saved)) return saved;

  const nav = (navigator.language || "").toLowerCase();
  if (nav.startsWith("ja")) return "ja";
  return "en";
}

function getLang() {
  return currentLang;
}

// 文言の取得。未訳キーは英語へフォールバックし、必ず警告する(サイレント欠落禁止)。
// {appTitle} は常に現在言語の作品名へ展開する(作品名の変更点を1か所に保つ)。
function t(key, vars) {
  const table = I18N[currentLang] || I18N.en;
  let text = table[key];
  if (text === undefined) {
    text = I18N.en[key];
    const warnKey = `${currentLang}:${key}`;
    if (!warnedKeys.has(warnKey)) {
      warnedKeys.add(warnKey);
      if (text === undefined) {
        console.warn(`[i18n] unknown key: ${key}`);
      } else {
        console.warn(`[i18n] missing ${currentLang} translation, using en: ${key}`);
      }
    }
    if (text === undefined) return key;
  }
  const appTitle = table["app.title"] || I18N.en["app.title"];
  const all = Object.assign({ appTitle }, vars || {});
  return text.replace(/\{(\w+)\}/g, (m, name) => (all[name] !== undefined ? String(all[name]) : m));
}

// data-i18n(テキスト)・data-i18n-html(既知のマークアップを含む文言)・
// data-i18n-attr="属性:キー[,属性:キー]"(属性文言)を一括適用する。
function applyI18n(root) {
  const scope = root || document;
  scope.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  scope.querySelectorAll("[data-i18n-html]").forEach((el) => {
    el.innerHTML = t(el.dataset.i18nHtml);
  });
  scope.querySelectorAll("[data-i18n-attr]").forEach((el) => {
    el.dataset.i18nAttr.split(",").forEach((pair) => {
      const sep = pair.indexOf(":");
      if (sep === -1) return;
      const attr = pair.slice(0, sep).trim();
      const key = pair.slice(sep + 1).trim();
      if (attr && key) el.setAttribute(attr, t(key));
    });
  });
}

// 和文書体は日本語表示のときだけ読み込む(英語圏の初回表示を軽くするため。
// 和文フォントはラテン系より桁違いに重く、既定=英語では不要)。
const JA_FONT_URL =
  "https://fonts.googleapis.com/css2?family=Zen+Old+Mincho:wght@500;700&family=Zen+Kaku+Gothic+New:wght@400;500;700&display=swap";
let jaFontsRequested = false;

function ensureFontsForLang(lang) {
  if (lang !== "ja" || jaFontsRequested) return;
  jaFontsRequested = true;
  try {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = JA_FONT_URL;
    document.head.appendChild(link);
  } catch (e) {
    // 読み込めなくてもOS内蔵の和文書体にフォールバックする
  }
}

// 言語を確定して<html lang>とDOM文言を更新する。保存は明示的な切替のときだけ行う。
function setLang(lang, options) {
  const opts = options || {};
  currentLang = SUPPORTED_LANGS.includes(lang) ? lang : "en";
  document.documentElement.setAttribute("lang", currentLang);
  ensureFontsForLang(currentLang);
  if (opts.persist) {
    try {
      localStorage.setItem(LANG_STORAGE_KEY, currentLang);
    } catch (e) {
      // 保存できなくても動作は継続
    }
  }
  applyI18n(document);
  return currentLang;
}
