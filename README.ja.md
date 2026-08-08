# Keynata(ピアノタイピングゲーム)

**キーボードがピアノになる。テンポはあなたのタイピングが決める。**

英語版(正本): [README.md](README.md) / このファイルは日本語版。

作品名は Keynata(key + sonata の造語)。UIの表示名は `i18n.js` の `app.title` 1か所で管理する。

PCキーボードの各キーをピアノの音階に固定マッピングし、既存曲の「正解キー列」をタイピングでなぞって演奏する。メトロノームは無く、テンポ・間・音の長さはすべて演奏者のタイピングそのものに従う。設計書(`SPEC.md` / `SONGS.md` ほか)は作者のローカルのノートを正本としており、このリポジトリには含めていない。

開発はAIエージェント(Claude Code)との協働で行い、設計判断と検証は作者が担っている。

## 構成

```
keynata/
  index.html          ブラウザアプリのエントリーポイント
  i18n.js             文言テーブル(en/ja)と言語決定・適用ロジック
  app.js              キー入力処理・Web Audio合成・進行判定
  style.css           見た目
  songs/*.json        前処理済みの曲データ(生成物、公開曲47曲=人手収録37曲+AI作曲10曲)
  samples/*.mp3       Salamander Grand Piano のサンプル音源
  tools/
    preprocess_midi.py       MIDI -> 曲データJSON 変換スクリプト
    make_practice_song*.py   自作の練習譜面MIDI生成
    make_ode_to_joy.py       歓喜の歌の自作編曲MIDI生成
    make_world_folk.py       世界の民謡の自作編曲MIDI生成(10曲・CC0)
    build_site.py            公開ビルド(dist/を生成・検証ゲート5項目)
    source_midi/              元MIDIファイル置き場
  .github/workflows/pages.yml  ビルドしてGitHub Pagesへデプロイ
  venv/                前処理スクリプト用のPython仮想環境(mido)
```

## 曲データの前処理(再生成する場合)

初回セットアップ(既に実施済み。venvは同梱していないので新しい環境では再作成する):

```bash
cd keynata
python3 -m venv venv
./venv/bin/pip install mido
```

生成コマンド:

```bash
./venv/bin/python tools/preprocess_midi.py \
  tools/source_midi/bwv846_prelude1_mutopia.mid \
  songs/bwv846.json \
  --title "平均律クラヴィーア曲集第1巻 前奏曲第1番 ハ長調 BWV846" \
  --composer "Johann Sebastian Bach" \
  --source-url "https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=5" \
  --license "Public Domain / CC0 (Mutopia Project)"
```

同時和音が6音を超える場合、またはオクターブ補正しても音域(C3〜G#6)に収まらない音がある場合はエラーで停止する(SPEC.md §4・§7・§9)。

BWV846では、実測でMIDIノート36(C2)〜81(A5)の範囲があり、C3(48)未満の30イベント分の音を個別に1オクターブ上へ補正している(全体移調ではなく音ごとの個別補正。理由はSPEC.mdの「実装からの質問」1を参照)。補正箇所は生成されたJSONの`octaveAdjustedNotes`配列で確認できる。

### 音源(SPEC §22)

`samples/` に Salamander Grand Piano(Alexander Holm 制作、CC-BY 3.0)のサンプル17ファイル(短3度間隔、C3〜C7、Tone.jsプロジェクト配布のmp3版 https://tonejs.github.io/audio/salamander/ より取得)を同梱。最寄りサンプルからのピッチシフトで全音域をカバーする。読み込み完了前・失敗時は従来のオシレータ合成音にフォールバックする。帰属表示はアプリ画面下部に記載。

### 初心者用練習譜面(SPEC §18)

`tools/make_practice_song.py` が自作の練習MIDI(ハ長調C4〜C5・単音のみ・四分音符=75)を生成する。構成は 5音の階段 → 1オクターブの階段 → アルペジオ → きらきら星(PD民謡)。使用キーは8個(D・G・J・K・;・Q・E・R)でホームポジション周辺に収まる。ライセンスはCC0相当(自作)。再生成手順はスクリプト冒頭のdocstringを参照。曲は画面の「曲を選ぶ」から切替できる。

## 遊び方・起動方法

オンライン版はGitHub Pagesで公開する(URLは公開後にここへ追記する)。

ローカルで動かす場合は静的ファイルサーバーがあればよい。曲データを`fetch`で読み込むため、`file://`での直接オープンでは動かない。

```bash
git clone https://github.com/carf-coder/keynata.git
cd keynata
python3 -m http.server 8000
# ブラウザで http://localhost:8000 を開く
```

画面中央の `Play`(日本語では「はじめる」)ボタンを押すとWeb Audioが有効化される(ブラウザの自動再生制限のため、ユーザー操作が必要)。そのままイントロ(下記)に入る。

物理キーボードのあるデスクトップブラウザが必要。スマートフォン・タブレットでは表示はできるが演奏はできない。

## 英語ファーストi18nと最初の30秒(SPEC_I18N_ONBOARDING)

設計の正本は作者のローカルノート(このリポジトリには含めない)。

- **言語**: 既定は英語。決定の優先順は `?lang=en|ja` > localStorage `ptg.lang` > `navigator.language` が `ja` で始まる > 英語。マストヘッド右上の `EN / 日本語` で切替でき、切替しても演奏中の曲・進捗はリセットされない。
- **文言**: すべて `i18n.js` の `I18N` テーブルに置き、HTML側は `data-i18n="キー"`(テキスト)・`data-i18n-html="キー"`(既知のマークアップを含む文言)・`data-i18n-attr="属性:キー"`(属性)で紐付ける。未訳キーは英語へフォールバックし、コンソールに警告を出す。作品名は `app.title` の1か所だけを変えれば全画面に反映される(他の文言からは `{appTitle}` で参照)。
- **曲名**: 表示名は `app.js` の `SONG_LIST[].labels.{en,ja}` を正とし、曲JSONの `title` はフォールバック。曲JSONは変更していない。
- **最初の30秒**: `Play` の直後に、収録曲から実行時に切り出した先頭4音のイントロ譜面(`makeFragment()`。新規JSONは作らない)へ入る。この間は設定・説明・凡例・曲選択・譜面帯を伏せ、鍵盤と一行の合図だけを見せる。詳細は下の「毎回変わるイントロ」を参照。
- **段階開示**: 3群の設定と5段落の説明は既定で閉じた `<details>` に入っている。常時見えるのは曲選択・進捗・鍵盤・譜面帯・凡例・ライセンス表記(音源クレジットは折りたたみの外・フッタに固定)。

## 毎回変わるイントロ(SPEC_SONGS_INTRO WP1)

設計の正本は作者のローカルノート(このリポジトリには含めない)。

- イントロは**訪問のたびに**実行する。素材は公開曲(`SONG_LIST`。私的利用曲は除外)から実行時にランダムで1曲選び、その先頭4音を切り出す。
- 直前に使った曲IDを localStorage `ptg.lastIntro` に保存し、次回の抽選から除外する(候補が1曲しかない場合を除く)。
- イントロ中は和音`melody`・補助`full`固定なので、どの曲を引いても単音4音になる。曲名はイントロ中は伏せる。
- 弾き切ると `That was you playing.` に続けて `That was the opening of {title}.`(ja: `いまのは{title}の冒頭です。`)を約2.2秒表示する。
- イントロ後の着地は訪問種別で分ける。**初回訪問**(localStorage `ptg.onboarded` が無い)は歓喜の歌+補助`full`へ着地して `ptg.onboarded=1` を立てる。**再訪**は保存済みの曲・補助・和音・テンポ設定にそのまま戻す(曲を勝手に差し替えない)。
- `Skip intro`・Escでも同じ着地規則に従う。

## 操作方法

- 画面のガイド表示(青枠)が「次に押すべきキー」。
- マッピングされたキーはガイドと無関係に常に音が鳴る(誤打鍵も鳴る。SPEC.md §6)。ただし曲の進行(次のガイドに進む)は正解キーが押されたときだけ発生する。
- 和音はガイドに表示された複数キーを同時に押している状態で成立する。
- キーを押している間、音が伸びる。keyupで音が止まる(短いリリースエンベロープ付き)。テンポ・間・音の長さはすべて自分のタイピングに従う(SPEC.md §2)。

## 音価・休符ガイド(v0.1、SPEC.md §13)

鍵盤の上に「ピアノロール型ガイド帯」を表示する。

- 左端の縦線が「今」を示す固定の再生線。これから弾くイベントがブロックとして右側に並ぶ(和音は縦に積む)。ブロックの横幅は音価比(`durationRatio`)、ブロック間の間隔は前の音からの待ち時間比(`onsetDeltaRatio`)に比例する。休符はブロック間の空白としてそのまま見える。
- ガイド帯は時計駆動ではなく、正解キーが揃ってイベントが消化されるたびに進む(v0の進行判定と同じモデル)。
- **テンポは固定しない。メトロノームは存在しない。** 直近4回分の「実際の打鍵間隔 ÷ onsetDeltaRatio」の移動平均から、そのときどきの「四分音符1個分の秒数」を推定し、ガイドの速さに反映する。演奏開始直後でサンプルが足りない間は仮の既定テンポ(四分音符=60相当)を使う。プレイヤーがテンポを揺らせば、ガイドもそれに追従する。
- 正解キーを押すと、推定テンポ×その音の音価比を目標保持時間として、再生線の直後に充填(塗り)アニメーションが表示される。塗り切ったタイミングが「そろそろ離してよい」目安。早く離せばスタッカート、伸ばせばレガートになり、どちらも許容される(実際の発音の長さはあくまでkeydown〜keyupの保持時間そのものに従う。ガイドは表示のみで、音を強制的に止めたり、保持の正確さを採点したりはしない)。
- 次のイベントが「再生線に到達する」タイミングも、推定テンポをもとに次ブロックの点滅開始で示す。
- v0.1では、保持・休符の正確さの採点やフィードバックは行わない。ガイドのオン/オフ切り替えやテンポ推定パラメータの設定UIも用意していない(SPEC.md §13.4)。

## 曲データの出典・ライセンス

**採用方針(SPEC_SONGS_INTRO WP2)**: 収録するのは**パブリックドメインまたはCC0のみ**。CC-BY / CC-BY-SA / NC のMIDIは採用しない(表示義務・継承義務を公開リポジトリに持ち込まないため)。管弦楽曲のピアノ編曲・現代校訂版も使わない。

- **クラシック曲**: すべて Mutopia Project から取得。各曲ページ(`piece-info.cgi?id=N`)の `Copyright:` 行が `Public Domain` であることを1曲ずつ確認したうえでMIDIを取得している。同じ作曲家でもCC-BY-SA表記の浄書は採用していない(例: ショパン ノクターン Op.9-2、前奏曲 Op.28-1/2/3/5 などはCC-BY-SAのため不採用)。
- **世界の民謡**: `tools/make_world_folk.py` による自作編曲。旋律はいずれも作曲者不詳の伝承曲または19世紀以前の曲でパブリックドメイン。音高・音価はLilyPondソースまたは楽譜画像から1音ずつ読み取って書き起こし、調・音域・反復構成・ハモリの付け方は自作。したがってCC0として扱う。
- **練習譜面・歓喜の歌**: `tools/make_practice_song*.py` / `tools/make_ode_to_joy.py` による自作(CC0相当)。

「オクターブ補正」は音域(C3〜G#6)外の音を1オクターブ動かした件数、「6音超で間引き」は SPEC §7 の6音上限に収めるため削除した音の件数(いずれも各曲JSONの `octaveAdjustedNotes` / `droppedNotes` で個別に確認できる)。

| Lv | 曲(英語ラベル) | 出典 | ライセンス | イベント数 | 最大同時 | オクターブ補正 | 6音超で間引き |
|---|---|---|---|---|---|---|---|
| 1 | Au clair de la lune (France, traditional) | tools/make_world_folk.py (melody verified against https://fr.wikipedia.org/wiki/Au_clair_de_la_lune) | CC0 (own arrangement; the melody is a traditional/public-domain tune) | 44 | 1 | 0 | 0 |
| 1 | Sakura Sakura (Japan, traditional) | tools/make_world_folk.py (melody verified against https://commons.wikimedia.org/wiki/File:Sakura.song.png) | CC0 (own arrangement; the melody is a traditional/public-domain tune) | 50 | 1 | 0 | 0 |
| 1 | First steps (C major scale & Twinkle Twinkle) | tools/make_practice_song.py | CC0相当(自作・権利なし) | 79 | 1 | 0 | 0 |
| 2 | Amazing Grace (New Britain tune, traditional) | tools/make_world_folk.py (melody verified against https://en.wikipedia.org/wiki/Amazing_Grace) | CC0 (own arrangement; the melody is a traditional/public-domain tune) | 70 | 2 | 0 | 0 |
| 2 | Auld Lang Syne (Scotland, traditional) | tools/make_world_folk.py (melody verified against https://en.wikipedia.org/wiki/Auld_Lang_Syne) | CC0 (own arrangement; the melody is a traditional/public-domain tune) | 112 | 2 | 0 | 0 |
| 2 | Mo Li Hua, Jasmine Flower (China, traditional) | tools/make_world_folk.py (melody verified against https://en.wikipedia.org/wiki/Mo_Li_Hua) | CC0 (own arrangement; the melody is a traditional/public-domain tune) | 67 | 1 | 0 | 0 |
| 2 | O Tannenbaum (Germany, traditional) | tools/make_world_folk.py (melody verified against https://en.wikipedia.org/wiki/O_Tannenbaum) | CC0 (own arrangement; the melody is a traditional/public-domain tune) | 92 | 2 | 0 | 0 |
| 2 | Folk medley (Butterfly, Mary Had a Little Lamb, When the Saints) | tools/make_practice_song_lv2.py | CC0相当(自作・PD民謡) | 86 | 1 | 0 | 0 |
| 3 | Arirang (Korea, traditional) | tools/make_world_folk.py (melody verified against https://en.wikipedia.org/wiki/Arirang) | CC0 (own arrangement; the melody is a traditional/public-domain tune) | 118 | 2 | 0 | 0 |
| 3 | La Cucaracha (Mexico, traditional) | tools/make_world_folk.py (melody verified against https://es.wikipedia.org/wiki/La_cucaracha) | CC0 (own arrangement; the melody is a traditional/public-domain tune) | 68 | 2 | 0 | 0 |
| 3 | Londonderry Air (Ireland, traditional) | tools/make_world_folk.py (melody verified against https://en.wikipedia.org/wiki/Londonderry_Air) | CC0 (own arrangement; the melody is a traditional/public-domain tune) | 92 | 1 | 0 | 0 |
| 3 | Shchedryk (Ukraine, traditional) | tools/make_world_folk.py (melody verified against https://en.wikipedia.org/wiki/Shchedryk_(song)) | CC0 (own arrangement; the melody is a traditional/public-domain tune) | 70 | 1 | 0 | 0 |
| 3 | Beethoven - Ode to Joy (from Symphony No. 9) | tools/make_ode_to_joy.py | CC0相当(自作編曲・旋律はPD) | 124 | 2 | 0 | 0 |
| 3 | Black keys and chords: a first drill | tools/make_practice_song_lv3.py | CC0相当(自作・権利なし) | 33 | 2 | 0 | 0 |
| 3 | Tchaikovsky - Old French Song (Album for the Young) | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=2080 | Public Domain (Mutopia piece page states: Copyright: Public Domain) | 115 | 4 | 3 | 0 |
| 4 | Bach - Polonaise in F major | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1013 | Public Domain (Mutopia piece page states: Copyright: Public Domain) | 146 | 5 | 25 | 0 |
| 4 | Chopin - Prelude Op. 28 No. 20 | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=472 | Public Domain (Mutopia piece page states: Copyright: Public Domain) | 61 | 6 | 70 | 0 |
| 4 | Chopin - Prelude Op. 28 No. 7 | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=470 | Public Domain (Mutopia piece page states: Copyright: Public Domain) | 49 | 6 | 8 | 3 |
| 4 | Satie - Gymnopedie No. 1 | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=37 | Public Domain / CC0 | 112 | 6 | 51 | 0 |
| 4 | Satie - Gymnopedie No. 2 | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=38 | Public Domain (Mutopia piece page states: Copyright: Public Domain) | 147 | 5 | 65 | 0 |
| 4 | Satie - Gymnopedie No. 3 | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=39 | Public Domain (Mutopia piece page states: Copyright: Public Domain) | 142 | 6 | 59 | 0 |
| 4 | Mozart - Sonata K. 331, theme of the 1st movement | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=614 | Public Domain (Mutopia piece page states: Copyright: Public Domain) | 180 | 5 | 12 | 0 |
| 4 | Schumann - Traumerei (Scenes from Childhood) | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=504 | Public Domain (Mutopia piece page states: Copyright: Public Domain) | 166 | 6 | 25 | 0 |
| 4 | Tchaikovsky - Morning Prayer (Album for the Young) | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=2032 | Public Domain (Mutopia piece page states: Copyright: Public Domain) | 95 | 5 | 50 | 0 |
| 4 | Tchaikovsky - March of the Wooden Soldiers (Album for the Young) | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1806 | Public Domain (Mutopia piece page states: Copyright: Public Domain) | 144 | 4 | 0 | 0 |
| 5 | Bach - Invention No. 8, BWV 779 | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=61 | Public Domain (Mutopia piece page states: Copyright: Public Domain) | 373 | 4 | 31 | 0 |
| 5 | Beethoven - Minuet in E flat, WoO 82 | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=904 | Public Domain (Mutopia piece page states: Copyright: Public Domain) | 512 | 5 | 128 | 0 |
| 5 | Bach - Prelude in C, BWV 846 | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=5 | Public Domain / CC0 | 545 | 4 | 30 | 0 |
| 5 | Chopin - Prelude Op. 28 No. 4 | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=468 | Public Domain (Mutopia piece page states: Copyright: Public Domain) | 191 | 5 | 42 | 0 |
| 5 | Schubert - Moment Musical No. 3, D. 780 | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1023 | Public Domain (Mutopia piece page states: Copyright: Public Domain) | 427 | 6 | 58 | 0 |
| 6 | Beethoven - Sonata No. 8 Pathetique, 2nd mvt | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=295 | Public Domain (Mutopia piece page states: Copyright: Public Domain) | 730 | 6 | 188 | 0 |
| 6 | Beethoven - Fur Elise | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=931 | Public Domain / CC0 | 663 | 6 | 171 | 0 |
| 6 | Joplin - The Entertainer | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=263 | Public Domain (Mutopia piece page states: Copyright: Public Domain) | 972 | 6 | 217 | 0 |
| 6 | Joplin - Maple Leaf Rag | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=23 | Public Domain (Mutopia piece page states: Copyright: Public Domain) | 1005 | 6 | 273 | 0 |
| 7 | Chopin - Fantaisie-Impromptu Op. 66 | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1693 | Public Domain (Mutopia piece page states: Copyright: Public Domain) | 2519 | 5 | 204 | 0 |
| 7 | Chopin - Waltz Op. 64 No. 1, Minute Waltz | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=483 | Public Domain (Mutopia piece page states: Copyright: Public Domain) | 734 | 4 | 54 | 0 |
| 7 | Debussy - Clair de Lune | https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=1778 | Public Domain / CC0 | 763 | 6 | 102 | 26 |

取得日: Mutopia分は2026-07-31(BWV846のみ2026-07-16)。

### AI作曲 (Keynata Commons)

収録47曲のうち10曲は機械生成曲で、曲選択UIでは専用グループ **AI作曲 (Keynata Commons)** にまとめ、上表の人手収録曲とは混ぜていない。出所は CC0 生成曲ライブラリ [Keynata Commons](https://carf-coder.github.io/keynata-commons/)。生成エンジンは規則ベースで、和声プラン(終止・転調・AB / ABA / ロンドなどの形式)を先に決めてから、古典派の声部進行制約に従って旋律と伴奏を書く方式であり、他者の演奏データを学習したニューラルモデルではない。

Commons公開時に参照コーパスとの類似度スクリーニングを通過した曲だけが公開され、**Keynataへ変換できるのは公開済みトラックのみ**(未公開シードの直接変換は禁止)。したがってスクリーニング未通過の曲がゲームに入ることはない。変換後の譜面はさらに、既存37曲の実測値から固定した適性ゲート(同時発音数・発音密度・長さ・オクターブ補正率・ライセンス表記)で機械検査している。

ライセンスは全曲 `CC0 (Keynata Commons, AI-generated)`。出所は各曲JSONの `commonsTrackId` と、Commonsの当該トラックページを指す `sourceUrl` に記録している。

| Lv | 曲(英語ラベル) | Commonsトラック | ライセンス | イベント数 | 最大同時 | オクターブ補正 | 6音超で間引き |
|---|---|---|---|---|---|---|---|
| 3 | AI Composed No. 12201 | https://carf-coder.github.io/keynata-commons/#karaoke_12201 | CC0 (Keynata Commons, AI-generated) | 508 | 1 | 0 | 0 |
| 3 | AI Composed No. 12280 | https://carf-coder.github.io/keynata-commons/#karaoke_12280 | CC0 (Keynata Commons, AI-generated) | 524 | 1 | 0 | 0 |
| 3 | AI Composed No. 12627 | https://carf-coder.github.io/keynata-commons/#karaoke_12627 | CC0 (Keynata Commons, AI-generated) | 501 | 1 | 0 | 0 |
| 3 | AI Composed No. 12737 | https://carf-coder.github.io/keynata-commons/#karaoke_12737 | CC0 (Keynata Commons, AI-generated) | 433 | 1 | 0 | 0 |
| 4 | AI Composed No. 4104 | https://carf-coder.github.io/keynata-commons/#classical_piano_4104 | CC0 (Keynata Commons, AI-generated) | 138 | 3 | 0 | 0 |
| 4 | AI Composed No. 4138 | https://carf-coder.github.io/keynata-commons/#classical_piano_4138 | CC0 (Keynata Commons, AI-generated) | 124 | 3 | 0 | 0 |
| 4 | AI Composed No. 5306 | https://carf-coder.github.io/keynata-commons/#classical_piano_5306 | CC0 (Keynata Commons, AI-generated) | 56 | 3 | 0 | 0 |
| 5 | AI Composed No. 4001 | https://carf-coder.github.io/keynata-commons/#classical_piano_4001 | CC0 (Keynata Commons, AI-generated) | 201 | 2 | 0 | 0 |
| 5 | AI Composed No. 5702 | https://carf-coder.github.io/keynata-commons/#classical_piano_5702 | CC0 (Keynata Commons, AI-generated) | 406 | 4 | 210 | 0 |
| 5 | AI Composed No. 5901 | https://carf-coder.github.io/keynata-commons/#classical_piano_5901 | CC0 (Keynata Commons, AI-generated) | 442 | 4 | 213 | 0 |

`karaoke_*` の4曲は単旋律(常に1音ずつ・2小節ごとにブレスの休符が入る)、`classical_piano_*` の6曲は旋律+伴奏の2声で、既存収録曲と同格のピアノ曲。5702・5901のオクターブ補正はノート数比 28-30% で、既存曲の最大値(30.43%)以内に収まっている。

## 音源について

Salamander Grand Piano(Alexander Holm 制作、CC-BY 3.0)のサンプルを使用している。読み込み前・読み込み失敗時はWeb Audio APIのオシレータ(基音+倍音のレイヤード構成)による合成音にフォールバックする。帰属表示はアプリ画面下部に固定表示しており、再配布の際も維持すること。

## 公開ビルド

```bash
python3 tools/build_site.py   # 標準ライブラリのみ・依存なし
```

`dist/` を生成し、以下の検証ゲート5項目を実行する。1つでも失敗するとスクリプトは異常終了し `dist/` を削除するため、検証を通らないビルドは配信されない。

1. **私的利用曲の混入ゼロ**: 出力のパスと内容を走査し、`songs_private` / `source_midi_private` の文字列と `songs_private/index.json` に登録された曲IDが含まれないこと。`app.js` の既知の2行のみ許可リストで除外し、それ以外の一致はすべて失敗扱い。
2. **ライセンス検査**: `dist/songs/*.json` の `license` がPD/CC0を示す文言のみで、CC-BY・ShareAlike・NonCommercialを含まないこと(音源のCC-BY帰属はUI文言側なので対象外)。
3. **絵文字ゼロ**: 出力物全体を走査。
4. **参照の健全性**: `index.html` が参照するローカル資産と、`SONG_LIST` の全曲JSONが `dist/` に存在すること。
5. **要約表示**: 曲数・容量・最小化による削減率。

曲JSONは空白を除いて再出力し、再パースして元と同値であることを検証している(現状で約52%削減、3.9MB→1.9MB)。リポジトリ側は可読な整形済みJSONのまま残す。

`main` へのpushで `.github/workflows/pages.yml` が同じビルドを実行し、`dist/` をGitHub Pagesへ公開する。

## 私的利用曲(ローカル専用・配布対象外)

`songs_private/` は、著作権のある楽曲を著作権法30条(私的使用のための複製)の範囲で打ち込んで練習するためのローカル専用ディレクトリ。`.gitignore` に登録済みでコミットせず、公開ビルドは混入を検出して失敗する。このリポジトリにも配信物にも一切含まれない。

## 曲の追加について(貢献)

不具合報告・遊び心地のフィードバックを歓迎する。曲の追加はパブリックドメインまたはCC0のもののみ受け付ける(CC-BY / CC-BY-SA / NC は、表示義務・継承義務を再配布自由なリポジトリに持ち込まないため対象外)。ライセンスが確認できる出典ページを添え、JSONは手書きせず `tools/preprocess_midi.py` で生成すること。

## ライセンス

コードはMIT([LICENSE](LICENSE))。曲データはPDまたはCC0(上表のとおり)。音源はCC-BY 3.0で帰属表示が必要。

## 既知の制限・未検証事項

- キーボード入力・音の実際の鳴り方は自動テストしていない(ブラウザでの対話的操作が必要なため)。`index.html`をローカルサーバー経由で開き、`songs/bwv846.json`がエラーなく取得・パースできること、およびキーボードUIが表示されることは確認済み。実際にキーを押して音が鳴ること・ガイド通り進行することは目視での動作確認が必要。
- ピアノロール型ガイド帯・保持ガイドの充填アニメーション・次打鍵の点滅・テンポ推定の追従感は、いずれもブラウザでの対話的操作(実際にタイピングしてみる)でしか確認できないため未検証。`songs/bwv846.json`に`onsetDeltaRatio`が各イベントに付与されていること、値が非負で先頭イベントが0であることはコード上で確認済み。
- 和音内で同一の物理キーが2回要求される特殊ケースが曲の最終和音に1件ある(オクターブ補正の副作用)。
- 日本語(JIS)キーボードと英語(US)キーボードでは記号キーの刻印位置が異なるが、`KeyboardEvent.code`(物理位置ベース)でマッピングしているため、どちらのキーボードでも同じ物理位置のキーで同じ音が鳴る。
