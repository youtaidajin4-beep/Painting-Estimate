import React, { useState, useEffect, useRef } from "react";
import { BrandHeader } from "./src/components/BrandHeader";
import { InvitePanel } from "./src/components/InvitePanel";
import { useAppShell } from "./src/context/AppShellContext";
import { PRINT_HINT, PRINT_SHEET_PADDING, printPageBase } from "./src/styles/printShared";

// ---- スタンドアロン実行用：window.storage が無い環境では localStorage で保存 ----
if (typeof window !== "undefined" && !window.storage) {
  window.storage = {
    async get(key) {
      const v = window.localStorage.getItem("pw:" + key);
      if (v === null) throw new Error("not found");
      return { key, value: v };
    },
    async set(key, value) { window.localStorage.setItem("pw:" + key, value); return { key, value }; },
    async delete(key) { window.localStorage.removeItem("pw:" + key); return { key, deleted: true }; },
    async list() { return { keys: Object.keys(window.localStorage).filter((k) => k.startsWith("pw:")).map((k) => k.slice(3)) }; },
  };
}

/* ============ 塗装見積 Pro ============
   現地調査からその場で「診断 → 松竹梅提案 → 見積書」まで完結する塗装業専用アプリ
*/

const TAX = 0.1;
const K_EST = "paint-est-v1";
const K_SET = "paint-set-v1";
const yen = (n) => "¥" + Math.round(n || 0).toLocaleString("ja-JP");
const uid = () => Math.random().toString(36).slice(2);

const GRADES = [
  { name: "ウレタン", years: 8 },
  { name: "シリコン", years: 12, popular: true },
  { name: "フッ素", years: 15 },
  { name: "無機", years: 20 },
];

// 工場・鉄部の定番項目（単価は目安・見積編集で変更可）
const FACTORY_ITEMS = [
  { name: "手すり塗装（ケレン・錆止め・上塗2回）", unit: "m", price: 1500 },
  { name: "鉄骨階段 塗装", unit: "箇所", price: 28000 },
  { name: "鉄部塗装（3種ケレン込）", unit: "㎡", price: 1800 },
  { name: "配管塗装（100A以下）", unit: "m", price: 1200 },
  { name: "折板屋根 塗装", unit: "㎡", price: 2200 },
  { name: "フェンス・柵 塗装", unit: "m", price: 1100 },
  { name: "シャッター塗装", unit: "枚", price: 18000 },
  { name: "消火器ボックス・小物 塗装", unit: "個", price: 3500 },
];
// 内装・テナントの定番項目
const INTERIOR_ITEMS = [
  { name: "壁 EP塗装（下地調整・2回塗り）", unit: "㎡", price: 950 },
  { name: "天井 EP塗装（2回塗り）", unit: "㎡", price: 1050 },
  { name: "建具 塗装（片面）", unit: "枚", price: 8000 },
  { name: "巾木・枠 塗装", unit: "m", price: 450 },
  { name: "養生・室内保護", unit: "式", price: 15000 },
];

// マンション・集合住宅（大規模修繕）
const MANSION_ITEMS = [
  { name: "足場架設・解体（メッシュシート込）", unit: "㎡", price: 900 },
  { name: "高圧洗浄", unit: "㎡", price: 250 },
  { name: "外壁塗装（シリコン 3回塗り）", unit: "㎡", price: 2500 },
  { name: "廊下・階段 壁天井塗装", unit: "㎡", price: 1400 },
  { name: "鉄骨階段 塗装", unit: "箇所", price: 28000 },
  { name: "手すり塗装", unit: "m", price: 1500 },
  { name: "玄関扉 塗装", unit: "枚", price: 12000 },
  { name: "雨樋・付帯部 塗装", unit: "m", price: 900 },
];
// 防水工事
const WATERPROOF_ITEMS = [
  { name: "ウレタン防水（通気緩衝工法）", unit: "㎡", price: 6500 },
  { name: "ウレタン防水（密着工法）", unit: "㎡", price: 4500 },
  { name: "FRP防水", unit: "㎡", price: 7500 },
  { name: "トップコート塗替", unit: "㎡", price: 2200 },
  { name: "立上り部 防水", unit: "m", price: 2800 },
  { name: "改修用ドレン 設置", unit: "箇所", price: 12000 },
  { name: "下地補修・ケレン", unit: "㎡", price: 800 },
];
// 塗床（工場・倉庫・駐車場）
const FLOOR_ITEMS = [
  { name: "エポキシ塗床（薄膜）", unit: "㎡", price: 2800 },
  { name: "エポキシ塗床（厚膜）", unit: "㎡", price: 5500 },
  { name: "ウレタン塗床", unit: "㎡", price: 6000 },
  { name: "下地研磨・ショットブラスト", unit: "㎡", price: 900 },
  { name: "区画ライン引き", unit: "m", price: 800 },
  { name: "番号・記号 表示", unit: "箇所", price: 3000 },
];
const WORKTYPES = ["戸建", "マンション", "工場・鉄部", "内装・テナント", "防水", "塗床"];
const CATALOGS = { "マンション": MANSION_ITEMS, "工場・鉄部": FACTORY_ITEMS, "内装・テナント": INTERIOR_ITEMS, "防水": WATERPROOF_ITEMS, "塗床": FLOOR_ITEMS };
const TYPE_TITLES = { "戸建": "外壁塗装工事", "マンション": "大規模修繕 塗装工事", "工場・鉄部": "鉄部塗装工事", "内装・テナント": "内装塗装工事", "防水": "防水工事", "塗床": "塗床工事" };
// タイプ別の標準工程（仕様書用）
const GSTEPS = {
  "工場・鉄部": [["ケレン・素地調整", "3種ケレンにて旧塗膜・錆を除去し、清掃"], ["錆止め（下塗り）", "変性エポキシ系錆止めを塗布"], ["中塗り", "上塗り材を規定膜厚で塗布"], ["上塗り", "仕上げ塗装（乾燥時間を厳守）"], ["検査・清掃", "立会い検査のうえ、清掃して完了"]],
  "内装・テナント": [["養生・室内保護", "床・什器・設備を保護"], ["下地調整", "パテ処理・ペーパー掛けで平滑に"], ["下塗り", "シーラーで吸い込みを止める"], ["上塗り（2回）", "EP塗料を2回塗りで仕上げ"], ["検査・清掃", "立会い検査のうえ、清掃して完了"]],
  "防水": [["下地処理", "既存防水層の補修・清掃・乾燥確認"], ["プライマー塗布", "下地との密着性を確保"], ["防水材 1層目", "ウレタン等を規定膜厚で塗布"], ["防水材 2層目", "膜厚を確保して塗布"], ["トップコート", "紫外線から防水層を保護"], ["検査", "水張り・目視検査のうえ完了"]],
  "塗床": [["下地研磨", "研磨・ショットブラストで下地を目荒らし"], ["プライマー", "コンクリートへの密着性を確保"], ["中塗り", "塗床材を規定膜厚で塗布"], ["上塗り・仕上げ", "平滑に仕上げ、養生期間を確保"], ["ライン・表示", "区画ライン・番号を表示"], ["検査・引渡し", "硬化確認のうえ引渡し"]],
  "マンション": [["高圧洗浄", "外壁・共用部の汚れを除去"], ["下地補修", "クラック・爆裂部を補修"], ["シーリング打替", "目地・サッシ廻りを打替え"], ["下塗り〜上塗り", "3回塗りで仕上げ"], ["鉄部・付帯部", "ケレンのうえ塗装"], ["検査・清掃", "立会い検査のうえ完了"]],
};

// ---- 調査報告書：箇所と症状別の原因解説テンプレート（タップで自動挿入・編集可） ----
const REP_LOCS = ["外壁", "屋根", "屋上", "シーリング", "階段", "庇", "雨樋", "基礎", "ベランダ", "内部", "その他"];
const REP_SYMS = [
  ["コケ・藻", "主な原因：湿気や汚れ、日陰の多い環境です。直射日光が当たらない場所や風通しの悪い場所で特に発生しやすく、外壁の素材によっては繁殖が進みやすくなります。発生を防ぐためには、定期的な清掃や防藻・防カビ機能がある塗料の使用が有効です。"],
  ["ひび割れ（クラック）", "主な原因：乾燥収縮や振動、経年による塗膜・下地の劣化です。放置すると雨水が浸入し、下地の腐食や雨漏りにつながるおそれがあるため、早めの補修をお勧めします。"],
  ["チョーキング", "主な原因：紫外線や風雨により塗膜の樹脂が分解され、顔料が粉状に表面へ現れる現象です。塗膜の防水機能が低下しているサインであり、塗替え時期の目安となります。"],
  ["シーリング劣化", "主な原因：シーリング材には柔らかさを保つための成分が含まれており、経年でこの成分が表面に染み出すと、汚れや埃がつきやすくなり黒ずみ・苔・カビが発生します。定期的な点検と清掃、必要に応じた補修で状態を良好に保つことができます。"],
  ["シーリング剥離", "主な原因：経年劣化（シーリング材の寿命は通常5〜10年程度）、施工時の密着不良、外壁の動きなどです。剥離すると防水性・気密性が低下するため、打ち替えをお勧めします。"],
  ["剥離・膨れ", "主な原因：下地と塗膜の密着不良や、塗膜内部への水分侵入です。放置すると剥離範囲が拡大し、下地の劣化が進行します。"],
  ["錆（サビ）", "主な原因：塗膜の劣化により鉄部が空気や水分に触れることで発生します。放置すると腐食が進行し部材の強度低下につながるため、ケレンのうえ錆止め処理をお勧めします。"],
  ["雨漏り跡・雨染み", "主な原因：防水層やシーリングの劣化部から雨水が浸入した痕跡です。浸入経路の特定と早期の補修が必要です。"],
  ["破損・欠け", "主な原因：飛来物や衝撃、経年劣化による強度低下と考えられます。範囲が広がる前の補修をお勧めします。"],
  ["汚れ・黒ずみ", "主な原因：排気ガスや雨だれ、大気中の汚染物質の付着です。高圧洗浄等で改善が見込めます。"],
  ["防水層の劣化", "主な原因：防水塗膜の経年劣化です。水切れの悪化や表面のザラつきが生じ、放置すると防水性能の低下や雨漏りにつながるおそれがあります。"],
  ["異常なし", "目立った劣化・損傷は確認されませんでした。現状は良好です。"],
];
const REP_CAUSES = ["台風・強風（風災）", "雹（雹災）", "大雪（雪災）", "落雷", "飛来物・衝突", "その他"];
// 劣化度判定（国交省・自治体の劣化診断マニュアル準拠の4段階）
const REP_GRADES = [
  ["A", "健全", "良好な状態です。定期的な点検の継続をお勧めします。", "#248A3D"],
  ["B", "軽度", "経過観察。次回点検時の再確認をお勧めします。", "#B58500"],
  ["C", "中度", "中期的（1〜3年以内）な補修をお勧めします。", "#D96C00"],
  ["D", "重度", "早急な補修・改修が必要です。", "#FF3B30"],
];
const REP_METHODS = ["目視", "指触", "打診", "赤外線", "ドローン", "散水"];
function newReport() {
  const d = new Date();
  return {
    id: uid(),
    no: d.toISOString().slice(2, 10).replace(/-/g, "").slice(0, 6) + "-R" + Math.floor(Math.random() * 90 + 10),
    date: d.toISOString().slice(0, 10),
    name: "", customer: "", site: "", base: "", spec: "屋根・外壁・下地処理",
    age: "", inspector: "", methods: ["目視"], plan: "", planMarks: [], layout: "所見", orient: "横",
    summaries: [],
    insurance: { on: false, eventDate: "", cause: REP_CAUSES[0] },
    cover: "", count: 0, updatedAt: Date.now(),
  };
}
function worstGrade(items) {
  let w = -1;
  items.forEach((p) => { const gi = REP_GRADES.findIndex((g) => g[0] === p.grade); if (gi > w) w = gi; });
  return w >= 0 ? REP_GRADES[w] : null;
}
function buildRepSummary(items) {
  const locs = [];
  items.forEach((p) => { if (p.loc && !locs.includes(p.loc)) locs.push(p.loc); });
  return locs.map((L) => {
    const inLoc = items.filter((p) => p.loc === L);
    const syms = [];
    inLoc.forEach((p) => { if (p.sym && !syms.includes(p.sym)) syms.push(p.sym); });
    const g = worstGrade(inLoc);
    const ok = syms.length === 0 || (syms.length === 1 && syms[0] === "異常なし");
    let text = ok
      ? "目立った劣化・損傷は確認されませんでした。状態は良好です。綺麗なうちの定期的なメンテナンスをおすすめします。"
      : syms.join("、") + "が確認されました。放置すると劣化が進行し補修費用が大きくなるおそれがあるため、定期的な清掃・点検と、適切な補修やメンテナンスをお勧めします。";
    if (g && !ok) text += "（劣化度判定：" + g[0] + "・" + g[1] + "。" + g[2] + "）";
    return { id: uid(), title: L, text };
  });
}

// ---- サポートbot：FAQ知識ベース ----
const HELP_FAQ = [
  { c: "見積の作成方法", q: "新しい見積を作成するには？", kw: ["新規", "作成", "作り方", "はじめ"], a: "ホームの緑の「＋ 見積作成」をタップ→工事タイプを選択→画面の案内どおりに入力するだけです。戸建は外周と高さを入れると自動計算、他のタイプは項目の数量を入れる方式です。上の番号（✓）をタップすると前のステップに戻れます。" },
  { c: "見積の作成方法", q: "見積に項目を追加したい", kw: ["項目", "追加", "行"], a: "数量入力ステップの一番下「＋ ここにない項目を追加」で項目名・単価・単位を入れて＋を押すと、その場で追加され単価マスタにも保存されます。作成後の見積なら、編集画面の「＋ 空の行を追加」でも足せます。" },
  { c: "見積の作成方法", q: "工事タイプを増やしたい（板金など）", kw: ["タイプ", "板金", "工事の種類"], a: "右上メニュー（≡）→「単価設定」→タイプ別単価タブの上部にある「新しい工事タイプ名」に入力して＋追加。項目を登録すれば、見積ウィザードの選択画面に自動で並びます。" },
  { c: "見積の作成方法", q: "単価を変えたい", kw: ["単価", "値段", "価格", "変更"], a: "右上メニュー（≡）→「単価設定」から。戸建はグレード別＋共通項目、他タイプは項目ごとに名称・単価・単位（㎡/m/式など）をすべて手入力で変更できます。変更は次の見積から自動で反映されます。" },
  { c: "見積の作成方法", q: "完工ボタンは何？", kw: ["完工", "終わった", "工事終了"], a: "工事が終わったら案件カードの「完工」を押してください。自動で受注扱い＋完了日が記録され、案件は「工事経歴」（右上メニュー ≡）へ移動します。間違えたら経歴画面の「経歴から戻す」で復帰できます。" },
  { c: "見積の作成方法", q: "似た案件をもう一度つくりたい", kw: ["複製", "コピー", "同じ"], a: "案件カードの「複製」を押すと、写真ごとコピーされた新しい見積（作成中・今日の日付）ができます。定期点検の2回目などに便利です。報告書にも複製があります。" },
  { c: "書類の編集", q: "書類の文字を直したい", kw: ["編集", "直", "修正", "宛名", "点線"], a: "書類の点線が引かれた部分は、タップするとその場で書き換えられます。見積書・請求書・契約書・仕様書・報告書すべて対応。見積書で直した宛名や件名は他の書類にも反映されます。" },
  { c: "書類の編集", q: "請求日・契約日を変えたい", kw: ["請求日", "契約日", "日付"], a: "請求書の請求日、契約書の契約日はどちらも点線部分です。タップして書き換えれば、その案件の日付として保存されます。" },
  { c: "書類の編集", q: "契約書の甲乙を入れたい", kw: ["甲", "乙", "署名", "発注者"], a: "契約書の署名欄「住所」「氏名」の点線をタップして入力できます。お客様の住所は見積作成時の「お客様の住所」欄からも自動で入ります。乙（自社）は設定の会社情報から組み立てられます。" },
  { c: "印刷・PDF", q: "印刷やPDF保存のやり方", kw: ["印刷", "PDF", "保存", "出力"], a: "各書類画面の右上「印刷 / PDF保存」を押すと端末の印刷画面が開きます。プリンタで印刷するか、送信先を「PDFとして保存」にすればPDFになります。ファイル名は「物件名_調査報告書_日付」のように自動で付きます。" },
  { c: "印刷・PDF", q: "報告書の用紙を縦にしたい", kw: ["縦", "横", "向き", "用紙"], a: "報告書画面の上部「A4 横／A4 縦」で切り替えられます。どちらもレイアウトが自動調整され、印刷時の用紙向きも切り替わります。保険会社・法人には横、個人のお客様には縦がおすすめです。" },
  { c: "調査報告書", q: "調査報告書の作成方法", kw: ["報告書", "調査", "作り方"], a: "ホームの「調査報告書作成」→物件情報を入力→下の固定バーから写真を追加→写真ごとに「箇所」と「症状」をタップ。症状をタップするとプロの解説文が自動で入ります。最後に「写真から自動で下書き」で総評ができ、「報告書を見る→」で完成です。" },
  { c: "調査報告書", q: "写真に赤丸をつけたい", kw: ["赤丸", "丸", "マーキング", "印"], a: "報告書編集画面で写真をタップすると拡大画面が開きます。損傷箇所をタップで赤丸、下のスライダーで丸の大きさを変更（最後の丸と次の丸に効きます）。「○を1つ取消」「すべて消す」もあります。赤丸は印刷にもそのまま載ります。" },
  { c: "調査報告書", q: "劣化度のA〜Dは何？", kw: ["劣化", "判定", "ランク", "ABCD"], a: "国交省系マニュアル準拠の4段階判定です。A=健全、B=軽度（経過観察）、C=中度（1〜3年以内の補修推奨）、D=重度（早急な対応）。写真ごとにタップで選ぶと、報告書に部位別の判定一覧表が自動生成されます。" },
  { c: "調査報告書", q: "写真の整理を速くしたい", kw: ["前と同じ", "整列", "並べ替え", "順番"], a: "2枚目以降の写真は「前と同じ」ボタンで前の写真の箇所・症状・判定を1タップコピーできます。バラバラに撮った写真は「箇所順に整列」で自動でまとまり、(1-1)(1-2)の番号も揃います。↑↓で個別の並べ替えも可能です。" },
  { c: "調査報告書", q: "図面に撮影位置を入れたい", kw: ["図面", "配置図", "マーカー", "位置"], a: "報告書編集の「図面」欄に配置図・立面図の写真をアップし、図面をタップすると①②③…の番号マーカーが付きます。写真の箇所グループの順にタップしてください。報告書に撮影位置図のページが自動で入ります。" },
  { c: "調査報告書", q: "保険モードの注意点", kw: ["保険", "火災", "風災"], a: "保険モードをONにすると被災日・想定原因の欄と撮影日の自動記載が有効になります。重要：コケやチョーキングなど経年劣化の症状は保険対象外と判断されがちです。災害起因の損傷（破損・雨漏り跡など）と報告書を分けるのがおすすめで、該当症状を選ぶと注意が表示されます。" },
  { c: "調査報告書", q: "報告書から見積をつくれる？", kw: ["見積にする", "変換"], a: "報告書カードの「見積にする」で、症状が診断項目に自動でひも付いた見積の下書きができます（コケ→バイオ洗浄、ひび割れ→クラック補修など）。写真も引き継がれ、建物サイズを入れるだけで完成します。" },
  { c: "写真", q: "写真が追加できない", kw: ["写真", "追加できない", "読み込", "エラー"], a: "一部の特殊な形式（HEICの設定など）で読み込めないことがあります。その場合は、写真を一度スクリーンショットして、そのスクショを選ぶと確実に追加できます。写真は1報告書につき30枚までです。" },
  { c: "データ", q: "バックアップのやり方", kw: ["バックアップ", "引き継ぎ", "移行"], a: "右上メニュー（≡）→「会社情報」→一番下の「データの引き継ぎ」で「書き出してコピー」を押すとテキストがコピーされます。メモアプリ等に貼って保管してください。復元は同じ欄に貼り付けて「取り込む」。案件・単価・写真・報告書がすべて入っています。作業の区切りごとの書き出しをおすすめします。" },
  { c: "データ", q: "データが消えた・見えない", kw: ["消えた", "なくなった", "初期化"], a: "アプリが新しい画面に更新されると、以前のデータが引き継がれないことがあります。バックアップのテキストがあれば「取り込む」で全復元できます。まずは慌てずバックアップの有無を確認してください。" },
  { c: "統計・経営", q: "トップの数字とグラフの見方", kw: ["統計", "グラフ", "受注率", "粗利"], a: "黒いカードは選択中の月の「提出中・受注率・受注粗利」です。‹›か下の棒グラフをタップで月を移動できます。案件カードの左端の色帯は粗利率の健康状態（緑=健全／橙=注意／赤=警告ライン割れ。警告ラインは経営設定の粗利警告％と連動）です。" },
  { c: "統計・経営", q: "顧客台帳はどこ？", kw: ["顧客", "台帳", "お客様"], a: "右上メニュー（≡）→「顧客管理」です。見積・報告書からお客様が自動で集計され、住所・件数・直近案件（タップで開く）・「この方の新規見積」が使えます。入力作業は不要です。" },
  { c: "その他", q: "AIボタンが動かない", kw: ["AI", "生成", "動かない"], a: "Claudeのアプリ内で使っている場合はそのまま動きます。Web公開版（Vercel等）で使う場合は、右上メニュー（≡）→「会社情報」のClaude APIキー欄にキーを入れると有効になります。キーが無くても「写真から自動で下書き」等のテンプレート機能は全て使えます。" },
];

const DEFAULT_SET = {
  gradePrices: { ウレタン: 1800, シリコン: 2500, フッ素: 3800, 無機: 4500 },
  scaffold: 900, wash: 250, bioWash: 350, masking: 350, sealing: 950,
  roof: 2800, eaves: 1200, gutter: 900, fascia: 1100, crackRepair: 30000,
  costRate: 65, overheadRate: 10, marginAlert: 15, company: "",
  invoiceNo: "", bank: "", terms: "工事完了後、翌月末までに下記口座へお振込みをお願いいたします。",
  seal: "", logo: "",
  coName: "", coAddr: "", coRep: "", coTel: "", coMail: "",
  apiKey: "",
};

// 劣化症状 → 自動提案
const SYMPTOMS = [
  { id: "chalk", label: "チョーキング（手に粉）", note: "外壁表面にチョーキング現象を確認。塗膜の防水機能が低下しています。" },
  { id: "crack", label: "ひび割れ（クラック）", note: "外壁にクラックを確認。雨水侵入を防ぐため下地補修が必要です。", item: "crackRepair" },
  { id: "seal", label: "シーリングの劣化", note: "目地シーリングに硬化・破断を確認。打替えを推奨します。", item: "sealing" },
  { id: "moss", label: "コケ・藻・カビ", note: "北面等にコケ・藻の発生を確認。バイオ洗浄で根から除去します。", item: "bioWash" },
  { id: "roof", label: "屋根の色あせ・サビ", note: "屋根塗膜の劣化を確認。外壁と同時施工で足場代が一度で済みます。", item: "roof" },
  { id: "peel", label: "塗膜の剥がれ", note: "塗膜の剥離を確認。放置すると下地の傷みが進行します。" },
];

const newEstimate = () => ({
  id: uid(),
  no: new Date().toISOString().slice(2, 10).replace(/-/g, "") + "-" + Math.floor(Math.random() * 90 + 10),
  customer: "", site: "",
  title: "外壁塗装工事",
  date: new Date().toISOString().slice(0, 10),
  validDays: 30, discount: 0, status: "作成中",
  grade: "シリコン",
  workType: "戸建",
  pick: {},
  period: "",
  done: "",
  customerAddr: "",
  customSyms: [],
  aiText: "",
  rival: { price: "", grade: "シリコン" },
  actuals: [],
  building: { L: "", H: "6", coef: "0.8", roofArea: "" },
  symptoms: [],
  items: [],
  notes: "",
  updatedAt: Date.now(),
});

function calc(est, set) {
  const direct = est.items.reduce((s, i) => s + (+i.qty || 0) * (+i.price || 0), 0);
  const cost = est.items.reduce((s, i) => s + (+i.qty || 0) * (+i.cost || 0), 0);
  const overhead = Math.round(direct * set.overheadRate / 100);
  const beforeTax = direct + overhead - (+est.discount || 0);
  const tax = Math.round(beforeTax * TAX);
  const total = beforeTax + tax;
  const margin = beforeTax > 0 ? ((beforeTax - cost) / beforeTax) * 100 : 0;
  return { direct, cost, overhead, beforeTax, tax, total, margin, profit: beforeTax - cost };
}

// 建物情報＋診断＋グレード → 見積項目を生成
function buildItems(est, set) {
  const { L, H, coef, roofArea } = est.building;
  const wall = Math.round((+L || 0) * (+H || 0) * (+coef || 0.8) * 10) / 10;
  const scaffold = Math.round(((+L || 0) + 8) * ((+H || 0) + 0.5) * 10) / 10;
  const cr = set.costRate / 100;
  const mk = (name, qty, unit, price) => ({ id: uid(), name, qty, unit, price, cost: Math.round(price * cr) });
  if (!wall) return [];
  const has = (id) => est.symptoms.includes(id);
  const items = [
    mk("足場架設・解体（メッシュシート込）", scaffold, "㎡", set.scaffold),
    has("moss") ? mk("バイオ高圧洗浄", wall, "㎡", set.bioWash) : mk("高圧洗浄", wall, "㎡", set.wash),
    mk("養生", wall, "㎡", set.masking),
  ];
  if (has("crack")) items.push(mk("クラック補修（下地処理）", 1, "式", set.crackRepair));
  if (has("seal")) items.push(mk("シーリング打替", Math.round(wall * 0.9), "m", set.sealing));
  items.push(mk(`外壁塗装（${est.grade} 3回塗り）`, wall, "㎡", set.gradePrices[est.grade]));
  if (has("roof") && +roofArea > 0) items.push(mk(`屋根塗装（${est.grade}）`, +roofArea, "㎡", set.roof));
  return items;
}

function autoNotes(est) {
  const lines = est.symptoms.map((id) => {
    const s = SYMPTOMS.find((x) => x.id === id);
    if (s) return "・" + s.note;
    const c = (est.customSyms || []).find((x) => x.id === id);
    return c ? "・" + c.label + "を確認しました。" : null;
  }).filter(Boolean);
  const base = "・上記金額には消費税を含みます。\n・下地の状態により追加補修をご相談する場合があります。";
  return (lines.length ? "【現地診断の所見】\n" + lines.join("\n") + "\n\n" : "") + base;
}

function winStats(ests, set2) {
  const done = ests.filter((e) => e.status === "受注" || e.status === "失注").map((e) => ({ won: e.status === "受注", m: calc(e, set2).margin }));
  const bands = [["〜15%", 0, 15], ["15〜25%", 15, 25], ["25〜35%", 25, 35], ["35%〜", 35, 999]];
  return { n: done.length, rows: bands.map(([l, a, b]) => { const g = done.filter((d) => d.m >= a && d.m < b); return { l, a, b, n: g.length, won: g.filter((d) => d.won).length }; }) };
}

async function load(key, fb) {
  if (window.__cloudStorage) return window.__cloudStorage.load(key, fb);
  try { const r = await window.storage.get(key); if (r && r.value) return JSON.parse(r.value); } catch (e) {}
  return fb;
}
async function save(key, v) {
  if (window.__cloudStorage) return window.__cloudStorage.save(key, v);
  try { await window.storage.set(key, JSON.stringify(v)); return true; } catch (e) { return false; }
}

async function callAI(body, apiKey) {
  if (window.__callAnthropic) return window.__callAnthropic(body);
  return fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" } : { "anthropic-version": "2023-06-01" }),
    },
    body: JSON.stringify(body),
  });
}

/* ---------- UI部品 ---------- */
const AC = "#1B7F3B"; // アクセント（濃緑・スイート共通）
const INK = "#1D1D1F";
const SUB = "#86868B";

function Field({ label, children, hint }) {
  return (
    <label style={{ display: "block" }}>
      <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: INK, marginBottom: 6 }}>{label}</span>
      {children}
      {hint && <span style={{ display: "block", fontSize: 12, color: SUB, marginTop: 4 }}>{hint}</span>}
    </label>
  );
}

// ---- 現場写真（自動圧縮して保存） ----
const PHOTO_TAGS = ["全景", "外壁", "屋根", "ひび割れ", "シーリング", "コケ・藻", "付帯部", "シミュレーション", "その他"];
function fileToDataURL(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = () => rej(new Error("read failed"));
    r.readAsDataURL(file);
  });
}
function scaleImage(dataUrl, max, mime, q) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      try {
        const sc = Math.min(1, max / Math.max(img.width, img.height));
        const cv = document.createElement("canvas");
        cv.width = Math.max(1, Math.round(img.width * sc));
        cv.height = Math.max(1, Math.round(img.height * sc));
        cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
        res(cv.toDataURL(mime, q));
      } catch (e) { rej(e); }
    };
    img.onerror = () => rej(new Error("decode failed"));
    img.src = dataUrl;
  });
}
async function readSeal(file) {
  return scaleImage(await fileToDataURL(file), 360, "image/png");
}
async function readPhoto(file) {
  return scaleImage(await fileToDataURL(file), 900, "image/jpeg", 0.72);
}
const PhotoGrid = ({ photos, onTag, onDel }) => photos.length === 0 ? null : (
  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 10 }}>
    {photos.map((p) => (
      <div key={p.id} style={{ position: "relative" }}>
        <img src={p.data} alt="" style={{ width: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: 10, display: "block" }} />
        <button onClick={() => onDel(p.id)} style={{ position: "absolute", top: 4, right: 4, border: "none", background: "rgba(0,0,0,.55)", color: "#fff", borderRadius: 11, width: 22, height: 22, fontSize: 12, cursor: "pointer", lineHeight: 1 }}>×</button>
        <select value={p.tag} onChange={(e) => onTag(p.id, e.target.value)} style={{ marginTop: 4, padding: "6px 8px", fontSize: 12, borderRadius: 8 }}>
          {PHOTO_TAGS.map((t) => <option key={t}>{t}</option>)}
        </select>
      </div>
    ))}
  </div>
);
function buildCo(f) {
  return [f.coName, f.coAddr, f.coRep ? "代表取締役　" + f.coRep : "", f.coTel ? "TEL：" + f.coTel : "", f.coMail ? "E-mail：" + f.coMail : ""].filter(Boolean).join("\n");
}
const SealCo = ({ set }) => {
  const lines = (set.company || "").split("\n");
  return (
    <div style={{ position: "relative", display: "inline-block", maxWidth: "100%", paddingRight: set.seal ? 24 : 0, textAlign: "left" }}>
      <div style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
        {set.logo && <img src={set.logo} alt="ロゴ" style={{ height: 20, maxWidth: 72, objectFit: "contain", flexShrink: 0 }} />}
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, whiteSpace: "pre-wrap", wordBreak: "break-word", letterSpacing: ".01em", lineHeight: "20px" }}>{lines[0] || ""}</div>
          {lines.length > 1 && <div style={{ fontSize: 9.5, whiteSpace: "pre-wrap", wordBreak: "break-word", lineHeight: 1.9, marginTop: 3, color: "#48484A" }}>{lines.slice(1).join("\n")}</div>}
        </div>
      </div>
      {set.seal && <img src={set.seal} alt="印" style={{ position: "absolute", right: -6, top: "50%", transform: "translateY(-50%)", width: 52, mixBlendMode: "multiply", opacity: .9 }} />}
    </div>
  );
};

const Ed = ({ v, on, num, multi, style }) => (
  <span className={"ed" + (num ? " num" : "")} contentEditable suppressContentEditableWarning
    onKeyDown={(e) => { if (!multi && e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); } }}
    onBlur={(e) => on((e.currentTarget.textContent || "").trim())}
    style={style}>{v}</span>
);


const PhotoAdd = ({ onFiles, label }) => (
  <label className="btn btn-soft" style={{ display: "block", textAlign: "center", cursor: "pointer" }}>
    {label}
    <input type="file" accept="image/*" multiple style={{ display: "none" }}
      onChange={(e) => { const fs = Array.from(e.target.files || []); e.target.value = ""; if (fs.length) onFiles(fs); }} />
  </label>
);

// ---- カラーシミュレーション（段階0：手動選択×輝度保持の色置換） ----
const SIM_COLORS = [
  ["オフホワイト", "#F2EFE8"], ["アイボリー", "#EFE6CE"], ["クリーム", "#EEDFB9"],
  ["ベージュ", "#D9C6A5"], ["グレージュ", "#BFB4A3"], ["ライトグレー", "#CDD1D4"],
  ["ブルーグレー", "#9AA8B5"], ["モスグリーン", "#7C8A6E"], ["テラコッタ", "#C96F45"],
  ["ブラウン", "#8A6A52"], ["チャコール", "#4A4F55"], ["ネイビー", "#31445E"],
];
function hexToRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  let h = 0, s = 0; const l = (mx + mn) / 2;
  if (mx !== mn) {
    const d = mx - mn;
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    if (mx === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  return [h, s, l];
}
function hslToRgb(h, s, l) {
  if (s === 0) { const v = Math.round(l * 255); return [v, v, v]; }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const f = (t) => { if (t < 0) t += 1; if (t > 1) t -= 1; if (t < 1 / 6) return p + (q - p) * 6 * t; if (t < 1 / 2) return q; if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6; return p; };
  return [Math.round(f(h + 1 / 3) * 255), Math.round(f(h) * 255), Math.round(f(h - 1 / 3) * 255)];
}

function ColorSim({ photos, onFiles, onSave, onClose }) {
  const [srcId, setSrcId] = useState(null);
  const [pts, setPts] = useState([]);
  const [regions, setRegions] = useState([]);
  const [color, setColor] = useState(SIM_COLORS[8][1]);
  const [colorName, setColorName] = useState(SIM_COLORS[8][0]);
  const [after, setAfter] = useState(false);
  const [hasResult, setHasResult] = useState(false);
  const cvRef = useRef(null);
  const baseRef = useRef(null);
  const resRef = useRef(null);
  const srcPhoto = photos.find((p) => p.id === srcId);

  useEffect(() => {
    setPts([]); setRegions([]); setAfter(false); setHasResult(false); resRef.current = null;
    if (!srcPhoto || !cvRef.current) return;
    const img = new Image();
    img.onload = () => {
      const cv = cvRef.current; if (!cv) return;
      const max = 1100, sc = Math.min(1, max / Math.max(img.width, img.height));
      cv.width = Math.max(1, Math.round(img.width * sc));
      cv.height = Math.max(1, Math.round(img.height * sc));
      const ctx = cv.getContext("2d");
      ctx.drawImage(img, 0, 0, cv.width, cv.height);
      baseRef.current = ctx.getImageData(0, 0, cv.width, cv.height);
      redraw(false);
    };
    img.src = srcPhoto.data;
  }, [srcId]); // eslint-disable-line

  const redraw = (showAfter) => {
    const cv = cvRef.current; if (!cv || !baseRef.current) return;
    const ctx = cv.getContext("2d");
    if (showAfter && resRef.current) { ctx.putImageData(resRef.current, 0, 0); return; }
    ctx.putImageData(baseRef.current, 0, 0);
    ctx.lineWidth = Math.max(2, cv.width / 300);
    const poly = (arr, closed) => {
      if (arr.length < 2 && !closed) { return; }
      if (!arr.length) return;
      ctx.beginPath(); ctx.moveTo(arr[0].x, arr[0].y);
      arr.slice(1).forEach((p) => ctx.lineTo(p.x, p.y));
      if (closed) ctx.closePath();
      ctx.strokeStyle = "#1B7F3B"; ctx.stroke();
      if (closed) { ctx.fillStyle = "rgba(27,127,59,.25)"; ctx.fill(); }
    };
    regions.forEach((r) => poly(r, true));
    poly(pts, false);
    pts.forEach((p) => { ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(4, cv.width / 140), 0, Math.PI * 2); ctx.fillStyle = "#1B7F3B"; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = "#fff"; ctx.stroke(); });
  };
  useEffect(() => { redraw(after); }, [pts, regions, after]); // eslint-disable-line

  const tap = (e) => {
    if (after) return;
    const cv = cvRef.current; if (!cv || !baseRef.current) return;
    const r = cv.getBoundingClientRect();
    setPts([...pts, { x: (e.clientX - r.left) * (cv.width / r.width), y: (e.clientY - r.top) * (cv.height / r.height) }]);
  };

  const apply = () => {
    const all = pts.length >= 3 ? [...regions, pts] : regions;
    if (!all.length || !baseRef.current) return;
    if (pts.length >= 3) { setRegions(all); setPts([]); }
    const cv = cvRef.current;
    const m = document.createElement("canvas"); m.width = cv.width; m.height = cv.height;
    const mc = m.getContext("2d"); mc.fillStyle = "#fff";
    all.forEach((rg) => { mc.beginPath(); mc.moveTo(rg[0].x, rg[0].y); rg.slice(1).forEach((p) => mc.lineTo(p.x, p.y)); mc.closePath(); mc.fill(); });
    const mask = mc.getImageData(0, 0, m.width, m.height).data;
    const base = baseRef.current;
    const out = new ImageData(new Uint8ClampedArray(base.data), base.width, base.height);
    const [tr, tg, tb] = hexToRgb(color);
    const [th, ts, tl] = rgbToHsl(tr, tg, tb);
    const d = out.data;
    for (let i = 0; i < d.length; i += 4) {
      if (mask[i + 3] > 10) {
        const l = (Math.max(d[i], d[i + 1], d[i + 2]) + Math.min(d[i], d[i + 1], d[i + 2])) / 510;
        const l2 = Math.max(0.04, Math.min(0.97, tl + (l - 0.55) * 0.7)); // 陰影を残す
        const [nr, ng, nb] = hslToRgb(th, ts, l2);
        d[i] = nr; d[i + 1] = ng; d[i + 2] = nb;
      }
    }
    resRef.current = out;
    setHasResult(true); setAfter(true);
  };

  const reset = () => { setPts([]); setRegions([]); setAfter(false); setHasResult(false); resRef.current = null; };

  return (
    <>
    <header className="appbar no-print"><div className="appbar-in">
      <button className="btn btn-bar btn-mini" onClick={onClose}>← 提案に戻る</button>
    </div></header>
    <div className="colw" style={{ maxWidth: 620, margin: "0 auto", padding: "18px 16px 40px" }}>
      <div className="eyebrow">COLOR SIMULATION</div>
      <h2 style={{ margin: "4px 0 4px", fontSize: 24, fontWeight: 800 }}>カラーシミュレーション</h2>
      <p className="sub" style={{ fontSize: 13, margin: "0 0 14px" }}>①写真を選ぶ → ②壁の角を順にタップして囲む → ③色を選んで塗り替え。陰影はそのまま残るので自然に見えます。</p>

      <div className="card" style={{ padding: 14, marginBottom: 12 }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>① 写真を選ぶ</div>
        {photos.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8, marginBottom: 10 }}>
            {photos.map((p) => (
              <button key={p.id} className="simthumb" onClick={() => setSrcId(p.id)}
                style={{ padding: 0, border: "none", borderRadius: 10, overflow: "hidden", cursor: "pointer", outline: srcId === p.id ? "3px solid #1B7F3B" : "1px solid #E5E5EA", background: "none" }}>
                <img src={p.data} alt="" style={{ width: "100%", aspectRatio: "1", objectFit: "cover", display: "block" }} />
              </button>
            ))}
          </div>
        )}
        <PhotoAdd onFiles={onFiles} label="＋ 外壁の写真を追加（カメラ / アルバム）" />
      </div>

      {srcPhoto && (
        <>
          <div className="card" style={{ padding: 14, marginBottom: 12 }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>② 壁を囲む{regions.length > 0 && <span className="sub" style={{ fontWeight: 500, fontSize: 12 }}>　確定済み {regions.length} 範囲</span>}</div>
            <canvas ref={cvRef} onClick={tap} style={{ width: "100%", borderRadius: 12, display: "block", touchAction: "manipulation", cursor: after ? "default" : "crosshair" }} />
            {!after ? (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 10 }}>
                <button className="btn btn-soft btn-mini" style={{ width: "100%" }} disabled={!pts.length} onClick={() => setPts(pts.slice(0, -1))}>1点戻す</button>
                <button className="btn btn-soft btn-mini" style={{ width: "100%" }} disabled={pts.length < 3} onClick={() => { setRegions([...regions, pts]); setPts([]); }}>範囲を確定</button>
                <button className="btn btn-soft btn-mini" style={{ width: "100%", color: "#FF3B30" }} onClick={reset}>リセット</button>
              </div>
            ) : (
              <div style={{ marginTop: 10 }}>
                <Seg options={["施工前", "施工後"]} value={after ? "施工後" : "施工前"} onChange={(v) => setAfter(v === "施工後")} />
              </div>
            )}
            {hasResult && !after && (
              <div style={{ marginTop: 8 }}>
                <Seg options={["施工前", "施工後"]} value="施工前" onChange={(v) => setAfter(v === "施工後")} />
              </div>
            )}
          </div>

          <div className="card" style={{ padding: 14, marginBottom: 12 }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>③ 色を選ぶ　<span className="sub" style={{ fontWeight: 500, fontSize: 12 }}>{colorName}</span></div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8 }}>
              {SIM_COLORS.map(([nm, hx]) => (
                <button key={nm} title={nm} onClick={() => { setColor(hx); setColorName(nm); setAfter(false); }}
                  style={{ aspectRatio: "1", borderRadius: 10, border: "none", cursor: "pointer", background: hx, outline: color === hx ? "3px solid #1D1D1F" : "1px solid #E5E5EA", outlineOffset: 2 }} />
              ))}
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10, fontSize: 13, fontWeight: 600 }}>
              自由な色：
              <input type="color" value={color} onChange={(e) => { setColor(e.target.value); setColorName("カスタム " + e.target.value); setAfter(false); }} style={{ width: 46, height: 34, padding: 2, borderRadius: 8 }} />
            </label>
          </div>

          <button className="btn btn-ac" disabled={regions.length + (pts.length >= 3 ? 1 : 0) === 0} onClick={apply}>この色で塗り替える</button>
          {hasResult && (
            <button className="btn btn-soft" style={{ marginTop: 8 }} onClick={() => { const cv = cvRef.current; const ctx = cv.getContext("2d"); ctx.putImageData(resRef.current, 0, 0); onSave(cv.toDataURL("image/jpeg", 0.72), colorName); }}>
              写真に保存（診断報告書に載せる）
            </button>
          )}
        </>
      )}
    </div>
    </>
  );
}

const SettingNum = ({ label, value, onChange }) => (
  <Field label={label}><input className="num" type="number" inputMode="numeric" value={value} onChange={onChange} /></Field>
);

function Seg({ options, value, onChange }) {
  return (
    <div style={{ display: "flex", background: "#E9E9EB", borderRadius: 12, padding: 3 }}>
      {options.map((o) => (
        <button key={o} onClick={() => onChange(o)} style={{
          flex: 1, border: "none", borderRadius: 9, padding: "10px 4px", fontSize: 13, fontWeight: 600,
          fontFamily: "inherit", cursor: "pointer",
          background: value === o ? "#fff" : "transparent",
          color: value === o ? INK : SUB,
          boxShadow: value === o ? "0 1px 4px rgba(0,0,0,.12)" : "none",
          transition: "all .15s",
        }}>{o}</button>
      ))}
    </div>
  );
}

function MarginBar({ margin, alert }) {
  const w = Math.max(0, Math.min(100, margin));
  const color = margin >= 30 ? "#34C759" : margin >= alert ? "#FF9F0A" : "#FF3B30";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ flex: 1, height: 6, background: "#E9E9EB", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ width: `${w}%`, height: "100%", background: color, transition: "width .3s" }} />
      </div>
      <span className="num" style={{ fontSize: 13, fontWeight: 700, color, minWidth: 54, textAlign: "right" }}>{margin.toFixed(1)}%</span>
    </div>
  );
}

/* ============ メイン ============ */
export default function App({ branding = null, tenantMode = false, onBrandingChange = null }) {
  const accentColor = branding?.primary_color || (typeof window !== "undefined" && window.__tenantBranding?.primary_color) || AC;
  const appLabel = branding?.app_name || (typeof window !== "undefined" && window.__tenantBranding?.app_name) || "塗装見積 Pro";
  const [ests, setEsts] = useState([]);
  const [set, setSet] = useState(DEFAULT_SET);
  const [loaded, setLoaded] = useState(false);
  const [view, setView] = useState("home"); // home | wizard | edit | present | print | settings
  const [menuOpen, setMenuOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const appShell = useAppShell();
  const [cur, setCur] = useState(null);
  const [step, setStep] = useState(0);
  const [toast, setToast] = useState("");
  const [delId, setDelId] = useState(null);
  const [docTab, setDocTab] = useState("見積書");
  const [af, setAf] = useState({ name: "", amount: "", cat: "材料費" });
  const [photos, setPhotos] = useState([]);
  const [aiBusy, setAiBusy] = useState(false);
  const [setType, setSetType] = useState("戸建");
  const [setTab, setSetTab] = useState("基本情報");
  const [statMonth, setStatMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [histQ, setHistQ] = useState({ from: "", to: "", q: "" });
  const [cliQ, setCliQ] = useState("");
  const [helpLog, setHelpLog] = useState([]);
  const [helpQ, setHelpQ] = useState("");
  const [helpCat, setHelpCat] = useState("");
  const [addRow, setAddRow] = useState({ name: "", unit: "㎡", price: "" });
  const [newType, setNewType] = useState("");
  const [delType, setDelType] = useState("");
  const [symIn, setSymIn] = useState("");
  const [ioText, setIoText] = useState("");
  const [reps, setReps] = useState([]);
  const [curRep, setCurRep] = useState(null);
  const [repAiBusy, setRepAiBusy] = useState(false);
  const [repPhotos, setRepPhotos] = useState([]);
  const [repDelId, setRepDelId] = useState(null);
  const [markEdit, setMarkEdit] = useState(null);
  const [markSize, setMarkSize] = useState(16);
  const [pvScale, setPvScale] = useState(1);
  const [pvH, setPvH] = useState(0);
  const pvRef = useRef(null);
  useEffect(() => {
    const f = () => setPvScale(Math.min(1, (window.innerWidth - 16) / ((curRep && curRep.orient === "縦") ? 780 : 1040)));
    f(); window.addEventListener("resize", f);
    return () => window.removeEventListener("resize", f);
  }, [curRep ? curRep.orient : "横", view]);
  useEffect(() => {
    if (view !== "repDoc" || !pvRef.current) return;
    const el = pvRef.current;
    const upd = () => setPvH((h) => (Math.abs(h - el.offsetHeight) > 1 ? el.offsetHeight : h));
    upd();
    const ro = new ResizeObserver(upd);
    ro.observe(el);
    return () => ro.disconnect();
  }, [view, curRep ? curRep.id : null, curRep ? curRep.orient : "", curRep ? curRep.layout : "", repPhotos.length]);

  useEffect(() => {
    (async () => {
      setEsts(await load(K_EST, []));
      setReps(await load("paint-rep-v1", []));
      const s = await load(K_SET, {});
      const s2 = { ...DEFAULT_SET, ...s, catalogs: { ...CATALOGS, ...(s.catalogs || {}) }, customTypes: s.customTypes || [] };
      if (!s2.coName && s2.company) {
        const ls = s2.company.split("\n").map((x) => x.trim()).filter(Boolean);
        s2.coName = ls[0] || "";
        ls.slice(1).forEach((l) => {
          if (!s2.coTel && /TEL|tel|０\d|0\d{1,4}[-−]/.test(l)) s2.coTel = l.replace(/^TEL[：:]?\s*/i, "");
          else if (!s2.coMail && l.includes("@")) s2.coMail = l.replace(/^E-?mail[：:]?\s*/i, "");
          else if (!s2.coRep && l.includes("代表")) s2.coRep = l.replace(/^代表取締役\s*/, "");
          else if (!s2.coAddr) s2.coAddr = l;
        });
      }
      setSet(s2);
      if (tenantMode && branding) {
        const merged = {
          ...s2,
          coName: branding.co_name || s2.coName,
          coAddr: branding.co_addr || s2.coAddr,
          coTel: branding.co_tel || s2.coTel,
          coMail: branding.co_mail || s2.coMail,
          coRep: branding.co_rep || s2.coRep,
          logo: branding.logo_url || s2.logo,
          seal: branding.seal_url || s2.seal,
          supportUrl: branding.support_url || s2.supportUrl,
          terms: branding.terms || s2.terms,
          bank: branding.bank || s2.bank,
          invoiceNo: branding.invoice_no || s2.invoiceNo,
          company: buildCo({
            coName: branding.co_name || s2.coName,
            coAddr: branding.co_addr || s2.coAddr,
            coTel: branding.co_tel || s2.coTel,
            coMail: branding.co_mail || s2.coMail,
            coRep: branding.co_rep || s2.coRep,
          }),
        };
        setSet(merged);
      }
      setLoaded(true);
    })();
  }, [tenantMode, branding?.organization_id]);

  const flash = (m) => { setToast(m); setTimeout(() => setToast(""), 1800); };

  // 案件が変わるたびに写真を読み込み（案件ごとに別キーで保存）
  useEffect(() => {
    if (!cur) { setPhotos([]); return; }
    (async () => {
      try { const r = await window.storage.get("paint-photos-" + cur.id); setPhotos(r && r.value ? JSON.parse(r.value) : []); }
      catch { setPhotos([]); }
    })();
  }, [cur ? cur.id : null]);
  const savePhotos = async (list) => {
    setPhotos(list);
    try { await window.storage.set("paint-photos-" + cur.id, JSON.stringify(list)); }
    catch { flash("写真の保存容量を超えました。何枚か削除してください"); }
  };
  const addPhotoFiles = async (files) => {
    if (photos.length + files.length > 8) { flash("写真は1案件につき8枚までです"); return; }
    const added = [];
    for (const f of files) { try { added.push({ id: uid(), tag: "全景", note: "", data: await readPhoto(f) }); } catch (e) {} }
    if (added.length) { await savePhotos([...photos, ...added]); flash(added.length + "枚追加しました"); }
    else flash("写真を読み込めませんでした。スクリーンショット画像でお試しください");
  };
  const tagPhoto = (id, tag) => savePhotos(photos.map((p) => (p.id === id ? { ...p, tag } : p)));
  const delPhoto = (id) => savePhotos(photos.filter((p) => p.id !== id));

  // ---- 調査報告書：保存まわり ----
  const persistReps = async (list) => { setReps(list); await save("paint-rep-v1", list); };
  const saveCurRep = async (r) => {
    const nr = { ...r, updatedAt: Date.now() };
    setCurRep(nr);
    await persistReps(reps.some((x) => x.id === nr.id) ? reps.map((x) => (x.id === nr.id ? nr : x)) : [nr, ...reps]);
  };
  useEffect(() => {
    if (!curRep) { setRepPhotos([]); return; }
    (async () => {
      try { const r = await window.storage.get("paint-repph-" + curRep.id); setRepPhotos(r && r.value ? JSON.parse(r.value) : []); }
      catch { setRepPhotos([]); }
    })();
  }, [curRep ? curRep.id : null]);
  const saveRepPhotos = async (list) => {
    setRepPhotos(list);
    try { await window.storage.set("paint-repph-" + curRep.id, JSON.stringify(list)); } catch { flash("写真の保存容量を超えました。何枚か削除してください"); }
    await saveCurRep({ ...curRep, count: list.length });
  };
  const addRepPhotoFiles = async (files) => {
    const added = [];
    for (const f of files) { try { added.push({ id: uid(), data: await readPhoto(f), loc: "外壁", sym: "", text: "", note: "" }); } catch (e) {} }
    if (added.length) { await saveRepPhotos([...repPhotos, ...added]); flash(added.length + "枚追加しました。箇所と症状をタップしてください"); }
    else flash("写真を読み込めませんでした。スクリーンショット画像でお試しください");
  };
  const updRepPhoto = (id, patch) => saveRepPhotos(repPhotos.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  const genRepAI = async () => {
    if (repAiBusy || !curRep) return;
    setRepAiBusy(true);
    try {
      const found = repPhotos.map((p) => p.loc + "：" + (p.sym || "特記なし")).join("\n") || "特になし";
      const res = await callAI({
          model: "claude-sonnet-4-6", max_tokens: 1200,
          messages: [{ role: "user", content: "あなたは建物調査のプロです。以下の調査結果から、調査報告書の「診断結果」欄の文章を書いてください。箇所ごとに「■外壁」のような見出し行を付け、症状・考えられる原因・放置した場合のリスク・推奨する対処を、お客様や保険会社に提出できる丁寧で客観的な文体で3〜5文ずつ。前置きは不要、本文のみ。\n物件：" + (curRep.name || "建物") + "（" + (curRep.base || "構造不明") + "）\n確認された症状：\n" + found }],
        }, set.apiKey);
      const data = await res.json();
      const text = (data.content || []).map((i) => (i.type === "text" ? i.text : "")).join("").trim();
      if (!text) throw new Error("empty");
      const secs = [];
      text.split(/\n(?=■)/).forEach((chunk) => {
        const m = chunk.match(/^■(.+?)\n([\s\S]*)$/);
        if (m) secs.push({ id: uid(), title: m[1].trim(), text: m[2].trim() });
      });
      await saveCurRep({ ...curRep, summaries: secs.length ? secs : [{ id: uid(), title: "総評", text }] });
      flash("AIが診断結果を作成しました。自由に手直しできます");
    } catch (e) { flash("生成に失敗しました。「写真から自動で下書き」もご利用いただけます"); }
    setRepAiBusy(false);
  };
  const dupEst = async (e) => {
    const d = new Date();
    const ne = { ...e, id: uid(), no: d.toISOString().slice(2, 10).replace(/-/g, "") + "-" + Math.floor(Math.random() * 90 + 10), date: d.toISOString().slice(0, 10), status: "作成中", done: "", actuals: [], invoiceDate: "", contractDate: "", updatedAt: Date.now() };
    try { const v = await window.storage.get("paint-photos-" + e.id); if (v && v.value) await window.storage.set("paint-photos-" + ne.id, v.value); } catch (er) {}
    await persist([ne, ...ests]); flash("複製しました（作成中として追加）");
  };
  const dupRep = async (r) => {
    const d = new Date();
    const nr = { ...r, id: uid(), no: d.toISOString().slice(2, 10).replace(/-/g, "") + "-R" + Math.floor(Math.random() * 90 + 10), date: d.toISOString().slice(0, 10) };
    try { const v = await window.storage.get("paint-repph-" + r.id); if (v && v.value) await window.storage.set("paint-repph-" + nr.id, v.value); } catch (er) {}
    await persistReps([nr, ...reps]); flash("報告書を複製しました");
  };
  // 調査報告書 → 見積の下書き（症状→診断項目の自動ひも付け）
  const repToEstimate = async (r) => {
    let ph = [];
    try { const v = await window.storage.get("paint-repph-" + r.id); ph = v && v.value ? JSON.parse(v.value) : []; } catch (er) {}
    const MAP = { "コケ・藻": "moss", "ひび割れ": "crack", "チョーキング": "chalk", "シーリング劣化": "seal", "シーリング剥離": "seal", "剥離・剥がれ": "peel" };
    const symIds = [], customs = [];
    ph.forEach((p) => {
      if (!p.sym || p.sym === "異常なし") return;
      let sid = MAP[p.sym];
      if (!sid && p.sym === "錆" && (p.loc || "").includes("屋")) sid = "roof";
      if (sid) { if (!symIds.includes(sid)) symIds.push(sid); }
      else { const label = p.sym + (p.loc ? "（" + p.loc + "）" : ""); if (!customs.some((c) => c.label === label)) customs.push({ id: "c" + uid(), label }); }
    });
    const est = { ...newEstimate(), customer: r.customer || "", site: r.site || r.name || "", symptoms: [...symIds, ...customs.map((c) => c.id)], customSyms: customs };
    const locTag = (L) => (L === "外壁" ? "外壁" : L === "屋根" || L === "屋上" ? "屋根" : L === "シーリング" ? "シーリング" : "その他");
    const eph = [];
    if (r.cover) eph.push({ id: uid(), tag: "全景", note: r.name || "", data: r.cover });
    ph.forEach((p) => eph.push({ id: uid(), tag: p.sym === "コケ・藻" ? "コケ・藻" : locTag(p.loc), note: p.sym || "", data: p.data, marks: p.marks || [] }));
    try { if (eph.length) await window.storage.set("paint-photos-" + est.id, JSON.stringify(eph)); } catch (er) {}
    await persist([est, ...ests]);
    setCur(est); setStep(1); setView("wizard");
    flash("報告書から見積の下書きを作成しました。建物サイズを入れるだけです");
  };

  // データの書き出し／取り込み（バックアップ）
  const exportData = async () => {
    const photosAll = {};
    for (const e of ests) {
      try { const r = await window.storage.get("paint-photos-" + e.id); if (r && r.value) photosAll[e.id] = JSON.parse(r.value); } catch (er) {}
    }
    const repPh = {};
    for (const rp of reps) {
      try { const rr = await window.storage.get("paint-repph-" + rp.id); if (rr && rr.value) repPh[rp.id] = JSON.parse(rr.value); } catch (er) {}
    }
    const t = JSON.stringify({ app: "paint", v: 1, ests, set, photos: photosAll, reps, repPh });
    setIoText(t);
    try { await navigator.clipboard.writeText(t); flash("バックアップをコピーしました"); }
    catch {
      try {
        const ta = document.createElement("textarea"); ta.value = t; document.body.appendChild(ta);
        ta.select(); document.execCommand("copy"); document.body.removeChild(ta);
        flash("バックアップをコピーしました");
      } catch (er) { flash("下の欄を長押しして全コピーしてください"); }
    }
  };
  const importData = async () => {
    try {
      const d = JSON.parse(ioText);
      if (!d || !Array.isArray(d.ests)) throw new Error("bad");
      await save(K_EST, d.ests); setEsts(d.ests);
      if (d.set) {
        const s = { ...DEFAULT_SET, ...d.set, catalogs: { ...CATALOGS, ...(d.set.catalogs || {}) } };
        await save(K_SET, s); setSet(s);
      }
      if (d.photos) { for (const id of Object.keys(d.photos)) { try { await window.storage.set("paint-photos-" + id, JSON.stringify(d.photos[id])); } catch (er) {} } }
      if (Array.isArray(d.reps)) { await save("paint-rep-v1", d.reps); setReps(d.reps); }
      if (d.repPh) { for (const id of Object.keys(d.repPh)) { try { await window.storage.set("paint-repph-" + id, JSON.stringify(d.repPh[id])); } catch (er) {} } }
      flash("データを取り込みました。すべて復元されています");
    } catch (e) { flash("形式が正しくありません。「書き出す」で作ったテキストを貼り付けてください"); }
  };

  // AI提案文（Claude API）
  const genAI = async () => {
    if (aiBusy || !cur) return;
    setAiBusy(true);
    try {
      const symText = cur.symptoms.map((id) => ((SYMPTOMS.find((s) => s.id === id) || (cur.customSyms || []).find((s) => s.id === id)) || {}).label).filter(Boolean).join("、") || "特になし";
      const g = GRADES.find((x) => x.name === cur.grade) || {};
      const res = await callAI({
          model: "claude-sonnet-4-6",
          max_tokens: 1000,
          messages: [{ role: "user", content: "あなたは外壁塗装会社の誠実な営業担当です。以下の現地診断結果をもとに、施主様向けの提案文を日本語で250字程度で書いてください。押し売り感のない丁寧なトーンで、劣化を放置した場合のリスクと、" + cur.grade + "塗料を選ぶ理由を自然に含めてください。挨拶や前置き・箇条書きは不要、本文のみを出力してください。\n工事種別：" + (cur.workType || "戸建") + "\n顧客名：" + (cur.customer || "お客様") + "\n確認された劣化症状：" + symText + "\n提案仕様：" + cur.grade + "（期待耐用年数 約" + (g.years || "") + "年）\n御見積金額（税込）：" + yen(calc(cur, set).total) }],
        }, set.apiKey);
      const data = await res.json();
      const text = (data.content || []).map((i) => (i.type === "text" ? i.text : "")).join("").trim();
      if (!text) throw new Error("empty");
      await saveCur({ ...cur, aiText: text });
      flash("提案文を作成しました");
    } catch (e) { flash("生成に失敗しました。通信環境（Mac版は設定のAPIキー）をご確認ください"); }
    setAiBusy(false);
  };
  const persist = async (list) => { setEsts(list); await save(K_EST, list); };
  const persistSet = async (s) => {
    setSet(s);
    await save(K_SET, s);
    if (tenantMode && onBrandingChange) {
      onBrandingChange({
        app_name: branding?.app_name,
        primary_color: branding?.primary_color || accentColor,
        co_name: s.coName,
        co_addr: s.coAddr,
        co_tel: s.coTel,
        co_mail: s.coMail,
        co_rep: s.coRep,
        support_url: s.supportUrl || "",
        terms: s.terms,
        bank: s.bank,
        invoice_no: s.invoiceNo,
        logo: s.logo,
        seal: s.seal,
      });
    }
  };
  const saveCur = async (est) => {
    const e2 = { ...est, updatedAt: Date.now() };
    await persist(ests.some((x) => x.id === e2.id) ? ests.map((x) => (x.id === e2.id ? e2 : x)) : [e2, ...ests]);
    setCur(e2);
  };

  const copyShare = async (e) => {
    const c = calc(e, set);
    const t = `【御見積】${e.title}\n${e.customer || ""}様\n見積金額：${yen(c.total)}（税込・${e.grade}仕様）\n有効期限：${e.validDays}日間\nご検討のほど、よろしくお願いいたします。`;
    try { await navigator.clipboard.writeText(t); flash("コピーしました"); }
    catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = t; document.body.appendChild(ta); ta.select();
        document.execCommand("copy"); document.body.removeChild(ta);
        flash("コピーしました");
      } catch { flash("コピーできませんでした"); }
    }
  };

  const css = `
    * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
    body { margin: 0; }
    * { -webkit-tap-highlight-color: transparent; box-sizing: border-box; }
    html { -webkit-text-size-adjust: 100%; text-size-adjust: 100%; }
    img { max-width: 100%; }
    textarea { resize: vertical; }
    input[type=number]::-webkit-outer-spin-button, input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
    input[type=number] { -moz-appearance: textfield; appearance: textfield; }
    button { touch-action: manipulation; }
    .root { font-family: -apple-system, BlinkMacSystemFont, "Hiragino Sans", "Noto Sans JP", sans-serif; background: #F4F5F7; min-height: 100vh; color: #1D1D1F; -webkit-font-smoothing: antialiased; }
    @media screen {
      .root { overflow-x: hidden; max-width: 100vw; }
    }
    .num { font-variant-numeric: tabular-nums; font-weight: 600; letter-spacing: -.01em; }
    h1, h2, h3, h4 { letter-spacing: -.022em; }
    input, select, textarea { font-family: inherit; font-size: 16px; border: 1px solid #C9CFD6; border-radius: 8px; padding: 11px 12px; background: #fff; color: #1D1D1F; width: 100%; appearance: none; }
    input:focus, select:focus, textarea:focus { outline: none; border-color: ${accentColor}; box-shadow: 0 0 0 3px ${accentColor}22; }
    input::placeholder, textarea::placeholder { color: #AEAEB2; }
    .btn { border: 1px solid transparent; border-radius: 8px; padding: 14px 20px; font-size: 15px; font-weight: 600; cursor: pointer; font-family: inherit; width: 100%; transition: opacity .12s, transform .15s, box-shadow .15s, filter .15s; touch-action: manipulation; letter-spacing: -.01em; }
    .btn:active { opacity: .72; transform: scale(.985); }
    .btn-ac { background: ${accentColor}; color: #fff; }
    .btn-ac:disabled { background: #D8D8DC; color: #fff; }
    .btn-soft { background: #fff; color: #1D1D1F; border-color: #C9CFD6; }
    .btn-mini { width: auto; padding: 8px 15px; font-size: 13px; font-weight: 600; }
    .btn-bar { width: auto; background: none; color: ${accentColor}; padding: 8px 10px; font-size: 15px; font-weight: 500; }
    .btn-cta { border-radius: 8px; padding: 17px; font-size: 17px; margin: 14px 0 22px; }
    .card { background: #fff; border: 1px solid #DDE1E6; border-radius: 10px; }
    .sheet-print { box-shadow: 0 2px 28px rgba(0,0,0,.08); }
    .eyebrow { font-size: 12px; font-weight: 600; letter-spacing: .04em; color: ${accentColor}; }
    .sub { color: #86868B; }
    .sheet-print td { word-break: break-word; }
    .steps { display: flex; gap: 4px; margin: 14px 0 20px; }
    .stepd { flex: 1; text-align: center; font-size: 11px; color: #AEAEB2; }
    .stepd i { display: block; width: 28px; height: 28px; border-radius: 50%; background: #E9E9EC; color: #8E8E93; font-style: normal; font-weight: 700; line-height: 28px; margin: 0 auto 5px; font-size: 13px; transition: all .2s; }
    .stepd.on i { background: ${accentColor}; color: #fff; }
    .stepd.on { color: #1D1D1F; font-weight: 700; }
    .stepd.done i { background: #D9F0E1; color: #248A3D; }
    .stepd.done { color: #248A3D; }
    .ed { border-bottom: 1px dashed #C9CDD2; cursor: text; min-width: 14px; }
    .ed:focus { outline: none; background: #FFF6E9; border-bottom: 1px solid ${accentColor}; }
    .herox { background: #1F2937; border-radius: 10px; color: #fff; padding: 14px 14px 12px; box-shadow: 0 1px 2px rgba(0,0,0,.06); }
    .herox .hs .l { color: rgba(255,255,255,.6); }
    .herox .hs .v { color: #fff; }
    .mnav { border: none; background: rgba(255,255,255,.13); color: #fff; width: 30px; height: 30px; border-radius: 50%; font-size: 16px; line-height: 30px; cursor: pointer; font-family: inherit; transition: background .15s; }
    .mnav:active { background: rgba(255,255,255,.28); }
    .tile { position: relative; border: 1px solid transparent; border-radius: 10px; padding: 17px 30px 16px 16px; text-align: left; font-family: inherit; cursor: pointer; display: flex; flex-direction: column; gap: 4px; justify-content: center; transition: transform .15s ease, opacity .15s, box-shadow .2s; }
    .tile:active { transform: scale(.97); opacity: .85; }
    .tile::after { content: "›"; position: absolute; right: 13px; top: 50%; transform: translateY(-54%); font-size: 21px; font-weight: 500; opacity: .4; }
    .tile .t { font-size: 16px; font-weight: 700; letter-spacing: -.01em; }
    .tile .d { font-size: 12px; opacity: .72; line-height: 1.5; font-weight: 500; letter-spacing: -.01em; }
    .tile-ac { background: ${accentColor}; color: #fff; box-shadow: 0 1px 2px rgba(0,0,0,.06); }
    .tile-w { background: #fff; color: #1D1D1F; border-color: #C9CFD6; }
    .docTitle { font-family: "Hiragino Mincho ProN", "Yu Mincho", "Noto Serif JP", "MS PMincho", serif; }
    .sumcols { column-count: 1; column-gap: 28px; }
    @media (min-width: 720px) { .sumcols { column-count: 2; } }
    .sech { display: flex; justify-content: space-between; align-items: baseline; margin: 0 6px 10px; }
    .sech .st { font-size: 19px; font-weight: 800; letter-spacing: .01em; }
    .list-col { display: flex; flex-direction: column; gap: 14px; }
    @media (min-width: 900px) { .list-col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; align-items: start; } }
    .tiles { display: grid; grid-template-columns: 1.18fr 1fr; gap: 10px; margin: 0 0 26px; }
    .plans { display: flex; flex-direction: column; gap: 14px; }
    .wrapx { margin: 0 auto; padding: 18px 16px 48px; }
    .page-top { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; flex-wrap: wrap; margin: 10px 2px 18px; }
    .sec-h { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; font-size: 13.5px; font-weight: 700; letter-spacing: .03em; padding: 0 2px 8px; border-bottom: 1px solid #DDE1E6; margin: 0 0 14px; }
    .sec-h .cnt { font-size: 12px; font-weight: 500; color: #86868B; letter-spacing: 0; }
    @media (min-width: 1000px) {
      .tile { padding: 14px 30px 13px 16px; border-radius: 10px; }
      .btn-cta { max-width: 420px; margin-left: auto; margin-right: auto; display: block; }
      .wrapx .list-col { grid-template-columns: repeat(3, 1fr); }
      .wrapx { padding: 22px 32px 60px; }
      .home-grid { display: grid; grid-template-columns: minmax(360px, 430px) minmax(0, 1fr); gap: 32px; align-items: start; }
      .hero-stats .hs .v { font-size: 22px; }
      .sec-h { font-size: 14px; }
      .page-top { margin: 6px 2px 20px; }
      .home-side { position: sticky; top: 70px; }
      .tiles { grid-template-columns: 1fr; margin: 0; }
      .home-main .sech { margin-top: 4px; }
      .home-main .list-col { grid-template-columns: 1fr; }
      .colw { max-width: 900px !important; }
      .colw-l { max-width: 1160px !important; }
      .wizwrap { max-width: 880px !important; background: #fff; border: 1px solid #DDE1E6; border-radius: 12px; padding: 26px 36px 36px !important; margin: 24px auto 48px !important; }
      .plans { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; align-items: stretch; }
    }
    @media (min-width: 1200px) {
      .home-main .list-col { grid-template-columns: 1fr 1fr; }
    }
    @media (min-width: 1700px) {
      .home-main .list-col { grid-template-columns: repeat(3, 1fr); }
    }
    .sticky-foot {
      position: fixed; left: 0; right: 0; bottom: 0; z-index: 40;
      padding: 12px 16px calc(12px + env(safe-area-inset-bottom, 0px));
      background: rgba(255,255,255,.92);
      backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
      border-top: 1px solid #E5E5EA;
      max-width: 100vw;
      box-sizing: border-box;
    }
    .sticky-foot-in {
      max-width: 620px; margin: 0 auto;
      display: flex; gap: 10px; align-items: stretch;
    }
    .sticky-foot .btn {
      width: auto; flex: 1; min-width: 0;
      display: flex; align-items: center; justify-content: center;
      min-height: 48px; padding: 12px 14px; line-height: 1.3;
      text-align: center; white-space: nowrap;
    }
    .sticky-foot .btn-wide { flex: 1.4; }
    .sticky-foot label.btn { position: relative; }
    .sticky-foot label.btn .btn-label-t {
      flex: 1; width: 100%; text-align: center;
    }
    .sticky-foot label.btn input[type="file"] {
      position: absolute; inset: 0; width: 100%; height: 100%;
      opacity: 0; cursor: pointer;
    }
    .sticky-foot .btn-input {
      flex: 1; min-width: 0;
      padding: 12px 14px; min-height: 48px; line-height: 1.3;
      border: 1px solid #D1D1D6; border-radius: 10px; background: #fff;
      font-size: 15px; box-sizing: border-box;
    }
    .page-with-foot { padding-bottom: calc(100px + env(safe-area-inset-bottom, 0px)) !important; }
    @media (max-width: 480px) {
      .rep-photo-row { flex-direction: column !important; }
      .rep-photo-row .rep-thumb { width: 100% !important; height: auto !important; aspect-ratio: 1; }
      .grid-2-mobile { grid-template-columns: 1fr !important; }
    }
    .appbar { position: sticky; top: 0; z-index: 40; background: #fff; border-bottom: 1px solid #DDE1E6; }
    .appbar-in { max-width: none; margin: 0; padding: 8px 18px; display: flex; justify-content: space-between; align-items: center; min-height: 50px; }
    .hbg { width: 44px; height: 44px; border: none; background: none; cursor: pointer; display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 5.5px; padding: 0; margin-right: 2px; touch-action: manipulation; }
    .hbg span { display: block; width: 22px; height: 2.5px; border-radius: 2px; background: #1D1D1F; }
    .menu-ovl { position: fixed; inset: 0; z-index: 120; background: rgba(0,0,0,.32); animation: fdin .18s ease; }
    @keyframes fdin { from { opacity: 0; } to { opacity: 1; } }
    .menu-panel { position: absolute; top: 0; right: 0; bottom: 0; width: min(78vw, 300px); background: #fff; border-left: 1px solid #DDE1E6; padding: 10px 14px calc(20px + env(safe-area-inset-bottom)); display: flex; flex-direction: column; animation: slin .22s cubic-bezier(.32,.72,.35,1); }
    @keyframes slin { from { transform: translateX(100%); } to { transform: translateX(0); } }
    .menu-head { display: flex; justify-content: space-between; align-items: center; min-height: 50px; margin-bottom: 6px; border-bottom: .5px solid rgba(0,0,0,.08); padding-bottom: 8px; }
    .menu-x { width: 34px; height: 34px; border: 1px solid #DDE1E6; border-radius: 8px; background: #fff; color: #48484A; font-size: 14px; cursor: pointer; touch-action: manipulation; }
    .menu-item { display: flex; align-items: center; gap: 12px; width: 100%; border: none; background: none; font-family: inherit; font-size: 16px; font-weight: 600; color: #1D1D1F; padding: 15px 4px; border-bottom: .5px solid rgba(0,0,0,.06); cursor: pointer; text-align: left; letter-spacing: -.01em; touch-action: manipulation; }
    .menu-item:active { background: #F2F2F7; }
    .mi-ic { width: 21px; height: 21px; color: #6E6E73; flex-shrink: 0; }
    .mi-arrow { margin-left: auto; color: #C7C7CC; font-size: 20px; font-weight: 400; }
    .brand { color: #1D1D1F; font-weight: 700; font-size: 17px; letter-spacing: -.02em; display: flex; align-items: center; gap: 8px; }
    .brand b { color: ${accentColor}; font-weight: 700; }
    .brand i { width: 9px; height: 9px; border-radius: 50%; background: ${accentColor}; }
    .hero-stats { display: grid; grid-template-columns: 1fr 1fr 1fr; overflow: hidden; margin-top: 14px; }
    .hs { padding: 16px 16px 14px; border-left: .5px solid rgba(0,0,0,.08); min-width: 0; }
    .hs:first-child { border-left: none; }
    .hs .l { font-size: 12px; color: #86868B; }
    .hs .v { font-variant-numeric: tabular-nums; font-weight: 600; font-size: 19px; margin-top: 2px; letter-spacing: -.02em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .status { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; padding: 4px 11px; border-radius: 6px; background: #F2F2F7; color: #48484A; }
    .status i { width: 7px; height: 7px; border-radius: 50%; }
    .actions { display: flex; flex-wrap: wrap; border-top: .5px solid rgba(0,0,0,.1); margin: 14px -16px -16px; }
    .mark { position: absolute; aspect-ratio: 1; border: 3px solid #FF3B30; border-radius: 50%; transform: translate(-50%, -50%); pointer-events: none; box-shadow: 0 0 0 1.5px rgba(255,255,255,.65); }
    .act { flex: 1; padding: 13px 2px; font-size: 14px; font-weight: 500; background: none; border: none; border-left: .5px solid rgba(0,0,0,.08); color: #3A3A3C; font-family: inherit; cursor: pointer; touch-action: manipulation; white-space: nowrap; letter-spacing: -.01em; }
    .act:first-child { border-left: none; }
    .act:active { background: rgba(0,0,0,.045); }
    .act.ac { font-weight: 700; color: ${accentColor}; }
    .act.dg { color: #FF3B30; }
    input[type=range] { padding: 0; height: 40px; box-shadow: none; accent-color: ${accentColor}; background: transparent; }
    input[type=checkbox] { width: 22px; height: 22px; accent-color: ${accentColor}; }
    @media (hover: hover) and (pointer: fine) {
    .btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 3px 10px rgba(0,0,0,.15); filter: brightness(1.03); }
    .tile:hover { transform: translateY(-2px); box-shadow: 0 6px 16px rgba(0,0,0,.10); }
    .act:hover { background: rgba(0,0,0,.05); }
    .btn-bar:hover { background: rgba(27,127,59,.10); border-radius: 8px; }
    .menu-item:hover { background: #F4F5F7; }
    .mnav:hover { background: rgba(255,255,255,.28); }
    .hbg:hover span { background: #1B7F3B; }
    .ed:hover { background: #F1F8F3; }
  }

  @media print {
      html, body, #root, .root { overflow: visible !important; max-width: none !important; min-height: auto !important; }
      ${printPageBase}
      @page { size: A4 portrait; }
      .no-print, .sticky-foot, .appbar, .menu-ovl, .markmodal { display: none !important; }
      .page-with-foot { padding-bottom: 0 !important; }
      .root { background: #fff !important; padding: 0 !important; }
      .print-area { padding: 0 !important; margin: 0 !important; }
      .print-area > .no-print { display: none !important; }
      .sheet-print {
        box-shadow: none !important; border: none !important; border-radius: 0 !important;
        margin: 0 auto !important; max-width: 100% !important; width: 100% !important;
        padding: ${PRINT_SHEET_PADDING} !important; font-size: 12px;
        break-inside: auto; page-break-inside: auto;
        -webkit-print-color-adjust: exact; print-color-adjust: exact;
      }
      .tblscroll { overflow: visible !important; width: 100% !important; }
      .sheet-print table { min-width: 0 !important; width: 100% !important; table-layout: auto !important; }
      .sheet-print tr, .sheet-print figure { page-break-inside: avoid; break-inside: avoid; }
      .sheet-print h2, .sheet-print h3 { page-break-after: avoid; break-after: avoid; }
      .sheet-print img { max-width: 100% !important; max-height: 88mm; object-fit: contain; }
      .rep-page {
        page-break-after: always; break-after: page;
        margin: 0 auto !important; box-sizing: border-box;
      }
      .rep-page:last-child { page-break-after: auto; break-after: auto; }
      .rep-page img { max-width: 100% !important; max-height: 110mm; object-fit: contain; }
      .pvzoom { transform: none !important; width: 100% !important; max-width: 100% !important; }
      .pvouter { width: auto !important; height: auto !important; overflow: visible !important; margin: 0 !important; }
      .ed { border-bottom: none !important; background: none !important; }
      .card { box-shadow: none !important; }
      .print-photos { display: grid !important; grid-template-columns: 1fr 1fr !important; gap: 8px !important; }
      .print-photos img { width: 100% !important; height: auto !important; border-radius: 4px !important; }
    }
  `;

  if (!loaded) return <div className="root" style={{ display: "grid", placeItems: "center", height: "100vh" }}><style>{css}</style><span className="sub">読み込み中…</span></div>;

  const Toast = () => toast ? (
    <div className="no-print" style={{ position: "fixed", top: 14, left: "50%", transform: "translateX(-50%)", background: INK, color: "#fff", padding: "10px 20px", borderRadius: 22, fontSize: 13, fontWeight: 600, zIndex: 200, whiteSpace: "nowrap" }}>{toast}</div>
  ) : null;

  /* ---------- ホーム ---------- */
  if (view === "home") {
    const active = ests.filter((e) => !e.done);
    const wc = ests.map((e) => ({ e, c: calc(e, set) }));
    const inM = (x) => (x.e.date || "").startsWith(statMonth);
    const won = wc.filter((x) => x.e.status === "受注" && inM(x)), lost = wc.filter((x) => x.e.status === "失注" && inM(x)), open = wc.filter((x) => x.e.status === "提出済" && inM(x));
    const rate = won.length + lost.length ? Math.round(won.length / (won.length + lost.length) * 100) + "%" : "—";
    const shiftM = (d) => { const [y, m] = statMonth.split("-").map(Number); const nd = new Date(y, m - 1 + d, 1); setStatMonth(nd.getFullYear() + "-" + String(nd.getMonth() + 1).padStart(2, "0")); };
    const mLabel = statMonth.split("-")[0] + "年" + Number(statMonth.split("-")[1]) + "月";
    const months6 = [];
    { const [y0, m0] = statMonth.split("-").map(Number);
      for (let k = 5; k >= 0; k--) { const d0 = new Date(y0, m0 - 1 - k, 1); months6.push(d0.getFullYear() + "-" + String(d0.getMonth() + 1).padStart(2, "0")); } }
    const trend = months6.map((m) => ({ m, v: wc.filter((x) => x.e.status === "受注" && (x.e.date || "").startsWith(m)).reduce((s, x) => s + x.c.profit, 0) }));
    const tmax = Math.max(...trend.map((t) => t.v), 1);
    return (
      <div className="root"><style>{css}</style><Toast />
        <header className="appbar no-print"><div className="appbar-in">
          <BrandHeader branding={branding || window.__tenantBranding} />
          <button className="hbg" aria-label="メニュー" onClick={() => setMenuOpen(true)}><span /><span /><span /></button>
        </div></header>
        {menuOpen && (
          <div className="menu-ovl no-print" onClick={() => setMenuOpen(false)}>
            <nav className="menu-panel" onClick={(ev) => ev.stopPropagation()}>
              <div className="menu-head">
                <div className="brand" style={{ paddingLeft: 0 }}><i />メニュー</div>
                <button className="menu-x" aria-label="閉じる" onClick={() => setMenuOpen(false)}>✕</button>
              </div>
              {(() => {
                const ic = {
                  person: <><circle cx="12" cy="8" r="3.6" /><path d="M4.8 19.4c1.3-3.1 4-4.7 7.2-4.7s5.9 1.6 7.2 4.7" /></>,
                  history: <><circle cx="12" cy="12" r="8.4" /><path d="M12 7.4V12l3.2 2" /></>,
                  building: <><rect x="5" y="4" width="14" height="16.4" rx="1.5" /><path d="M9 8.2h1.6M13.4 8.2H15M9 12h1.6M13.4 12H15M10.5 20.4v-3.6h3v3.6" /></>,
                  yen: <><circle cx="12" cy="12" r="8.4" /><path d="M8.8 7.6 12 12l3.2-4.4M12 12v4.8M9.4 12.6h5.2M9.4 15h5.2" /></>,
                  help: <><circle cx="12" cy="12" r="8.4" /><path d="M9.7 9.6c.2-1.3 1.2-2.1 2.4-2.1 1.3 0 2.3.9 2.3 2.1 0 1.7-2.3 1.9-2.3 3.5" /><circle cx="12.1" cy="16.3" r=".4" fill="currentColor" stroke="none" /></>,
                  site: <><path d="M3 21h18" /><path d="M6 21V7l6-4 6 4v14" /><path d="M9 21v-6h6v6" /></>,
                  invite: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M19 8v6M22 11h-6" /></>,
                  logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" /></>,
                };
                const Svg = ({ k }) => (
                  <svg className="mi-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{ic[k]}</svg>
                );
                const items = [
                  ["person", "顧客管理", () => setView("clients")],
                  ["history", "工事経歴", () => setView("history")],
                  ["building", "会社情報", () => { setSetTab("基本情報"); setView("settings"); }],
                  ["yen", "単価設定", () => { setSetTab("タイプ別単価"); setView("settings"); }],
                  ["help", "使い方・ヘルプ", () => { setHelpLog([]); setHelpCat(""); setView("help"); }],
                ];
                if (tenantMode && appShell) {
                  items.push(
                    ["site", "現場管理を開く", () => appShell.switchApp("genba")],
                  );
                  if (appShell.canInvite) {
                    items.push(["invite", "メンバー招待", () => setInviteOpen(true)]);
                  }
                  items.push(["logout", "ログアウト", () => appShell.signOut()]);
                }
                return items.map(([k, label, go]) => (
                  <button key={label} className="menu-item" onClick={() => { setMenuOpen(false); go(); }}>
                    <Svg k={k} />{label}<span className="mi-arrow">›</span>
                  </button>
                ));
              })()}
            </nav>
          </div>
        )}
        {tenantMode && <InvitePanel open={inviteOpen} onClose={() => setInviteOpen(false)} />}
        <div className="wrapx">
          <div className="page-top">
            <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-.02em", margin: 0 }}>見積管理</h1>
            <p className="sub" style={{ margin: 0, fontSize: 13.5, fontWeight: 500 }}>{new Date().toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric", weekday: "short" })}</p>
          </div>

          <div className="home-grid"><div className="home-side">
          <div className="sec-h"><span>実績</span><span className="cnt">棒をタップで月移動</span></div>
          <div className="herox">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <button className="mnav" onClick={() => shiftM(-1)}>‹</button>
              <span style={{ fontSize: 13.5, fontWeight: 700, letterSpacing: ".05em" }}>{mLabel}<span style={{ fontSize: 11, fontWeight: 500, opacity: .65 }}>{statMonth === new Date().toISOString().slice(0, 7) ? "（今月）" : ""}</span></span>
              <button className="mnav" onClick={() => shiftM(1)}>›</button>
            </div>
            <div className="hero-stats" style={{ marginTop: 4 }}>
            {[["提出中", yen(open.reduce((s, x) => s + x.c.total, 0))], ["受注率", rate], ["受注粗利", yen(won.reduce((s, x) => s + x.c.profit, 0))]].map(([l, v]) => (
              <div key={l} className="hs"><div className="l">{l}</div><div className="v">{v}</div></div>
            ))}
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "flex-end", marginTop: 12, padding: "0 2px" }}>
              {trend.map((t) => (
                <button key={t.m} onClick={() => setStatMonth(t.m)} style={{ flex: 1, border: "none", background: "transparent", cursor: "pointer", padding: 0, fontFamily: "inherit" }}>
                  <div style={{ height: 38, display: "flex", alignItems: "flex-end" }}>
                    <div style={{ width: "100%", borderRadius: 4, height: Math.max(3, Math.round((t.v / tmax) * 38)), background: t.m === statMonth ? "#30D158" : "rgba(255,255,255,.22)", transition: "height .3s, background .2s" }} />
                  </div>
                  <div className="num" style={{ fontSize: 9.5, marginTop: 3, color: t.m === statMonth ? "#30D158" : "rgba(255,255,255,.5)", fontWeight: 700 }}>{Number(t.m.split("-")[1])}月</div>
                </button>
              ))}
            </div>
            <div style={{ fontSize: 9.5, color: "rgba(255,255,255,.42)", textAlign: "right", marginTop: 2 }}>受注粗利の推移</div>
          </div>

          <div className="sec-h" style={{ marginTop: 24 }}><span>作成</span></div>
          <div className="tiles">
            <button className="tile tile-ac" onClick={() => { setCur(newEstimate()); setStep(0); setView("wizard"); }}>
              <span className="t">＋ 見積作成</span>
              <span className="d">診断から松竹梅の提案まで3分で完成</span>
            </button>
            <button className="tile tile-w" onClick={() => { setCurRep(newReport()); setView("repEdit"); }}>
              <span className="t">調査報告書作成</span>
              <span className="d">写真から保険品質の報告書</span>
            </button>
          </div>
          </div>

          <div className="home-main">
          <div className="sec-h">
            <span>案件</span>
            <span className="cnt">{active.length ? "進行中 " + active.length + "件" : "進行中の案件はありません"}</span>
          </div>

          {active.length === 0 ? (
            <div className="card" style={{ padding: 32, textAlign: "center" }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#C7C7CC" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ display: "block", margin: "0 auto" }}><rect x="4" y="4" width="13" height="5.2" rx="1.4" /><path d="M17 6.6h2.2a1 1 0 0 1 1 1v2.6a1 1 0 0 1-1 1H12a1 1 0 0 0-1 1v1.6" /><rect x="9.6" y="13.8" width="2.8" height="6.2" rx="1.1" /></svg>
              <p style={{ margin: "8px 0 4px", fontWeight: 700 }}>最初の見積を作成しましょう</p>
              <p className="sub" style={{ margin: 0, fontSize: 13 }}>外周と高さを入れるだけ。診断から松竹梅の提案まで3分で完成します。</p>
              <button className="btn btn-ac" style={{ width: "auto", padding: "12px 28px", marginTop: 14 }} onClick={() => { setCur(newEstimate()); setStep(0); setView("wizard"); }}>＋ 見積作成</button>
            </div>
          ) : (
            <div className="list-col">
              {active.map((e) => {
                const c = calc(e, set);
                const sc = { 受注: "#34C759", 失注: "#8E8E93", 提出済: INK, 作成中: "#FF9F0A" }[e.status];
                const mrate = c.total ? Math.round((c.profit / c.total) * 100) : 0;
                const alert = +set.marginAlert || 15;
                const band = mrate >= alert * 1.5 ? "#34C759" : mrate >= alert ? "#FF9F0A" : "#FF3B30";
                return (
                  <div key={e.id} className="card" style={{ padding: 16, position: "relative", overflow: "hidden" }}>
                    <span style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, background: band }} />
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 12, color: SUB }}>{e.customer || "お客様名未入力"}・{e.date}</div>
                        <div style={{ fontWeight: 700, fontSize: 16, margin: "2px 0 6px" }}>{e.title}<span className="sub" style={{ fontWeight: 500, fontSize: 13 }}>（{e.grade}）</span></div>
                        <span className="status"><i style={{ background: sc }} />{e.status}</span>
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div style={{ fontSize: 11, color: SUB }}>税込</div>
                        <div className="num" style={{ fontSize: 19 }}>{yen(c.total)}</div>
                      </div>
                    </div>
                    <div style={{ margin: "10px 0" }}><MarginBar margin={c.margin} alert={set.marginAlert} /></div>
                    {e.status === "受注" && (
                      <div style={{ fontSize: 12, color: SUB, margin: "-4px 0 8px" }}>実績原価 <span className="num">{yen((e.actuals || []).reduce((s, a) => s + (+a.amount || 0), 0))}</span> ／ 予定 <span className="num">{yen(c.cost)}</span></div>
                    )}
                    <div className="actions no-print">
                      {e.status === "受注" && <button className="act ac" onClick={() => { setCur(e); setView("budget"); }}>原価入力</button>}
                      <button className="act ac" onClick={async () => { await persist(ests.map((x) => (x.id === e.id ? { ...x, status: "受注", done: new Date().toISOString().slice(0, 10) } : x))); flash("完工おめでとうございます！工事経歴に移動しました"); }}>完工</button>
                      <button className="act" onClick={() => { setCur(e); setView("edit"); }}>編集</button>
                      {e.status !== "受注" && <button className="act" onClick={() => { setCur(e); setView("present"); }}>提案</button>}
                      <button className="act" onClick={() => { setCur(e); setDocTab("見積書"); setView("docs"); }}>書類</button>
                      {e.status !== "受注" && <button className="act" onClick={() => copyShare(e)}>LINE</button>}
                      <button className="act" onClick={() => dupEst(e)}>複製</button>
                      <button className="act dg" style={delId === e.id ? { background: "#FF3B30", color: "#fff" } : undefined}
                        onClick={() => {
                          if (delId === e.id) { persist(ests.filter((x) => x.id !== e.id)); try { window.storage.delete("paint-photos-" + e.id); } catch (er) {} setDelId(null); flash("削除しました"); }
                          else { setDelId(e.id); setTimeout(() => setDelId((d) => (d === e.id ? null : d)), 3000); }
                        }}>{delId === e.id ? "本当に削除？" : "削除"}</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="sec-h" style={{ marginTop: 26 }}>
            <span>調査報告書</span>
            <span className="cnt">{reps.length ? reps.length + "件の報告書" : "0件"}</span>
          </div>
          {reps.length === 0 && (
            <div className="card" style={{ padding: "18px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div>
                <p style={{ margin: 0, fontWeight: 700, fontSize: 14 }}>調査報告書はまだありません</p>
                <p className="sub" style={{ margin: "3px 0 0", fontSize: 12.5 }}>現地調査の写真から、保険提出品質の報告書がつくれます</p>
              </div>
              <button className="btn btn-soft btn-mini" onClick={() => { setCurRep(newReport()); setView("repEdit"); }}>作成する</button>
            </div>
          )}
          {reps.length > 0 && (
            <div className="list-col">
              {reps.map((r) => (
                <div key={r.id} className="card" style={{ padding: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                    <div style={{ minWidth: 0 }}>
                      <div className="sub" style={{ fontSize: 12 }}>調査日 <span className="num">{r.date}</span>・写真 <span className="num">{r.count || 0}</span>枚</div>
                      <div style={{ fontSize: 16, fontWeight: 700, margin: "4px 0 2px" }}>{r.name || "物件名未入力"}</div>
                      <div className="sub" style={{ fontSize: 13 }}>{r.site || "場所未入力"}</div>
                    </div>
                    {r.insurance && r.insurance.on && <span className="status" style={{ background: "#FFF4E5", color: "#C25E00", flexShrink: 0 }}><i style={{ background: "#FF9F0A" }} />保険用</span>}
                  </div>
                  <div className="actions no-print">
                    <button className="act" onClick={() => { setCurRep(r); setView("repEdit"); }}>編集</button>
                    <button className="act" onClick={() => { setCurRep(r); setView("repDoc"); }}>報告書</button>
                    <button className="act" onClick={() => repToEstimate(r)}>見積にする</button>
                    <button className="act" onClick={() => dupRep(r)}>複製</button>
                    <button className="act dg" style={repDelId === r.id ? { background: "#FF3B30", color: "#fff" } : undefined}
                      onClick={async () => {
                        if (repDelId === r.id) { await persistReps(reps.filter((x) => x.id !== r.id)); try { window.storage.delete("paint-repph-" + r.id); } catch (er) {} setRepDelId(null); flash("削除しました"); }
                        else { setRepDelId(r.id); setTimeout(() => setRepDelId((d) => (d === r.id ? null : d)), 3000); }
                      }}>{repDelId === r.id ? "本当に削除？" : "削除"}</button>
                  </div>
                </div>
              ))}
            </div>
          )}
          </div>
          </div>
        </div>
      </div>
    );
  }

  /* ---------- ウィザード（3ステップ） ---------- */
  if (view === "wizard" && cur) {
    const isHouse = (cur.workType || "戸建") === "戸建";
    const steps = isHouse ? ["お客様", "建物", "現地診断", "仕様"] : ["お客様", "数量"];
    const last = steps.length - 1;
    const customT = (set.customTypes || []).find((t) => t.name === cur.workType);
    const catalog = customT ? customT.items : ((set.catalogs && set.catalogs[cur.workType]) || CATALOGS[cur.workType] || FACTORY_ITEMS);
    const pick = cur.pick || {};
    const pickTotal = catalog.reduce((s, it) => s + (+pick[it.name] || 0) * it.price, 0);
    const setB = (k, v) => setCur({ ...cur, building: { ...cur.building, [k]: v } });
    const wall = Math.round((+cur.building.L || 0) * (+cur.building.H || 0) * (+cur.building.coef || 0.8) * 10) / 10;
    const canNext = isHouse ? (step === 1 ? wall > 0 : true) : (step === last ? pickTotal > 0 : true);

    const finish = async () => {
      let est;
      if (isHouse) {
        est = { ...cur, items: buildItems(cur, set), notes: autoNotes(cur) };
      } else {
        const cr = set.costRate / 100;
        const items = catalog.filter((it) => +pick[it.name] > 0)
          .map((it) => ({ id: uid(), name: it.name, qty: +pick[it.name], unit: it.unit, price: it.price, cost: Math.round(it.price * cr) }));
        est = { ...cur, items, notes: "・上記金額には消費税を含みます。\n・下地の状態により追加補修をご相談する場合があります。" };
      }
      await saveCur(est);
      setView("present");
      flash("見積が完成しました");
    };

    return (
      <div className="root"><style>{css}</style><Toast />
        <header className="appbar no-print"><div className="appbar-in">
          <button className="btn btn-bar btn-mini" onClick={() => step === 0 ? setView("home") : setStep(step - 1)}>{step === 0 ? "← ホーム" : "← 前へ"}</button>
          <span style={{ fontSize: 15, fontWeight: 700 }}>新しい見積</span>
          <button className="btn btn-bar btn-mini" onClick={() => setView("home")}>✕ 中止</button>
        </div></header>
        <div className="wizwrap" style={{ maxWidth: 560, margin: "0 auto", padding: "14px 16px 40px" }}>
          <div className="steps">
            {steps.map((s, i) => (
              <div key={s} className={"stepd" + (i === step ? " on" : i < step ? " done" : "")} onClick={() => i < step && setStep(i)} style={{ cursor: i < step ? "pointer" : "default" }}>
                <i>{i < step ? "✓" : i + 1}</i><span>{s}</span>
              </div>
            ))}
          </div>

          <div className="eyebrow">STEP {step + 1} / {steps.length}</div>
          <h2 style={{ margin: "4px 0 18px", fontSize: 26, fontWeight: 800, letterSpacing: "-.02em" }}>
            {isHouse ? ["お客様の情報", "建物のサイズ", "劣化の症状は？", "塗料のグレード"][step] : ["お客様の情報", "数量を入れるだけ"][step]}
          </h2>

          {step === 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <Field label="お客様名"><input value={cur.customer} onChange={(e) => setCur({ ...cur, customer: e.target.value })} placeholder="山田 太郎" /></Field>
              <Field label="お客様の住所" hint="契約書の署名欄に自動で入ります（あとからでも入力できます）"><input value={cur.customerAddr || ""} onChange={(e) => setCur({ ...cur, customerAddr: e.target.value })} placeholder="○○市○○町1-2-3" /></Field>
              <Field label="工事場所"><input value={cur.site} onChange={(e) => setCur({ ...cur, site: e.target.value })} placeholder="○○市○○町1-2-3" /></Field>
              <Field label="件名"><input value={cur.title} onChange={(e) => setCur({ ...cur, title: e.target.value })} /></Field>
              <Field label="工事タイプ" hint="戸建は劣化診断つき。その他は数量を入れるだけで完成します">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                  {[...WORKTYPES, ...(set.customTypes || []).map((t) => t.name)].map((w) => {
                    const on = (cur.workType || "戸建") === w;
                    return (
                      <button key={w} onClick={() => setCur({ ...cur, workType: w, title: TYPE_TITLES[w] || w + "工事" })}
                        style={{ border: "none", borderRadius: 12, padding: "13px 4px", fontSize: 14, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", background: on ? "#1B7F3B" : "#F2F2F7", color: on ? "#fff" : "#1D1D1F", transition: "all .12s" }}>
                        {w}
                      </button>
                    );
                  })}
                </div>
              </Field>
            </div>
          )}

          {!isHouse && step === 1 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {catalog.length === 0 && (
                <div className="card" style={{ padding: 20, textAlign: "center" }}>
                  <p className="sub" style={{ margin: 0, fontSize: 13 }}>このタイプの単価項目がまだありません。「単価設定」で項目を追加してください。</p>
                </div>
              )}
              {catalog.map((it) => (
                <div key={it.name} className="card" style={{ padding: "12px 14px", display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{it.name}</div>
                    <div className="sub" style={{ fontSize: 12 }}>{yen(it.price)} / {it.unit}</div>
                  </div>
                  <input className="num" type="number" inputMode="decimal" placeholder="0" value={pick[it.name] || ""}
                    onChange={(e) => setCur({ ...cur, pick: { ...pick, [it.name]: e.target.value } })}
                    style={{ width: 90, textAlign: "right" }} />
                  <span className="sub" style={{ fontSize: 13, width: 28 }}>{it.unit}</span>
                </div>
              ))}
              <div className="card" style={{ padding: "12px 14px" }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>＋ ここにない項目を追加<span className="sub" style={{ fontWeight: 500, fontSize: 11 }}>（単価マスタにも保存され、次回から選べます）</span></div>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <input value={addRow.name} onChange={(e) => setAddRow({ ...addRow, name: e.target.value })} placeholder="項目名" style={{ flex: 1, minWidth: 0, padding: "10px 10px", fontSize: 14 }} />
                  <input className="num" type="number" inputMode="numeric" value={addRow.price} onChange={(e) => setAddRow({ ...addRow, price: e.target.value })} placeholder="単価" style={{ width: 80, textAlign: "right", padding: "10px 8px" }} />
                  <input value={addRow.unit} onChange={(e) => setAddRow({ ...addRow, unit: e.target.value })} placeholder="単位" style={{ width: 48, textAlign: "center", padding: "10px 4px", fontSize: 13 }} />
                  <button className="btn btn-ac btn-mini" style={{ padding: "9px 13px", flexShrink: 0 }} disabled={!addRow.name.trim()}
                    onClick={async () => {
                      const item = { name: addRow.name.trim(), unit: addRow.unit.trim() || "式", price: +addRow.price || 0 };
                      if (customT) await persistSet({ ...set, customTypes: set.customTypes.map((t) => (t.name === cur.workType ? { ...t, items: [...t.items, item] } : t)) });
                      else await persistSet({ ...set, catalogs: { ...(set.catalogs || CATALOGS), [cur.workType]: [...catalog, item] } });
                      setAddRow({ name: "", unit: addRow.unit, price: "" });
                      flash("項目を追加しました");
                    }}>＋</button>
                </div>
              </div>
              <div className="card" style={{ padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span style={{ fontWeight: 700 }}>直接工事費</span>
                <span className="num" style={{ fontSize: 19 }}>{yen(pickTotal)}</span>
              </div>
              <p className="sub" style={{ fontSize: 12, margin: 0 }}>単価は目安です。作成後の編集画面で自由に変更できます。</p>
            </div>
          )}

          {isHouse && step === 1 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <Field label="建物の外周（m）" hint="メジャーで四辺を測って合計。約でOKです。">
                <input className="num" type="number" inputMode="decimal" value={cur.building.L} onChange={(e) => setB("L", e.target.value)} placeholder="40" autoFocus />
              </Field>
              <Field label="軒までの高さ（m）" hint="平屋≒3.5m／2階建て≒6m／3階建て≒8.5m">
                <input className="num" type="number" inputMode="decimal" value={cur.building.H} onChange={(e) => setB("H", e.target.value)} />
              </Field>
              <Field label="屋根面積（㎡）※屋根も塗る場合のみ">
                <input className="num" type="number" inputMode="decimal" value={cur.building.roofArea} onChange={(e) => setB("roofArea", e.target.value)} placeholder="未入力可" />
              </Field>
              {wall > 0 && (
                <div className="card" style={{ padding: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>外壁塗装面積（自動計算）</span>
                  <span className="num" style={{ fontSize: 22, color: AC }}>{wall} ㎡</span>
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div>
              <p className="sub" style={{ margin: "0 0 12px", fontSize: 14 }}>当てはまるものをタップ。必要な工事が自動で見積に入り、診断コメントが見積書に載ります。</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {SYMPTOMS.map((s) => {
                  const on = cur.symptoms.includes(s.id);
                  return (
                    <button key={s.id} onClick={() => setCur({ ...cur, symptoms: on ? cur.symptoms.filter((x) => x !== s.id) : [...cur.symptoms, s.id] })}
                      style={{ textAlign: "left", padding: "15px 16px", borderRadius: 14, border: "none", fontFamily: "inherit", fontSize: 15, fontWeight: 600, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", background: on ? AC : "#fff", color: on ? "#fff" : INK, boxShadow: on ? "none" : "inset 0 0 0 1px #E5E5EA", transition: "all .15s" }}>
                      {s.label}<span>{on ? "✓" : "＋"}</span>
                    </button>
                  );
                })}
                {(cur.customSyms || []).map((s) => {
                  const on = cur.symptoms.includes(s.id);
                  return (
                    <div key={s.id} style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => setCur({ ...cur, symptoms: on ? cur.symptoms.filter((x) => x !== s.id) : [...cur.symptoms, s.id] })}
                        style={{ flex: 1, textAlign: "left", padding: "15px 16px", borderRadius: 14, border: "none", fontFamily: "inherit", fontSize: 15, fontWeight: 600, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", background: on ? "#1B7F3B" : "#fff", color: on ? "#fff" : "#1D1D1F", transition: "all .15s" }}>
                        {s.label}<span>{on ? "✓" : "＋"}</span>
                      </button>
                      <button onClick={() => setCur({ ...cur, customSyms: (cur.customSyms || []).filter((x) => x.id !== s.id), symptoms: cur.symptoms.filter((x) => x !== s.id) })}
                        style={{ border: "none", borderRadius: 14, width: 46, background: "#F2F2F7", color: "#FF3B30", fontSize: 15, cursor: "pointer", fontFamily: "inherit" }}>✕</button>
                    </div>
                  );
                })}
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <input value={symIn} onChange={(e) => setSymIn(e.target.value)} placeholder="その他の症状を入力（例：雨漏り跡）" />
                <button className="btn btn-soft btn-mini" style={{ flexShrink: 0, alignSelf: "stretch" }} disabled={!symIn.trim()}
                  onClick={() => {
                    const id = "c" + uid();
                    setCur({ ...cur, customSyms: [...(cur.customSyms || []), { id, label: symIn.trim() }], symptoms: [...cur.symptoms, id] });
                    setSymIn("");
                  }}>追加</button>
              </div>
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>現場写真（診断報告書に自動掲載）</div>
                <PhotoGrid photos={photos} onTag={tagPhoto} onDel={delPhoto} />
                <PhotoAdd onFiles={addPhotoFiles} label="＋ 写真を追加（カメラ / アルバム）" />
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <Seg options={GRADES.map((g) => g.name)} value={cur.grade} onChange={(g) => setCur({ ...cur, grade: g })} />
              <div className="card" style={{ padding: 18, marginTop: 14 }}>
                {(() => {
                  const g = GRADES.find((x) => x.name === cur.grade);
                  return (
                    <>
                      <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0" }}><span className="sub">㎡単価（3回塗り）</span><span className="num">{yen(set.gradePrices[cur.grade])}</span></div>
                      <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0" }}><span className="sub">期待耐用年数</span><span className="num">約{g.years}年</span></div>
                      {g.popular && <div style={{ marginTop: 8, fontSize: 12, fontWeight: 700, color: AC }}>★ いちばん選ばれているグレードです</div>}
                    </>
                  );
                })()}
              </div>
              <p className="sub" style={{ fontSize: 13, marginTop: 12 }}>あとで「お客様に提案」画面で、3グレードを並べた比較を見せられます。ここでは仮でOK。</p>
            </div>
          )}

          <button className="btn btn-ac" style={{ marginTop: 24 }} disabled={!canNext}
            onClick={() => step < last ? setStep(step + 1) : finish()}>
            {step < last ? "次へ" : "見積を作成する"}
          </button>
        </div>
      </div>
    );
  }

  /* ---------- カラーシミュレーション ---------- */
  if (view === "colorsim" && cur) {
    return (
      <div className="root"><style>{css}</style><Toast />
        <ColorSim photos={photos} onFiles={addPhotoFiles}
          onSave={async (data, name) => {
            if (photos.length >= 8) { flash("写真は8枚までです。先に削除してください"); return; }
            await savePhotos([...photos, { id: uid(), tag: "シミュレーション", note: name, data }]);
            flash("報告書の写真に追加しました");
          }}
          onClose={() => setView("present")} />
      </div>
    );
  }

  /* ---------- お客様提案（松竹梅比較） ---------- */
  if (view === "present" && cur) {
    const wallItem = cur.items.find((i) => i.name.startsWith("外壁塗装"));
    const variants = GRADES.map((g) => {
      const items = cur.items.map((i) => {
        if (i.name.startsWith("外壁塗装")) return { ...i, name: `外壁塗装（${g.name} 3回塗り）`, price: set.gradePrices[g.name], cost: Math.round(set.gradePrices[g.name] * set.costRate / 100) };
        if (i.name.startsWith("屋根塗装")) return { ...i, name: `屋根塗装（${g.name}）` };
        return i;
      });
      const c = calc({ ...cur, items }, set);
      return { g, items, c, perYear: c.total / g.years };
    });
    const rv = cur.rival || { price: "", grade: "シリコン" };
    return (
      <div className="root"><style>{css}</style><Toast />
        <header className="appbar no-print"><div className="appbar-in">
          <div style={{ display: "flex" }}>
            <button className="btn btn-bar btn-mini" onClick={async () => { await saveCur(cur); setView("home"); }}>← ホーム</button>
            <button className="btn btn-bar btn-mini" onClick={async () => { await saveCur(cur); setStep(Math.min(step, (cur.workType || "戸建") === "戸建" ? 3 : 1)); setView("wizard"); }}>入力へ戻る</button>
          </div>
          <button className="btn btn-bar btn-mini" onClick={async () => { await saveCur(cur); setView("edit"); }}>内訳を編集</button>
        </div></header>
        <div className="colw-l" style={{ maxWidth: 680, margin: "0 auto", padding: "18px 16px 40px" }}>
          <div className="eyebrow">{cur.customer ? cur.customer + " 様" : "ご提案"}</div>
          <h2 style={{ margin: "4px 0 6px", fontSize: 26, fontWeight: 800, letterSpacing: "-.02em" }}>プランのご提案</h2>
          <p className="sub" style={{ margin: "0 0 16px", fontSize: 14 }}>同じ工事内容で、塗料グレード別の3プランです。長い目で見た「1年あたりの費用」もご覧ください。</p>
          <div className="plans">
            {!wallItem && (
              <div className="card" style={{ padding: 20 }}>
                <div className="sub" style={{ fontSize: 13 }}>{cur.title}{cur.workType && cur.workType !== "戸建" ? "（" + cur.workType + "）" : ""}</div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 4 }}>
                  <span style={{ fontWeight: 700 }}>御見積金額（税込）</span>
                  <span className="num" style={{ fontSize: 26 }}>{yen(calc(cur, set).total)}</span>
                </div>
                <p className="sub" style={{ fontSize: 12, margin: "10px 0 0" }}>グレード比較（松竹梅）は、外壁塗装を含む見積で表示されます。</p>
              </div>
            )}
            {wallItem && variants.map(({ g, c, perYear }) => {
              const chosen = cur.grade === g.name;
              return (
                <div key={g.name} className="card" style={{ padding: 18, position: "relative", outline: chosen ? `2px solid ${accentColor}` : "none" }}>
                  {g.popular && <span style={{ position: "absolute", top: -10, left: 16, background: AC, color: "#fff", fontSize: 11, fontWeight: 700, borderRadius: 8, padding: "3px 10px" }}>人気 No.1</span>}
                  <div>
                    <div style={{ fontSize: 17, fontWeight: 800, whiteSpace: "nowrap" }}>{g.name}プラン</div>
                    <div className="sub" style={{ fontSize: 12.5, whiteSpace: "nowrap" }}>期待耐用年数 約{g.years}年</div>
                    <div style={{ marginTop: 10 }}>
                      <span className="num" style={{ fontSize: 24 }}>{yen(c.total)}</span>
                      <span className="sub" style={{ fontSize: 12, marginLeft: 6 }}>税込</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, padding: "10px 12px", background: "#F5F5F7", borderRadius: 10 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap" }}>1年あたり</span>
                    <span className="num" style={{ fontSize: 15, whiteSpace: "nowrap" }}>{yen(perYear)} / 年</span>
                  </div>
                  <button className={"btn btn-mini " + (chosen ? "btn-ac" : "btn-soft")} style={{ marginTop: 12 }}
                    onClick={async () => {
                      const v = variants.find((x) => x.g.name === g.name);
                      await saveCur({ ...cur, grade: g.name, items: v.items });
                      flash(g.name + "プランを選択しました");
                    }}>
                    {chosen ? "✓ このプランで見積中" : "このプランにする"}
                  </button>
                </div>
              );
            })}
          </div>
          {wallItem && (
            <div className="card" style={{ padding: 18, marginTop: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 800 }}>AI提案文</div>
                  <p className="sub" style={{ fontSize: 12, margin: "2px 0 0" }}>診断結果から、お客様向けの説明文を自動作成（診断報告書にも掲載されます）</p>
                </div>
                <button className="btn btn-ac btn-mini" disabled={aiBusy} onClick={genAI} style={{ flexShrink: 0 }}>{aiBusy ? "生成中…" : cur.aiText ? "作り直す" : "つくる"}</button>
              </div>
              {cur.aiText && (
                <div style={{ marginTop: 10, background: "#F5F5F7", borderRadius: 10, padding: 12, fontSize: 13, lineHeight: 1.8, whiteSpace: "pre-wrap" }}>{cur.aiText}</div>
              )}
            </div>
          )}

          <div className="card" style={{ padding: 18, marginTop: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800 }}>カラーシミュレーション</div>
                <p className="sub" style={{ fontSize: 12, margin: "2px 0 0" }}>撮った外壁写真の色を、その場で塗り替えてお見せできます</p>
              </div>
              <button className="btn btn-ac btn-mini" style={{ flexShrink: 0 }} onClick={async () => { await saveCur(cur); setView("colorsim"); }}>開く</button>
            </div>
          </div>

          {wallItem && (
            <div className="card" style={{ padding: 18, marginTop: 14 }}>
              <div style={{ fontSize: 16, fontWeight: 800 }}>相見積と比較する</div>
              <p className="sub" style={{ fontSize: 13, margin: "4px 0 12px" }}>他社の見積額を入れると、耐用年数まで含めた「1年あたりの本当の差」をその場でお見せできます。</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <Field label="他社の見積額（税込）"><input className="num" type="number" inputMode="numeric" value={rv.price} onChange={(e) => setCur({ ...cur, rival: { ...rv, price: e.target.value } })} placeholder="1500000" /></Field>
                <Field label="他社の塗料グレード">
                  <select value={rv.grade} onChange={(e) => setCur({ ...cur, rival: { ...rv, grade: e.target.value } })}>
                    {GRADES.map((g) => <option key={g.name}>{g.name}</option>)}
                  </select>
                </Field>
              </div>
              {+rv.price > 0 && (() => {
                const rg = GRADES.find((g) => g.name === rv.grade);
                const mine = variants.find((v) => v.g.name === cur.grade) || variants[1];
                const rivalPY = +rv.price / rg.years;
                const diff = rivalPY - mine.perYear;
                const span = Math.max(rg.years, mine.g.years);
                const maxPY = Math.max(mine.perYear, rivalPY);
                return (
                  <div style={{ marginTop: 12 }}>
                    {[["当社（" + mine.g.name + "・約" + mine.g.years + "年）", mine.perYear, AC], ["他社（" + rv.grade + "・約" + rg.years + "年）", rivalPY, "#8E8E93"]].map(([l, v, col]) => (
                      <div key={l} style={{ marginBottom: 8 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}><span>{l}</span><span className="num">{yen(v)}/年</span></div>
                        <div style={{ height: 8, background: "#E9E9EB", borderRadius: 4, overflow: "hidden", marginTop: 3 }}>
                          <div style={{ width: `${Math.min(100, (v / maxPY) * 100)}%`, height: "100%", background: col, transition: "width .3s" }} />
                        </div>
                      </div>
                    ))}
                    <div style={{ marginTop: 10, padding: "10px 12px", borderRadius: 10, background: diff > 0 ? "#EAF7F0" : "#FDECEC", color: diff > 0 ? "#248A3D" : "#FF3B30", fontSize: 13, fontWeight: 700 }}>
                      {diff > 0
                        ? "1年あたり " + yen(diff) + " 当社がお得。" + span + "年間では約 " + yen(Math.round(diff * span)) + " の差になります"
                        : "年あたりでは他社が " + yen(-diff) + " 安い計算です。耐用年数・保証・施工品質もあわせてご検討ください"}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          <div className="no-print" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 18 }}>
            <button className="btn btn-ac" onClick={async () => { await saveCur(cur); setDocTab("見積書"); setView("docs"); }}>見積書を出す</button>
            <button className="btn btn-soft" onClick={async () => { await saveCur(cur); copyShare(cur); }}>LINEで送る文面</button>
          </div>
        </div>
      </div>
    );
  }

  /* ---------- 編集 ---------- */
  if (view === "edit" && cur) {
    const c = calc(cur, set);
    const setItem = (id, k, v) => setCur({ ...cur, items: cur.items.map((i) => (i.id === id ? { ...i, [k]: v } : i)) });
    const maxD = Math.max(1000, Math.round((c.direct + c.overhead) * 0.15 / 1000) * 1000);
    return (
      <div className="root"><style>{css}</style><Toast />
        <header className="appbar no-print"><div className="appbar-in">
          <button className="btn btn-bar btn-mini" onClick={async () => { await saveCur(cur); setView("home"); flash("保存しました"); }}>← 保存して戻る</button>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-bar btn-mini" onClick={() => setView("present")}>提案画面</button>
            <button className="btn btn-ac btn-mini" onClick={async () => { await saveCur(cur); setDocTab("見積書"); setView("docs"); }}>書類</button>
          </div>
        </div></header>
        <div className="colw page-with-foot" style={{ maxWidth: 620, margin: "0 auto", padding: "18px 16px" }}>
          <h2 style={{ margin: "0 0 14px", fontSize: 24, fontWeight: 800 }}>内訳の編集</h2>

          <div className="card" style={{ padding: 16, marginBottom: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={{ gridColumn: "1/-1" }}><Field label="お客様名"><input value={cur.customer} onChange={(e) => setCur({ ...cur, customer: e.target.value })} /></Field></div>
            <div style={{ gridColumn: "1/-1" }}><Field label="お客様の住所（契約書用）"><input value={cur.customerAddr || ""} onChange={(e) => setCur({ ...cur, customerAddr: e.target.value })} placeholder="○○市○○町1-2-3" /></Field></div>
            <Field label="見積日"><input type="date" value={cur.date} onChange={(e) => setCur({ ...cur, date: e.target.value })} /></Field>
            <Field label="ステータス">
              <select value={cur.status} onChange={(e) => setCur({ ...cur, status: e.target.value })}>
                {["作成中", "提出済", "受注", "失注"].map((s) => <option key={s}>{s}</option>)}
              </select>
            </Field>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 12 }}>
            {cur.items.map((it) => (
              <div key={it.id} className="card" style={{ padding: 14 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div style={{ gridColumn: "1/-1", display: "flex", gap: 8 }}>
                    <input value={it.name} onChange={(e) => setItem(it.id, "name", e.target.value)} placeholder="項目名" />
                    <button className="btn btn-soft btn-mini" style={{ color: "#FF3B30", flexShrink: 0 }} onClick={() => setCur({ ...cur, items: cur.items.filter((i) => i.id !== it.id) })}>削除</button>
                  </div>
                  <Field label="数量"><input className="num" type="number" inputMode="decimal" value={it.qty} onChange={(e) => setItem(it.id, "qty", e.target.value)} /></Field>
                  <Field label="単位"><input value={it.unit} onChange={(e) => setItem(it.id, "unit", e.target.value)} /></Field>
                  <Field label="単価"><input className="num" type="number" inputMode="numeric" value={it.price} onChange={(e) => { const p = e.target.value; setCur({ ...cur, items: cur.items.map((i) => i.id === it.id ? { ...i, price: p, cost: Math.round((+p || 0) * set.costRate / 100) } : i) }); }} /></Field>
                  <Field label="原価（社内用）"><input className="num" type="number" inputMode="numeric" value={it.cost} onChange={(e) => setItem(it.id, "cost", e.target.value)} /></Field>
                </div>
                <div style={{ textAlign: "right", marginTop: 8, fontSize: 14 }}>
                  <span className="sub">金額 </span><span className="num" style={{ fontSize: 16 }}>{yen(it.qty * it.price)}</span>
                </div>
              </div>
            ))}
            <button className="btn btn-soft" onClick={() => setCur({ ...cur, items: [...cur.items, { id: uid(), name: "", qty: 1, unit: "式", price: 0, cost: 0 }] })}>＋ 行を追加</button>
          </div>

          <div className="card" style={{ padding: 16, marginBottom: 12 }}>
            <div style={{ fontWeight: 700, marginBottom: 10 }}>現場写真 <span className="sub" style={{ fontSize: 12, fontWeight: 500 }}>（診断報告書に自動掲載・最大8枚）</span></div>
            <PhotoGrid photos={photos} onTag={tagPhoto} onDel={delPhoto} />
            <PhotoAdd onFiles={addPhotoFiles} label="＋ 写真を追加（カメラ / アルバム）" />
          </div>

          <div className="card" style={{ padding: 16, marginBottom: 12 }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>値引きシミュレーター</div>
            <input type="range" min={0} max={maxD} step={1000} value={+cur.discount || 0} onChange={(e) => setCur({ ...cur, discount: +e.target.value })} />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
              <span className="sub">値引き</span><span className="num">{yen(cur.discount)}</span>
            </div>
            <div style={{ marginTop: 8 }}><MarginBar margin={c.margin} alert={set.marginAlert} /></div>
            {c.margin < set.marginAlert && c.beforeTax > 0 && (
              <div style={{ marginTop: 10, background: "#FDECEC", color: "#FF3B30", borderRadius: 10, padding: "10px 12px", fontSize: 13, fontWeight: 700 }}>粗利率が目標（{set.marginAlert}%）を下回っています</div>
            )}
            <div style={{ marginTop: 12, borderTop: "1px solid #F0F0F2", paddingTop: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>過去の受注データから（勝率学習）</div>
              {(() => {
                const ws = winStats(ests, set);
                if (ws.n < 3) return <p className="sub" style={{ fontSize: 12, margin: 0 }}>データ蓄積中（{ws.n}件）。受注・失注を入力するほど「通る価格」の精度が上がります。</p>;
                const here = ws.rows.find((r) => c.margin >= r.a && c.margin < r.b);
                const cand = ws.rows.filter((r) => r.n >= 2);
                const best = cand.length ? cand.slice().sort((x, y) => y.won / y.n - x.won / x.n)[0] : null;
                return (
                  <div>
                    {ws.rows.map((r) => (
                      <div key={r.l} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, padding: "3px 0", fontWeight: here && here.l === r.l ? 700 : 400 }}>
                        <span style={{ minWidth: 64 }}>{r.l}</span>
                        <div style={{ flex: 1, height: 6, background: "#E9E9EB", borderRadius: 3, overflow: "hidden" }}>
                          <div style={{ width: `${r.n ? (r.won / r.n) * 100 : 0}%`, height: "100%", background: here && here.l === r.l ? "#1B7F3B" : "#8E8E93" }} />
                        </div>
                        <span className="num" style={{ minWidth: 90, textAlign: "right" }}>{r.n ? Math.round((r.won / r.n) * 100) + "%（" + r.n + "件）" : "－"}</span>
                      </div>
                    ))}
                    {here && best && (
                      <p style={{ fontSize: 12, margin: "8px 0 0", fontWeight: 700, color: here.l === best.l ? "#248A3D" : "#FF9F0A" }}>
                        {here.l === best.l ? "✓ いま、過去実績で最も通りやすい粗利率帯です" : "過去実績では " + best.l + " 帯が最も通っています（受注率 " + Math.round((best.won / best.n) * 100) + "%）"}
                      </p>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>

          <div className="card" style={{ padding: 16 }}>
            <Field label="備考（診断コメントが自動で入ります）">
              <textarea rows={5} value={cur.notes} onChange={(e) => setCur({ ...cur, notes: e.target.value })} />
            </Field>
          </div>
        </div>

        <div className="sticky-foot no-print">
          <div className="sticky-foot-in">
            <div style={{ flex: 1 }}><MarginBar margin={c.margin} alert={set.marginAlert} /></div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div style={{ fontSize: 11, color: SUB, fontWeight: 600 }}>合計（税込）</div>
              <div className="num" style={{ fontSize: 22 }}>{yen(c.total)}</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ---------- 調査報告書：作成・編集 ---------- */
  if (view === "repEdit" && curRep) {
    const r = curRep;
    const put = (patch) => saveCurRep({ ...r, ...patch });
    const putPhoto = (id, patch) => saveRepPhotos(repPhotos.map((p) => (p.id === id ? { ...p, ...patch } : p)));
    return (
      <div className="root"><style>{css}</style><Toast />
        <header className="appbar no-print"><div className="appbar-in">
          <button className="btn btn-bar btn-mini" onClick={() => setView("home")}>← 保存して戻る</button>
          <button className="btn btn-ac btn-mini" onClick={() => setView("repDoc")}>報告書を見る</button>
        </div></header>
        <div className="colw page-with-foot" style={{ maxWidth: 620, margin: "0 auto", padding: "18px 16px" }}>
          <div className="eyebrow">SURVEY REPORT</div>
          <h2 style={{ margin: "4px 0 14px", fontSize: 24, fontWeight: 800 }}>調査報告書の作成</h2>

          <div className="eyebrow" style={{ margin: "0 4px 8px" }}>1. 物件情報</div>
          <div className="card" style={{ padding: 16, marginBottom: 16, display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }} className="grid-2-mobile">
              <Field label="調査日"><input type="date" value={r.date} onChange={(e) => put({ date: e.target.value })} /></Field>
              <Field label="宛先（任意）"><input value={r.customer} onChange={(e) => put({ customer: e.target.value })} placeholder="○○様 / ○○御中" /></Field>
            </div>
            <Field label="物件名"><input value={r.name} onChange={(e) => put({ name: e.target.value })} placeholder="○○ビル / ○○様邸" /></Field>
            <Field label="現場場所"><input value={r.site} onChange={(e) => put({ site: e.target.value })} placeholder="○○市○○町1-2-3" /></Field>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }} className="grid-2-mobile">
              <Field label="既存下地"><input value={r.base} onChange={(e) => put({ base: e.target.value })} placeholder="RC構造 / サイディング" /></Field>
              <Field label="工事仕様"><input value={r.spec} onChange={(e) => put({ spec: e.target.value })} /></Field>
              <Field label="築年数（任意）"><input value={r.age || ""} onChange={(e) => put({ age: e.target.value })} placeholder="築15年" /></Field>
              <Field label="調査員（任意）"><input value={r.inspector || ""} onChange={(e) => put({ inspector: e.target.value })} placeholder="山田 太郎" /></Field>
            </div>
            <Field label="調査方法" hint="定期報告・保険提出では調査方法の明記が求められます">
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {REP_METHODS.map((M) => {
                  const on = (r.methods || []).includes(M);
                  return (
                    <button key={M} onClick={() => put({ methods: on ? (r.methods || []).filter((x) => x !== M) : [...(r.methods || []), M] })}
                      style={{ border: "none", borderRadius: 20, padding: "7px 14px", fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", background: on ? "#1D1D1F" : "#F2F2F7", color: on ? "#fff" : "#1D1D1F" }}>{M}</button>
                  );
                })}
              </div>
            </Field>
            <Field label="表紙写真（建物の全景）" hint="保険提出では全景→接写の順が通りやすくなります">
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                {r.cover ? <img src={r.cover} alt="表紙" style={{ width: 96, height: 68, objectFit: "cover", borderRadius: 10 }} /> : <div style={{ width: 96, height: 68, borderRadius: 10, background: "#F2F2F7", display: "grid", placeItems: "center", fontSize: 11, color: "#AEAEB2" }}>未設定</div>}
                <label className="btn btn-soft btn-mini" style={{ cursor: "pointer" }}>
                  {r.cover ? "変更" : "写真を選ぶ"}
                  <input type="file" accept="image/*" style={{ display: "none" }}
                    onChange={async (e) => { const f = e.target.files && e.target.files[0]; e.target.value = ""; if (!f) return; try { put({ cover: await readPhoto(f) }); } catch (er) { flash("画像を読み込めませんでした"); } }} />
                </label>
              </div>
            </Field>
            <Field label="図面（配置図・立面図の写真 任意）" hint="図面をタップすると撮影位置の番号マーカーが付きます。写真の箇所グループ(1)(2)…の順にタップしてください">
              {!r.plan ? (
                <label className="btn btn-soft btn-mini" style={{ cursor: "pointer", alignSelf: "flex-start" }}>
                  図面の写真を選ぶ
                  <input type="file" accept="image/*" style={{ display: "none" }}
                    onChange={async (e) => { const f = e.target.files && e.target.files[0]; e.target.value = ""; if (!f) return; try { put({ plan: await readPhoto(f) }); } catch (er) { flash("画像を読み込めませんでした"); } }} />
                </label>
              ) : (
                <div>
                  <div style={{ position: "relative", cursor: "crosshair", borderRadius: 10, overflow: "hidden" }}
                    onClick={(e) => { const rc = e.currentTarget.getBoundingClientRect(); const x = Math.round(((e.clientX - rc.left) / rc.width) * 100); const y = Math.round(((e.clientY - rc.top) / rc.height) * 100); put({ planMarks: [...(r.planMarks || []), { x, y, n: (r.planMarks || []).length + 1 }] }); }}>
                    <img src={r.plan} alt="図面" style={{ width: "100%", display: "block" }} />
                    {(r.planMarks || []).map((m) => (
                      <span key={m.n} style={{ position: "absolute", left: m.x + "%", top: m.y + "%", transform: "translate(-50%, -100%)", background: "#FF3B30", color: "#fff", borderRadius: 6, padding: "2px 7px", fontSize: 12, fontWeight: 800, boxShadow: "0 1px 4px rgba(0,0,0,.35)" }} className="num">{m.n}</span>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    {(r.planMarks || []).length > 0 && <button className="btn btn-soft btn-mini" onClick={() => put({ planMarks: (r.planMarks || []).slice(0, -1) })}>マーカーを1つ取消</button>}
                    <button className="btn btn-soft btn-mini" style={{ color: "#FF3B30" }} onClick={() => put({ plan: "", planMarks: [] })}>図面を削除</button>
                  </div>
                </div>
              )}
            </Field>
            <div style={{ background: r.insurance.on ? "#FFF1E2" : "#F7F7F9", borderRadius: 12, padding: "12px 14px", boxShadow: r.insurance.on ? "inset 0 0 0 1.5px #FF9F0A" : "none", transition: "all .2s" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, fontWeight: 700 }}>
                <input type="checkbox" style={{ width: 22, height: 22, accentColor: "#FF9F0A" }} checked={r.insurance.on} onChange={(e) => put({ insurance: { ...r.insurance, on: e.target.checked } })} />
                火災保険 提出用モード
                {r.insurance.on && <span style={{ background: "#FF9F0A", color: "#fff", borderRadius: 20, padding: "3px 11px", fontSize: 11.5, fontWeight: 800, marginLeft: "auto" }}>✓ ON</span>}
              </label>
              {r.insurance.on && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }} className="grid-2-mobile">
                  <Field label="被災日（わかれば）"><input type="date" value={r.insurance.eventDate} onChange={(e) => put({ insurance: { ...r.insurance, eventDate: e.target.value } })} /></Field>
                  <Field label="想定される原因">
                    <select value={r.insurance.cause} onChange={(e) => put({ insurance: { ...r.insurance, cause: e.target.value } })}>
                      {REP_CAUSES.map((c) => <option key={c}>{c}</option>)}
                    </select>
                  </Field>
                  <p className="sub" style={{ gridColumn: "1/-1", fontSize: 11.5, margin: 0 }}>撮影日が各写真に自動記載されます。各箇所は「全景→接写」の2枚以上で撮ると審査に通りやすくなります。</p>
                </div>
              )}
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "0 4px 8px" }}>
            <div className="eyebrow" style={{ margin: 0 }}>2. 現場写真 <span style={{ color: "#8A929B" }}>（{repPhotos.length}枚）</span></div>
            {repPhotos.length > 1 && (
              <button className="btn btn-bar btn-mini" onClick={() => { const l = [...repPhotos].sort((a, b) => REP_LOCS.indexOf(a.loc) - REP_LOCS.indexOf(b.loc)); saveRepPhotos(l); flash("箇所順に整列しました（番号も揃います）"); }}>箇所順に整列</button>
            )}
          </div>
          {repPhotos.map((p, idx) => (
            <div key={p.id} className="card" style={{ padding: 14, marginBottom: 12 }}>
              <div style={{ display: "flex", gap: 12 }} className="rep-photo-row">
                <div className="rep-thumb" style={{ position: "relative", width: 108, height: 108, flexShrink: 0, cursor: "zoom-in" }} onClick={() => { setMarkEdit(p.id); setMarkSize(16); }}>
                  <img src={p.data} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 12, display: "block" }} />
                  {(p.marks || []).map((m, mi) => <span key={mi} className="mark" style={{ left: m.x + "%", top: m.y + "%", width: (m.s || 16) + "%" }} />)}
                  {(p.marks || []).length > 0 && <span style={{ position: "absolute", right: 4, bottom: 4, background: "#FF3B30", color: "#fff", borderRadius: 8, padding: "1px 6px", fontSize: 10, fontWeight: 800 }} className="num">○{(p.marks || []).length}</span>}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span className="sub num" style={{ fontSize: 12 }}>写真 {idx + 1}</span>
                    <div style={{ display: "flex", gap: 4 }}>
                      {idx > 0 && <button className="btn btn-soft btn-mini" style={{ padding: "4px 8px", fontSize: 11.5 }} onClick={() => { const pv = repPhotos[idx - 1]; updRepPhoto(p.id, { loc: pv.loc, sym: pv.sym, text: pv.text, grade: pv.grade || "" }); flash("前の写真の箇所・症状をコピーしました"); }}>前と同じ</button>}
                      <button className="btn btn-soft btn-mini" style={{ padding: "4px 10px" }} disabled={idx === 0} onClick={() => { const l = [...repPhotos]; [l[idx - 1], l[idx]] = [l[idx], l[idx - 1]]; saveRepPhotos(l); }}>↑</button>
                      <button className="btn btn-soft btn-mini" style={{ padding: "4px 10px" }} disabled={idx === repPhotos.length - 1} onClick={() => { const l = [...repPhotos]; [l[idx + 1], l[idx]] = [l[idx], l[idx + 1]]; saveRepPhotos(l); }}>↓</button>
                      <button className="btn btn-soft btn-mini" style={{ color: "#FF3B30", padding: "4px 10px" }} onClick={() => saveRepPhotos(repPhotos.filter((x) => x.id !== p.id))}>✕</button>
                    </div>
                  </div>
                  <p className="sub" style={{ fontSize: 11, margin: "4px 0 0" }}>写真をタップすると拡大して、正確な位置に赤丸を付けられます</p>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                    {REP_LOCS.map((L) => (
                      <button key={L} onClick={() => putPhoto(p.id, { loc: L })}
                        style={{ border: "none", borderRadius: 20, padding: "6px 12px", fontSize: 12, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", background: p.loc === L ? "#1D1D1F" : "#F2F2F7", color: p.loc === L ? "#fff" : "#1D1D1F" }}>{L}</button>
                    ))}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
                {REP_SYMS.map(([S, T]) => (
                  <button key={S} onClick={() => putPhoto(p.id, { sym: S, text: T })}
                    style={{ border: "none", borderRadius: 20, padding: "7px 13px", fontSize: 12.5, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", background: p.sym === S ? "#1B7F3B" : "#F2F2F7", color: p.sym === S ? "#fff" : "#1D1D1F" }}>{S}</button>
                ))}
              </div>
              {r.insurance.on && p.sym && ["コケ・藻", "チョーキング", "シーリング劣化", "黒ずみ・汚れ", "防水層の劣化"].includes(p.sym) && (
                <p style={{ fontSize: 11.5, color: "#C25E00", background: "#FFF6EB", borderRadius: 8, padding: "7px 10px", margin: "8px 0 0", lineHeight: 1.6 }}>⚠ 「{p.sym}」は経年劣化として保険対象外と判断されることがあります。災害起因の損傷（破損・雨漏り跡・飛来物痕など）と報告書を分けることをおすすめします。</p>
              )}
              <div style={{ display: "flex", gap: 6, marginTop: 10, alignItems: "center" }}>
                <span className="sub" style={{ fontSize: 12, fontWeight: 600, flexShrink: 0 }}>劣化度</span>
                {REP_GRADES.map(([G, gl, , gc]) => (
                  <button key={G} onClick={() => putPhoto(p.id, { grade: p.grade === G ? "" : G })}
                    style={{ border: p.grade === G ? "none" : "1.5px solid " + gc, borderRadius: 10, padding: "6px 0", flex: 1, fontSize: 12.5, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", background: p.grade === G ? gc : "#fff", color: p.grade === G ? "#fff" : gc }}>{G} {gl}</button>
                ))}
              </div>
              {(p.sym || p.text) && (
                <textarea rows={3} value={p.text} onChange={(e) => putPhoto(p.id, { text: e.target.value })} style={{ marginTop: 10, fontSize: 13 }} placeholder="解説文（症状をタップすると自動で入ります）" />
              )}
            </div>
          ))}
          <PhotoAdd onFiles={addRepPhotoFiles} label="＋ 写真を追加（カメラ / アルバム・複数可）" />

          <div className="eyebrow" style={{ margin: "20px 4px 8px" }}>3. 診断結果（総評）</div>
          <div className="card" style={{ padding: 16 }}>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <button className="btn btn-ac btn-mini" disabled={repPhotos.length === 0} onClick={() => { put({ summaries: buildRepSummary(repPhotos) }); flash("写真の症状から下書きを作成しました"); }}>写真から自動で下書き</button>
              <button className="btn btn-soft btn-mini" disabled={repAiBusy || repPhotos.length === 0} onClick={genRepAI}>{repAiBusy ? "作成中…" : "AIで文章作成"}</button>
            </div>
            {(r.summaries || []).map((s2) => (
              <div key={s2.id} style={{ marginBottom: 12 }}>
                <input value={s2.title} onChange={(e) => put({ summaries: r.summaries.map((x) => (x.id === s2.id ? { ...x, title: e.target.value } : x)) })} style={{ fontWeight: 700, marginBottom: 6 }} />
                <textarea rows={3} value={s2.text} onChange={(e) => put({ summaries: r.summaries.map((x) => (x.id === s2.id ? { ...x, text: e.target.value } : x)) })} style={{ fontSize: 13 }} />
                <button className="btn btn-bar btn-mini" style={{ color: "#FF3B30" }} onClick={() => put({ summaries: r.summaries.filter((x) => x.id !== s2.id) })}>この項目を削除</button>
              </div>
            ))}
            <button className="btn btn-soft btn-mini" onClick={() => put({ summaries: [...(r.summaries || []), { id: uid(), title: "外壁", text: "" }] })}>＋ 項目を追加</button>
            <p className="sub" style={{ fontSize: 11.5, margin: "10px 0 0" }}>「自動で下書き」は写真につけた箇所・症状から所見をまとめます。文章は自由に手直しできます。</p>
          </div>
        </div>
        {markEdit && (() => {
          const p = repPhotos.find((x) => x.id === markEdit);
          if (!p) return null;
          const ms = p.marks || [];
          return (
            <div className="markmodal no-print" style={{ position: "fixed", inset: 0, background: "rgba(8,8,10,.94)", zIndex: 60, display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", color: "#fff" }}>
                <span style={{ fontSize: 14, fontWeight: 700 }}>タップで赤丸を追加<span style={{ opacity: .6, fontWeight: 500, fontSize: 12 }}>（{ms.length}個）</span></span>
                <button className="btn btn-ac btn-mini" onClick={() => setMarkEdit(null)}>完了</button>
              </div>
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 10px", minHeight: 0 }}>
                <div style={{ position: "relative", cursor: "crosshair" }}
                  onClick={(e) => { const rc = e.currentTarget.getBoundingClientRect(); const x = Math.round(((e.clientX - rc.left) / rc.width) * 100); const y = Math.round(((e.clientY - rc.top) / rc.height) * 100); updRepPhoto(p.id, { marks: [...ms, { x, y, s: markSize }] }); }}>
                  <img src={p.data} alt="" style={{ maxWidth: "calc(100vw - 20px)", maxHeight: "calc(100vh - 210px)", display: "block", borderRadius: 8 }} />
                  {ms.map((m, mi) => <span key={mi} className="mark" style={{ left: m.x + "%", top: m.y + "%", width: (m.s || 16) + "%" }} />)}
                </div>
              </div>
              <div style={{ padding: "12px 18px calc(16px + env(safe-area-inset-bottom))", color: "#fff" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 700, flexShrink: 0 }}>○の大きさ</span>
                  <input type="range" min={6} max={36} value={markSize} style={{ flex: 1, accentColor: "#1B7F3B" }}
                    onChange={(e) => { const v = +e.target.value; setMarkSize(v); if (ms.length) updRepPhoto(p.id, { marks: ms.map((m, mi) => (mi === ms.length - 1 ? { ...m, s: v } : m)) }); }} />
                  <span className="num" style={{ fontSize: 12, width: 34, textAlign: "right" }}>{markSize}%</span>
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button className="btn btn-soft btn-mini" style={{ flex: 1 }} disabled={!ms.length} onClick={() => updRepPhoto(p.id, { marks: ms.slice(0, -1) })}>○を1つ取消</button>
                  <button className="btn btn-soft btn-mini" style={{ flex: 1, color: "#FF3B30" }} disabled={!ms.length} onClick={() => updRepPhoto(p.id, { marks: [] })}>すべて消す</button>
                </div>
                <p style={{ fontSize: 11, opacity: .55, margin: "10px 0 0", textAlign: "center" }}>スライダーは「最後に付けた○」と、これから付ける○の大きさを変えます</p>
              </div>
            </div>
          );
        })()}
        <div className="sticky-foot no-print">
          <div className="sticky-foot-in">
            <label className="btn btn-soft" style={{ cursor: "pointer" }}>
              <span className="btn-label-t">＋ 写真を追加</span>
              <input type="file" accept="image/*" multiple onChange={(e) => { const fs = [...(e.target.files || [])]; e.target.value = ""; if (fs.length) addRepPhotoFiles(fs); }} />
            </label>
            <button className="btn btn-ac btn-wide" onClick={() => setView("repDoc")}>報告書を見る →</button>
          </div>
        </div>
      </div>
    );
  }

  /* ---------- 調査報告書：書類 ---------- */
  if (view === "repDoc" && curRep) {
    const r = curRep;
    const orient = r.orient || "横";
    const pw2 = orient === "縦" ? 780 : 1040;
    const pgc = orient === "縦" ? "pgP" : "pgL";
    const pgMinH = orient === "縦" ? Math.round(pw2 * 1.4142) : Math.round(pw2 / 1.4142);
    const coName2 = (set.company || "").split("\n")[0] || "";
    const pageCss = `@media print {
      ${printPageBase}
      @page { size: A4 ${orient === "縦" ? "portrait" : "landscape"}; }
      html, body, #root, .root { overflow: visible !important; max-width: none !important; }
      .print-area { padding: 0 !important; margin: 0 !important; }
      .rep-page { page-break-after: always; break-after: page; margin: 0 auto !important; min-height: 0 !important; max-width: 100% !important; width: 100% !important; }
      .rep-page:last-child { page-break-after: auto; break-after: auto; }
      .rp-cover { max-height: ${orient === "縦" ? "150mm" : "128mm"} !important; }
      .rp-hero { ${orient === "縦" ? "max-height: 145mm !important; width: auto !important;" : "width: 60% !important; height: 92mm !important; object-fit: cover !important;"} max-width: 100% !important; margin: 0 auto; }
      .rp-photo { max-height: ${orient === "縦" ? "72mm" : "60mm"} !important; max-width: 100% !important; }
      .tb3 .rp-photo { max-height: ${orient === "縦" ? "56mm" : "42mm"} !important; }
      .sheet-print.rep-page { box-shadow: none !important; padding: ${PRINT_SHEET_PADDING} !important; }
      ${orient === "縦" ? "" : ".cvgrid { flex-wrap: nowrap !important; } .sumgrid { flex-wrap: nowrap !important; gap: 10px !important; margin-top: 8px !important; }"}
      .sumcols { column-count: ${orient === "縦" ? 1 : 2} !important; }
      .rep-page table { font-size: 10.5px !important; width: 100% !important; min-width: 0 !important; }
      .rep-page h2 { font-size: 17px !important; padding: 6px 0 !important; margin-bottom: 2px !important; }
      .rep-page p { line-height: 1.7 !important; }
      .rep-page td, .rep-page th { padding: 3px 6px !important; }
      .pfoot { margin-top: auto !important; padding-top: 6px !important; }
      .pvzoom { transform: none !important; width: 100% !important; max-width: 100% !important; }
      .pvouter { width: auto !important; height: auto !important; overflow: visible !important; margin: 0 !important; }
      .cvpage { min-height: 0 !important; }
      * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    }
    .rep-page { display: flex; flex-direction: column; }
    .pvzoom .rp-hero { ${orient === "縦" ? "max-height: 595px; width: auto;" : "width: 60%; height: 345px; object-fit: cover;"} max-width: 94%; margin: 0 auto; display: block; }
    .pvzoom .rp-photo { max-height: ${orient === "縦" ? "295px" : "225px"}; }
    .pvzoom .tb3 .rp-photo { max-height: ${orient === "縦" ? "230px" : "158px"}; }
    .pvzoom .rp-cover { max-height: ${orient === "縦" ? "560px" : "380px"}; }`;
    // 箇所グループごとに (1-1) 形式の番号を振る
    const locOrder = [];
    repPhotos.forEach((p) => { if (!locOrder.includes(p.loc)) locOrder.push(p.loc); });
    const numOf2 = (p, i) => {
      const g = locOrder.indexOf(p.loc) + 1;
      const j = repPhotos.filter((x, k) => x.loc === p.loc && k <= i).length;
      return "(" + g + "-" + j + ")";
    };
    const heroSum = (r.summaries || []).length ? r.summaries : buildRepSummary(repPhotos);
    const gradeRows = (() => {
      const locs2 = [];
      repPhotos.forEach((p) => { if (p.loc && !locs2.includes(p.loc)) locs2.push(p.loc); });
      return locs2.map((L) => {
        const inLoc = repPhotos.filter((p) => p.loc === L);
        const g = worstGrade(inLoc);
        const syms = []; inLoc.forEach((p) => { if (p.sym && !syms.includes(p.sym)) syms.push(p.sym); });
        return { L, g, syms };
      }).filter((x) => x.g);
    })();
    const sumPages = [];
    { let cur2 = [], budget = 0;
      heroSum.forEach((s2) => {
        const cost = 90 + (s2.text || "").length;
        if (cur2.length && budget + cost > ((orient === "縦" ? 1400 : 2000) - (sumPages.length === 0 && gradeRows.length ? 260 + gradeRows.length * 80 : 0))) { sumPages.push(cur2); cur2 = []; budget = 0; }
        cur2.push(s2); budget += cost;
      });
      if (cur2.length) sumPages.push(cur2); }
    const perPage = r.layout === "台帳" ? 3 : (orient === "縦" ? 3 : 2);
    const pages = [];
    for (let i = 0; i < repPhotos.length; i += perPage) pages.push(repPhotos.slice(i, i + perPage).map((p) => ({ p, i: repPhotos.indexOf(p) })));
    const totalPages = 1 + sumPages.length + (r.plan ? 1 : 0) + pages.length;
    const PFoot = ({ n }) => (
      <div className="pfoot" style={{ marginTop: "auto", paddingTop: 14, position: "relative", minHeight: 22 }}>
        <div className="num" style={{ textAlign: "center", fontSize: 10, color: "#8A929B", lineHeight: "22px" }}>－ {n} / {totalPages} －</div>
        <div style={{ position: "absolute", right: 0, top: 14, height: 22, display: "flex", alignItems: "center", gap: 7 }}>
          {set.logo && <img src={set.logo} alt="" style={{ height: 17, maxWidth: 78, objectFit: "contain" }} />}
          {coName2 && <span style={{ fontSize: 11, fontWeight: 700 }}>{coName2}</span>}
        </div>
      </div>
    );
    const PHead = () => (
      <div className="num" style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, color: "#48484A", borderBottom: "1px solid #D8D8DC", paddingBottom: 3, marginBottom: 8 }}>
        <span style={{ fontWeight: 700 }}>{r.name || "建物調査報告書"}</span>
        <span>No. {r.no}　調査日 {r.date}{r.insurance.on ? "　【火災保険申請 添付資料】" : ""}</span>
      </div>
    );
    return (
      <div className="root"><style>{css}</style><style>{pageCss}</style><Toast />
        <header className="appbar no-print"><div className="appbar-in">
          <button className="btn btn-bar btn-mini" onClick={() => setView("home")}>← ホーム</button>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-bar btn-mini" onClick={() => setView("repEdit")}>編集に戻る</button>
            <button className="btn btn-bar btn-mini" onClick={async () => {
              const secs = ((curRep.summaries && curRep.summaries.length ? curRep.summaries : buildRepSummary(repPhotos)) || []).map((s2) => "■" + s2.title + "\n" + s2.text).join("\n\n");
              const t = "【建物調査報告書】\n物件：" + (curRep.name || "") + "\n調査日：" + curRep.date + (curRep.site ? "\n場所：" + curRep.site : "") + "\n\n" + secs + "\n\n" + ((set.company || "").split("\n")[0] || "");
              try { await navigator.clipboard.writeText(t); flash("コピーしました。LINEに貼り付けてください"); }
              catch { try { const ta = document.createElement("textarea"); ta.value = t; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); document.body.removeChild(ta); flash("コピーしました"); } catch (er) { flash("コピーできませんでした"); } }
            }}>LINE用コピー</button>
            <button className="btn btn-ac btn-mini" onClick={() => { const t0 = document.title; document.title = (r.name || "物件") + "_調査報告書_" + r.date; try { window.print(); } catch { flash("印刷が開けない場合はスクリーンショットをご利用ください"); } setTimeout(() => { document.title = t0; }, 1500); }}>印刷 / PDF保存</button>
          </div>
        </div></header>
        <div className="print-area" style={{ padding: "16px 8px 60px" }}>
          <div className="no-print" style={{ maxWidth: pw2, margin: "0 auto 12px", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ flex: "0 1 190px" }}>
              <Seg options={["A4 横", "A4 縦"]} value={orient === "縦" ? "A4 縦" : "A4 横"}
                onChange={async (v) => { const o = v.includes("縦") ? "縦" : "横"; await saveCurRep({ ...r, orient: o }); flash("A4 " + o + "向きに切り替えました"); }} />
            </div>
            <div style={{ flex: "1 1 260px" }}>
              <Seg options={["所見つき（2枚/頁）", "台帳式（3枚/頁）"]} value={r.layout === "台帳" ? "台帳式（3枚/頁）" : "所見つき（2枚/頁）"}
                onChange={async (v) => { const L = v.includes("台帳") ? "台帳" : "所見"; await saveCurRep({ ...r, layout: L }); flash(L === "台帳" ? "台帳式（3枚/頁・保険提出フォーマット）に切り替えました" : "所見つき（2枚/頁）に切り替えました"); }} />
            </div>
            {r.insurance.on && <span style={{ background: "#FF9F0A", color: "#fff", borderRadius: 20, padding: "6px 14px", fontSize: 12.5, fontWeight: 800, flexShrink: 0 }}>✓ 保険提出用モード</span>}
            <p className="sub" style={{ fontSize: 11, margin: 0, flex: "1 1 100%", lineHeight: 1.5 }}>{PRINT_HINT}</p>
          </div>

          <div className="pvouter" style={{ width: Math.round(pw2 * pvScale), height: pvH ? Math.round(pvH * pvScale) : undefined, margin: "0 auto", position: "relative", overflow: "visible" }}>
          <div ref={pvRef} className="pvzoom" style={{ width: pw2, transform: "scale(" + pvScale + ")", transformOrigin: "top left" }}>
          {/* 表紙：ロゴ＋会社名 */}
          <div className={"card sheet-print rep-page cvpage " + pgc} style={{ maxWidth: pw2, minHeight: pgMinH, margin: "0 auto 14px", padding: "40px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
            {set.logo
              ? <img src={set.logo} alt="ロゴ" style={{ height: 150, maxWidth: "58%", objectFit: "contain" }} />
              : <div className="docTitle" style={{ fontSize: 34, fontWeight: 600, letterSpacing: ".3em" }}>建物調査報告書</div>}
            {coName2 && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 20, marginTop: 40, width: "100%" }}>
                <span style={{ flex: "0 0 64px", height: 1, background: "#1D1D1F" }} />
                <span className="docTitle" style={{ fontSize: 23, fontWeight: 600, letterSpacing: ".26em", paddingLeft: ".26em", whiteSpace: "nowrap" }}>{coName2}</span>
                <span style={{ flex: "0 0 64px", height: 1, background: "#1D1D1F" }} />
              </div>
            )}
          </div>

          <div className={"card sheet-print rep-page " + pgc} style={{ maxWidth: pw2, minHeight: pgMinH, margin: "0 auto 14px", padding: "28px 30px" }}>
            <h2 className="docTitle" style={{ textAlign: "center", letterSpacing: ".32em", fontSize: 21, fontWeight: 600, margin: "0 0 4px", background: "#F5F5F7", borderTop: "1.5px solid #1D1D1F", borderBottom: "1.5px solid #1D1D1F", padding: "10px 0" }}>点　検　調　査　表</h2>
            <div className="num" style={{ textAlign: "right", fontSize: 12, margin: "6px 0 14px" }}>{r.date}　No. {r.no}</div>
            <div style={{ textAlign: "center" }}>
              {(r.cover || repPhotos[0]) && <img className="rp-hero" src={r.cover || repPhotos[0].data} alt="全景" style={{ borderRadius: 4 }} />}
            </div>

            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, marginTop: 10 }}>
              <tbody>
                {[["現場場所", r.site], ["名称", r.name], ["既存下地", r.base + (r.age ? "（" + r.age + "）" : "")], ["工事仕様", r.spec],
                  ["調査方法", (r.methods || []).join("・") || "目視"],
                  ...(r.inspector ? [["調査員", r.inspector]] : []),
                  ...(r.insurance.on ? [["被災日（推定）", r.insurance.eventDate || "調査時点で特定中"], ["想定される原因", r.insurance.cause]] : [])].map(([k, v]) => (
                  <tr key={k} style={{ borderBottom: "1px solid #E5E5EA" }}>
                    <td style={{ padding: "8px 8px", width: 120, background: "#F2F2F5", fontWeight: 700 }}>{k}</td>
                    <td style={{ padding: "8px 8px" }}>{v || "－"}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <PFoot n={1} />
          </div>

          {/* 診断結果（項目が増えると自動でページが増えます） */}
          {sumPages.map((sp, si) => (
            <div key={si} className={"card sheet-print rep-page " + pgc} style={{ maxWidth: pw2, minHeight: pgMinH, margin: "0 auto 14px", padding: "24px 28px" }}>
              <PHead />
              <h2 className="docTitle" style={{ textAlign: "center", letterSpacing: ".32em", fontSize: 20, fontWeight: 600, margin: "0 0 14px", background: "#F5F5F7", borderTop: "1.5px solid #1D1D1F", borderBottom: "1.5px solid #1D1D1F", padding: "9px 0" }}>診　断　結　果{sumPages.length > 1 ? <span className="num" style={{ fontSize: 12, letterSpacing: 0 }}>　（{si + 1}/{sumPages.length}）</span> : null}</h2>
              {si === 0 && gradeRows.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 4 }}>■ 部位別 劣化度判定</div>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead><tr style={{ background: "#F2F2F5" }}>
                      <th style={{ padding: "6px 8px", border: "1px solid #D8D8DC", width: 90, textAlign: "left" }}>部位</th>
                      <th style={{ padding: "6px 8px", border: "1px solid #D8D8DC", width: 96, whiteSpace: "nowrap" }}>判定</th>
                      <th style={{ padding: "6px 8px", border: "1px solid #D8D8DC", textAlign: "left" }}>主な症状</th>
                      <th style={{ padding: "6px 8px", border: "1px solid #D8D8DC", textAlign: "left" }}>今後の対応</th>
                    </tr></thead>
                    <tbody>{gradeRows.map(({ L, g, syms }) => (
                      <tr key={L}>
                        <td style={{ padding: "6px 8px", border: "1px solid #D8D8DC", fontWeight: 700 }}>{L}</td>
                        <td style={{ padding: "6px 8px", border: "1px solid #D8D8DC", textAlign: "center", fontWeight: 800, color: g[3], whiteSpace: "nowrap" }}>{g[0]}（{g[1]}）</td>
                        <td style={{ padding: "6px 8px", border: "1px solid #D8D8DC" }}>{syms.join("、") || "－"}</td>
                        <td style={{ padding: "6px 8px", border: "1px solid #D8D8DC" }}>{g[2]}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                  <p className="sub" style={{ fontSize: 10, margin: "4px 0 0" }}>判定基準：A=健全　B=軽度（経過観察）　C=中度（中期的な補修を推奨）　D=重度（早急な対応が必要）</p>
                </div>
              )}
              <div className="sumcols">
                {sp.map((s2) => (
                  <div key={s2.id} style={{ breakInside: "avoid", marginBottom: 14 }}>
                    <div style={{ fontWeight: 700, fontSize: 13.5, textDecoration: "underline", textUnderlineOffset: 3 }}>{s2.title}</div>
                    <p style={{ fontSize: 12, lineHeight: 1.9, margin: "5px 0 0", whiteSpace: "pre-wrap" }}>{s2.text}</p>
                  </div>
                ))}
              </div>
              <PFoot n={2 + si} />
            </div>
          ))}

          {/* 図面ページ（撮影位置マーカー） */}
          {r.plan && (
            <div className={"card sheet-print rep-page " + pgc} style={{ maxWidth: pw2, minHeight: pgMinH, margin: "0 auto 14px", padding: "22px 26px" }}>
              <PHead />
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, marginBottom: 10 }}>
                <tbody><tr>
                  <td style={{ border: "1px solid #1D1D1F", background: "#F2F2F5", fontWeight: 800, padding: "5px 10px", width: 90 }}>物件名</td>
                  <td style={{ border: "1px solid #1D1D1F", padding: "5px 10px" }}>{r.name || "－"}</td>
                  <td style={{ border: "1px solid #1D1D1F", background: "#F2F2F5", fontWeight: 800, padding: "5px 10px", width: 90 }}>図面</td>
                  <td style={{ border: "1px solid #1D1D1F", padding: "5px 10px" }}>撮影位置図</td>
                </tr></tbody>
              </table>
              <div style={{ position: "relative", textAlign: "center" }}>
                <img className="rp-cover" src={r.plan} alt="図面" style={{ maxWidth: "100%", maxHeight: 560, display: "inline-block" }} />
                {(r.planMarks || []).map((m) => (
                  <span key={m.n} className="num" style={{ position: "absolute", left: m.x + "%", top: m.y + "%", transform: "translate(-50%, -100%)", background: "#FF3B30", color: "#fff", borderRadius: 6, padding: "2px 8px", fontSize: 12, fontWeight: 800 }}>{m.n}</span>
                ))}
              </div>
              <p className="sub" style={{ fontSize: 10.5, margin: "8px 0 0" }}>番号は写真台帳の撮影箇所グループ（{locOrder.map((L, i) => "(" + (i + 1) + ")" + L).join("　")}）に対応しています。</p>
              <PFoot n={2 + sumPages.length} />
            </div>
          )}

          {/* 写真ページ（2枚/ページ） */}
          {pages.map((pg, pi) => (
            <div key={pi} className={"card sheet-print rep-page " + pgc + (r.layout === "台帳" ? " tb3" : "")} style={{ maxWidth: pw2, minHeight: pgMinH, margin: "0 auto 14px", padding: "22px 26px" }}>
              <PHead />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, borderBottom: "2px solid #1D1D1F", paddingBottom: 4, marginBottom: 0, fontWeight: 700 }}>
                <span>No.　写真</span><span>{r.layout === "台帳" ? "撮影箇所" : "撮影箇所・所見"}</span>
              </div>
              {pg.map(({ p, i }) => (
                <div key={p.id} style={{ display: "flex", gap: 14, borderBottom: "1px solid #1D1D1F", padding: "14px 0", alignItems: "flex-start" }}>
                  <div style={{ flex: r.layout === "台帳" ? "0 0 32%" : "0 0 44%", minWidth: 0, transition: "flex-basis .2s" }}>
                    <div className="num" style={{ fontSize: 11, marginBottom: 4 }}>{numOf2(p, i)}</div>
                    <div style={{ position: "relative" }}>
                      <img className="rp-photo" src={p.data} alt="" style={{ width: "100%", borderRadius: 2, display: "block", objectFit: "cover" }} />
                      {(p.marks || []).map((m, mi) => <span key={mi} className="mark" style={{ left: m.x + "%", top: m.y + "%", width: (m.s || 16) + "%" }} />)}
                    </div>
                    {r.insurance.on && <div className="num" style={{ fontSize: 10, color: "#48484A", marginTop: 3 }}>撮影日：{r.date}</div>}
                  </div>
                  <div style={{ flex: 1, minWidth: 0, fontSize: 12, lineHeight: 1.85 }}>
                    {(r.layout !== "台帳" || repPhotos.findIndex((x) => x.loc === p.loc) === i) && (
                      <div style={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span>{r.layout === "台帳" ? p.loc : "箇所：" + p.loc}{p.sym && p.sym !== "異常なし" ? "　（" + p.sym + "）" : ""}</span>
                        {p.grade && (() => { const g = REP_GRADES.find((x) => x[0] === p.grade); return g ? <span style={{ border: "1.5px solid " + g[3], color: g[3], borderRadius: 6, padding: "1px 8px", fontSize: 11, fontWeight: 800 }}>判定 {g[0]}（{g[1]}）</span> : null; })()}
                      </div>
                    )}
                    {r.layout !== "台帳" && p.text && <p style={{ margin: "6px 0 0", whiteSpace: "pre-wrap" }}>{p.text}</p>}
                  </div>
                </div>
              ))}
              <PFoot n={1 + sumPages.length + (r.plan ? 1 : 0) + 1 + pi} />
            </div>
          ))}
          {repPhotos.length === 0 && (
            <div className="card no-print" style={{ maxWidth: 760, margin: "0 auto", padding: 28, textAlign: "center" }}>
              <p className="sub" style={{ margin: 0, fontSize: 14 }}>まだ写真がありません。「編集に戻る」から現場写真を追加してください。</p>
            </div>
          )}
          </div>
          </div>
        </div>
      </div>
    );
  }

  /* ---------- 使い方サポート（チャットbot） ---------- */
  if (view === "help") {
    const cats = [...new Set(HELP_FAQ.map((f) => f.c))];
    const ask = (text) => {
      const t = text.trim();
      if (!t) return;
      const scored = HELP_FAQ.map((f) => {
        let s = 0;
        f.kw.forEach((k) => { if (t.includes(k)) s += 3; });
        if (t.includes(f.q.slice(0, 4))) s += 2;
        [...t].forEach(() => {});
        if (f.q.includes(t) || t.includes(f.q)) s += 4;
        return { f, s };
      }).filter((x) => x.s > 0).sort((a, b) => b.s - a.s).slice(0, 3);
      const entry = { me: t, hits: scored.map((x) => x.f) };
      setHelpLog((l) => [...l, entry]);
      setHelpQ("");
    };
    const composeInquiry = async () => {
      const lastQ = [...helpLog].reverse().find((x) => x.me);
      const t = "【" + appLabel + " お問い合わせ】\n質問：" + (lastQ ? lastQ.me : helpQ || "（ここに質問を書いてください）") + "\n発生した画面：\n端末：" + navigator.userAgent.slice(0, 80) + "\n日時：" + new Date().toLocaleString("ja-JP");
      try { await navigator.clipboard.writeText(t); flash("問い合わせ文をコピーしました。LINE等に貼り付けて送ってください"); }
      catch { try { const ta = document.createElement("textarea"); ta.value = t; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); document.body.removeChild(ta); flash("コピーしました"); } catch (er) { flash("コピーできませんでした"); } }
    };
    return (
      <div className="root"><style>{css}</style><Toast />
        <header className="appbar no-print"><div className="appbar-in">
          <button className="btn btn-bar btn-mini" onClick={() => setView("home")}>← ホーム</button>
          <span style={{ fontSize: 15, fontWeight: 700 }}>使い方サポート</span>
          <span style={{ width: 60 }} />
        </div></header>
        <div className="colw page-with-foot" style={{ maxWidth: 620, margin: "0 auto", padding: "18px 16px" }}>

          <div className="card" style={{ padding: 16, marginBottom: 12 }}>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.8 }}>こんにちは！<b>{appLabel}のサポート</b>です。知りたいことのカテゴリを選ぶか、下の欄に質問を入力してください。</p>
          </div>

          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
            {cats.map((c) => (
              <button key={c} onClick={() => setHelpCat(helpCat === c ? "" : c)}
                style={{ border: "none", borderRadius: 20, padding: "8px 14px", fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", background: helpCat === c ? "#1D1D1F" : "#fff", color: helpCat === c ? "#fff" : "#1D1D1F", boxShadow: "0 1px 2px rgba(0,0,0,.05)" }}>{c}</button>
            ))}
          </div>

          {helpCat && (
            <div className="card" style={{ padding: "8px 16px", marginBottom: 14 }}>
              {HELP_FAQ.filter((f) => f.c === helpCat).map((f, i, arr) => (
                <button key={f.q} onClick={() => setHelpLog((l) => [...l, { me: f.q, hits: [f] }])}
                  style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: "none", borderBottom: i < arr.length - 1 ? ".5px solid rgba(0,0,0,.08)" : "none", padding: "12px 2px", fontSize: 14, fontFamily: "inherit", cursor: "pointer", color: "#1D1D1F" }}>
                  {f.q} <span style={{ float: "right", opacity: .35 }}>›</span>
                </button>
              ))}
            </div>
          )}

          {helpLog.map((m, i) => (
            <div key={i}>
              <div style={{ display: "flex", justifyContent: "flex-end", margin: "10px 0" }}>
                <div style={{ background: "#1B7F3B", color: "#fff", borderRadius: "18px 18px 4px 18px", padding: "10px 14px", fontSize: 14, maxWidth: "80%" }}>{m.me}</div>
              </div>
              {m.hits.length > 0 ? m.hits.map((f) => (
                <div key={f.q} style={{ display: "flex", justifyContent: "flex-start", margin: "8px 0" }}>
                  <div className="card" style={{ borderRadius: "18px 18px 18px 4px", padding: "12px 14px", fontSize: 13.5, lineHeight: 1.85, maxWidth: "88%" }}>
                    <div style={{ fontWeight: 700, marginBottom: 4 }}>{f.q}</div>
                    {f.a}
                  </div>
                </div>
              )) : (
                <div style={{ display: "flex", justifyContent: "flex-start", margin: "8px 0" }}>
                  <div className="card" style={{ borderRadius: "18px 18px 18px 4px", padding: "12px 14px", fontSize: 13.5, lineHeight: 1.85, maxWidth: "88%" }}>
                    ぴったりの回答が見つかりませんでした。別の言葉で聞いていただくか、下の「解決しないときは」から開発者にお問い合わせください。すぐに回答してFAQにも追加します！
                  </div>
                </div>
              )}
            </div>
          ))}

          <div className="card" style={{ padding: 16, marginTop: 18 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 8 }}>解決しないときは</div>
            <p className="sub" style={{ fontSize: 12.5, margin: "0 0 10px" }}>ボタンを押すと質問・端末情報が整形されてコピーされます。LINE等に貼り付けて送るだけでOKです。</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button className="btn btn-soft btn-mini" onClick={composeInquiry}>問い合わせ文をコピー</button>
              {set.supportUrl && <a className="btn btn-ac btn-mini" style={{ textDecoration: "none", display: "inline-flex", alignItems: "center" }} href={set.supportUrl} target="_blank" rel="noreferrer">サポート窓口を開く</a>}
            </div>
          </div>
        </div>

        <div className="sticky-foot no-print">
          <div className="sticky-foot-in">
            <input className="btn-input" value={helpQ} onChange={(e) => setHelpQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") ask(helpQ); }} placeholder="質問を入力（例：赤丸のつけ方）" />
            <button className="btn btn-ac" style={{ flexShrink: 0 }} disabled={!helpQ.trim()} onClick={() => ask(helpQ)}>送信</button>
          </div>
        </div>
      </div>
    );
  }

  /* ---------- 顧客台帳 ---------- */
  if (view === "clients") {
    const map = {};
    ests.forEach((e) => {
      const nm = (e.customer || "").trim();
      if (!nm) return;
      if (!map[nm]) map[nm] = { name: nm, addr: "", est: 0, rep: 0, done: 0, last: "", cases: [] };
      map[nm].est += 1;
      if (e.done) map[nm].done += 1;
      if (e.customerAddr) map[nm].addr = e.customerAddr;
      if ((e.date || "") > map[nm].last) map[nm].last = e.date || "";
      map[nm].cases.push({ kind: "est", id: e.id, label: e.title + "（" + (e.status || "") + (e.done ? "・完了" : "") + "）", date: e.date });
    });
    reps.forEach((r) => {
      const nm = (r.customer || "").trim();
      if (!nm) return;
      if (!map[nm]) map[nm] = { name: nm, addr: "", est: 0, rep: 0, done: 0, last: "", cases: [] };
      map[nm].rep += 1;
      if ((r.date || "") > map[nm].last) map[nm].last = r.date || "";
      map[nm].cases.push({ kind: "rep", id: r.id, label: "調査報告書（" + (r.name || "物件") + "）", date: r.date });
    });
    const clients = Object.values(map)
      .filter((c) => !cliQ || c.name.includes(cliQ) || (c.addr || "").includes(cliQ))
      .sort((a, b) => (b.last > a.last ? 1 : -1));
    return (
      <div className="root"><style>{css}</style><Toast />
        <header className="appbar no-print"><div className="appbar-in">
          <button className="btn btn-bar btn-mini" onClick={() => setView("home")}>← ホーム</button>
        </div></header>
        <div className="wrapx">
          <h1 style={{ fontSize: 30, fontWeight: 800, margin: "12px 6px 2px" }}>顧客台帳</h1>
          <p className="sub" style={{ margin: "0 6px 14px", fontSize: 14 }}>見積・報告書から自動で集計しています（{clients.length}名）</p>
          <input value={cliQ} onChange={(e) => setCliQ(e.target.value)} placeholder="お客様名・住所で検索" style={{ marginBottom: 14 }} />
          {clients.length === 0 ? (
            <div className="card" style={{ padding: 28, textAlign: "center" }}>
              <p className="sub" style={{ margin: 0, fontSize: 14 }}>お客様名の入った見積・報告書を作ると、ここに自動で並びます</p>
            </div>
          ) : (
            <div className="list-col">
              {clients.map((c) => (
                <div key={c.name} className="card" style={{ padding: 16 }}>
                  <div style={{ fontSize: 17, fontWeight: 800 }}>{c.name} 様</div>
                  {c.addr && <div className="sub" style={{ fontSize: 13, marginTop: 2 }}>{c.addr}</div>}
                  <div className="sub num" style={{ fontSize: 12.5, marginTop: 4 }}>見積 {c.est}件・報告書 {c.rep}件{c.done > 0 ? "・完了 " + c.done + "件" : ""}　最終 {c.last || "－"}</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
                    {c.cases.sort((a, b) => ((b.date || "") > (a.date || "") ? 1 : -1)).slice(0, 4).map((cs) => (
                      <button key={cs.kind + cs.id} className="btn btn-soft btn-mini" style={{ justifyContent: "flex-start", textAlign: "left", fontWeight: 500 }}
                        onClick={() => {
                          if (cs.kind === "est") { const e = ests.find((x) => x.id === cs.id); if (e) { setCur(e); setView("edit"); } }
                          else { const rr = reps.find((x) => x.id === cs.id); if (rr) { setCurRep(rr); setView("repEdit"); } }
                        }}>
                        <span className="num" style={{ marginRight: 8, color: "#8A929B" }}>{cs.date}</span>{cs.label}
                      </button>
                    ))}
                  </div>
                  <div className="actions no-print">
                    <button className="act ac" onClick={() => { setCur({ ...newEstimate(), customer: c.name, customerAddr: c.addr }); setStep(0); setView("wizard"); }}>この方の新規見積</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ---------- 工事経歴 ---------- */
  if (view === "history") {
    const doneList = ests
      .filter((e) => e.done)
      .filter((e) => (!histQ.from || e.done >= histQ.from) && (!histQ.to || e.done <= histQ.to))
      .filter((e) => !histQ.q || ((e.customer || "") + (e.title || "") + (e.site || "")).includes(histQ.q))
      .sort((a, b) => (b.done > a.done ? 1 : -1));
    return (
      <div className="root"><style>{css}</style><Toast />
        <header className="appbar no-print"><div className="appbar-in">
          <button className="btn btn-bar btn-mini" onClick={() => setView("home")}>← ホーム</button>
        </div></header>
        <div className="wrapx">
          <h1 style={{ fontSize: 30, fontWeight: 800, margin: "12px 6px 2px" }}>工事経歴</h1>
          <p className="sub" style={{ margin: "0 6px 14px", fontSize: 14 }}>完了した工事 {ests.filter((e) => e.done).length}件</p>

          <div className="card" style={{ padding: 16, marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>完了日で検索</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 8, alignItems: "center" }}>
              <input type="date" value={histQ.from} onChange={(e) => setHistQ({ ...histQ, from: e.target.value })} />
              <span className="sub">〜</span>
              <input type="date" value={histQ.to} onChange={(e) => setHistQ({ ...histQ, to: e.target.value })} />
            </div>
            <input style={{ marginTop: 8 }} value={histQ.q} onChange={(e) => setHistQ({ ...histQ, q: e.target.value })} placeholder="お客様名・件名・場所で絞り込み" />
            {(histQ.from || histQ.to || histQ.q) && (
              <button className="btn btn-bar btn-mini" style={{ marginTop: 6 }} onClick={() => setHistQ({ from: "", to: "", q: "" })}>条件をクリア</button>
            )}
          </div>

          {doneList.length === 0 ? (
            <div className="card" style={{ padding: 28, textAlign: "center" }}>
              <p className="sub" style={{ margin: 0, fontSize: 14 }}>該当する工事がありません</p>
            </div>
          ) : (
            <div className="list-col">
              {doneList.map((e) => {
                const c = calc(e, set);
                const actual = (e.actuals || []).reduce((s, a) => s + (+a.amount || 0), 0);
                return (
                  <div key={e.id} className="card" style={{ padding: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                      <div style={{ minWidth: 0 }}>
                        <span className="status" style={{ background: "#E6F6EC", color: "#248A3D" }}><i style={{ background: "#34C759" }} />完了 <span className="num">{e.done}</span></span>
                        <div style={{ fontSize: 16, fontWeight: 700, margin: "8px 0 2px" }}>{e.customer || "お客様名未入力"}</div>
                        <div className="sub" style={{ fontSize: 13 }}>{e.title}・{e.site || "場所未入力"}</div>
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div className="num" style={{ fontSize: 18 }}>{yen(c.total)}</div>
                        {actual > 0 && <div className="sub num" style={{ fontSize: 12 }}>実績原価 {yen(actual)}</div>}
                      </div>
                    </div>
                    <div className="actions no-print">
                      <button className="act" onClick={() => { setCur(e); setDocTab("見積書"); setView("docs"); }}>書類</button>
                      <button className="act" onClick={async () => { await persist(ests.map((x) => (x.id === e.id ? { ...x, done: "" } : x))); flash("進行中に戻しました"); }}>経歴から戻す</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ---------- 原価の予実管理 ---------- */
  if (view === "budget" && cur) {
    const c = calc(cur, set);
    const acts = cur.actuals || [];
    const actual = acts.reduce((s, a) => s + (+a.amount || 0), 0);
    const realProfit = c.beforeTax - actual;
    const realMargin = c.beforeTax > 0 ? (realProfit / c.beforeTax) * 100 : 0;
    const ratio = c.cost > 0 ? (actual / c.cost) * 100 : 0;
    const over = actual > c.cost && c.cost > 0;
    const addAct = async () => {
      if (!af.amount) return;
      await saveCur({ ...cur, actuals: [{ id: uid(), date: new Date().toISOString().slice(5, 10).replace("-", "/"), cat: af.cat, name: af.name, amount: +af.amount }, ...acts] });
      setAf({ name: "", amount: "", cat: af.cat });
      flash("原価を記録しました");
    };
    return (
      <div className="root"><style>{css}</style><Toast />
        <header className="appbar no-print"><div className="appbar-in">
          <button className="btn btn-bar btn-mini" onClick={() => setView("home")}>← ホーム</button>
        </div></header>
        <div className="colw" style={{ maxWidth: 620, margin: "0 auto", padding: "18px 16px 40px" }}>
          <div className="eyebrow">{cur.customer || ""}・{cur.title}</div>
          <h2 style={{ margin: "4px 0 14px", fontSize: 24, fontWeight: 800 }}>原価の予実</h2>

          <div className="card" style={{ padding: 18, marginBottom: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div><div style={{ fontSize: 12, color: SUB, fontWeight: 600 }}>予定原価（見積時）</div><div className="num" style={{ fontSize: 20 }}>{yen(c.cost)}</div></div>
              <div style={{ textAlign: "right" }}><div style={{ fontSize: 12, color: SUB, fontWeight: 600 }}>実績原価</div><div className="num" style={{ fontSize: 20, color: over ? "#FF3B30" : "#1D1D1F" }}>{yen(actual)}</div></div>
            </div>
            <div style={{ height: 10, background: "#E9E9EB", borderRadius: 5, overflow: "hidden" }}>
              <div style={{ width: `${Math.min(100, ratio)}%`, height: "100%", background: over ? "#FF3B30" : ratio > 85 ? "#FF9F0A" : "#34C759", transition: "width .3s" }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 12, color: SUB }}>
              <span>消化率 <span className="num">{ratio.toFixed(0)}%</span></span>
              <span>残り <span className="num" style={{ color: over ? "#FF3B30" : "#1D1D1F" }}>{yen(c.cost - actual)}</span></span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12, padding: "10px 12px", background: "#F5F5F7", borderRadius: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>粗利率：見積 <span className="num">{c.margin.toFixed(1)}%</span></span>
              <span style={{ fontSize: 13, fontWeight: 700, color: realMargin < c.margin - 3 ? "#FF3B30" : "#34C759" }}>現在 <span className="num">{realMargin.toFixed(1)}%</span></span>
            </div>
            {over && <div style={{ marginTop: 10, background: "#FDECEC", color: "#FF3B30", borderRadius: 10, padding: "10px 12px", fontSize: 13, fontWeight: 700 }}>予定原価を超過しています。次回見積の単価見直し材料にしてください</div>}
          </div>

          <div className="card" style={{ padding: 16, marginBottom: 12 }}>
            <div style={{ fontWeight: 700, marginBottom: 10 }}>かかった原価を記録</div>
            <Seg options={["材料費", "労務費", "外注費", "経費"]} value={af.cat} onChange={(v) => setAf({ ...af, cat: v })} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
              <input value={af.name} onChange={(e) => setAf({ ...af, name: e.target.value })} placeholder="内容（例：塗料仕入）" />
              <input className="num" type="number" inputMode="numeric" value={af.amount} onChange={(e) => setAf({ ...af, amount: e.target.value })} placeholder="金額" />
            </div>
            <button className="btn btn-ac" style={{ marginTop: 10 }} disabled={!af.amount} onClick={addAct}>＋ 記録する</button>
          </div>

          {acts.length > 0 && (
            <div className="card" style={{ padding: 8 }}>
              {acts.map((a) => (
                <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 8px", borderBottom: "1px solid #F0F0F2" }}>
                  <span style={{ fontSize: 11, color: SUB, minWidth: 38 }} className="num">{a.date}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, background: "#F5F5F7", borderRadius: 6, padding: "3px 8px", whiteSpace: "nowrap" }}>{a.cat}</span>
                  <span style={{ flex: 1, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.name || "（内容なし）"}</span>
                  <span className="num" style={{ fontSize: 14 }}>{yen(a.amount)}</span>
                  <button className="btn btn-soft btn-mini" style={{ color: "#FF3B30", padding: "4px 9px" }} onClick={async () => { await saveCur({ ...cur, actuals: acts.filter((x) => x.id !== a.id) }); }}>×</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ---------- 書類（見積書・仕様書・請求書・契約書） ---------- */
  if (view === "docs" && cur) {
    const c = calc(cur, set);
    const valid = new Date(new Date(cur.date).getTime() + cur.validDays * 86400000).toISOString().slice(0, 10);
    const today = new Date().toISOString().slice(0, 10);
    const otsu = (set.company || "").split("\n")[0] || "＿＿＿＿＿＿";
    const updItem = (id, patch) => saveCur({ ...cur, items: cur.items.map((x) => (x.id === id ? { ...x, ...patch } : x)) });
    const numOf = (t, fb) => { const n = parseFloat(String(t).replace(/[^0-9.]/g, "")); return isNaN(n) ? fb : n; };
    const ItemsTable = () => (
      <div className="tblscroll" style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 480 }}>
          <thead><tr style={{ background: INK, color: "#fff" }}>
            {["工事項目", "数量", "単位", "単価", "金額"].map((h, i) => (
              <th key={h} style={{ padding: "7px 8px", textAlign: i >= 1 ? "right" : "left", fontWeight: 500 }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {cur.items.map((it) => (
              <tr key={it.id} style={{ borderBottom: "1px solid #E5E5EA" }}>
                <td style={{ padding: "7px 8px" }}><Ed v={it.name} on={(t) => updItem(it.id, { name: t })} /></td>
                <td className="num" style={{ padding: "7px 8px", textAlign: "right" }}><Ed num v={it.qty} on={(t) => updItem(it.id, { qty: numOf(t, it.qty) })} /></td>
                <td style={{ padding: "7px 8px", textAlign: "right" }}><Ed v={it.unit} on={(t) => updItem(it.id, { unit: t })} /></td>
                <td className="num" style={{ padding: "7px 8px", textAlign: "right" }}><Ed num v={yen(it.price)} on={(t) => updItem(it.id, { price: numOf(t, it.price) })} /></td>
                <td className="num" style={{ padding: "7px 8px", textAlign: "right" }}>{yen(it.qty * it.price)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
    return (
      <div className="root"><style>{css}</style><Toast />
        <header className="appbar no-print"><div className="appbar-in">
          <button className="btn btn-bar btn-mini" onClick={() => setView("home")}>← ホーム</button>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-ac btn-mini" onClick={() => { const t0 = document.title; document.title = (cur.customer || "お客様") + "様_" + docTab + "_" + cur.date; try { window.print(); } catch { flash("印刷が開けない場合はスクリーンショットをご利用ください"); } setTimeout(() => { document.title = t0; }, 1500); }}>印刷 / PDF保存</button>
            <button className="btn btn-bar btn-mini" onClick={() => copyShare(cur)}>LINE用コピー</button>
          </div>
        </div></header>
        <div className="print-area" style={{ padding: "16px 8px 60px" }}>
        <div className="no-print" style={{ maxWidth: 760, margin: "0 auto 12px" }}>
          <Seg options={["見積書", "報告書", "仕様書", "請求書", "契約書"]} value={docTab} onChange={setDocTab} />
          <p className="sub" style={{ fontSize: 12, margin: "8px 4px 0" }}>点線の文字はタップしてそのまま書き換えられます。修正は保存され、他の書類にも反映されます。</p>
          <p className="sub" style={{ fontSize: 11, margin: "6px 4px 0", lineHeight: 1.5 }}>{PRINT_HINT}</p>
        </div>
        {docTab === "見積書" && (
        <div className="card sheet-print" style={{ maxWidth: 760, margin: "0 auto", padding: "34px 24px" }}>
          <h2 style={{ textAlign: "center", letterSpacing: ".45em", fontSize: 22, margin: "0 0 20px", borderBottom: `3px double ${INK}`, paddingBottom: 10 }}>御 見 積 書</h2>
          <div style={{ fontSize: 17, fontWeight: 700, borderBottom: `1px solid ${INK}`, paddingBottom: 4, marginBottom: 12, maxWidth: 430 }}><Ed v={cur.customer || "＿＿＿＿"} on={(t) => saveCur({ ...cur, customer: t })} /> 様</div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
            <table style={{ fontSize: 13, borderCollapse: "collapse", flex: 1, minWidth: 0 }}><tbody>
              <tr><td style={{ paddingRight: 10, color: SUB, whiteSpace: "nowrap", verticalAlign: "top" }}>件名</td><td><Ed v={cur.title} on={(t) => saveCur({ ...cur, title: t })} />（{cur.grade}仕様）</td></tr>
              <tr><td style={{ paddingRight: 10, color: SUB, whiteSpace: "nowrap", verticalAlign: "top" }}>工事場所</td><td><Ed v={cur.site || "　"} on={(t) => saveCur({ ...cur, site: t })} /></td></tr>
              <tr><td style={{ paddingRight: 10, color: SUB, whiteSpace: "nowrap" }}>見積日</td><td className="num">{cur.date}</td></tr>
              <tr><td style={{ paddingRight: 10, color: SUB, whiteSpace: "nowrap" }}>有効期限</td><td className="num">{valid}</td></tr>
            </tbody></table>
            <div style={{ textAlign: "right", fontSize: 12, maxWidth: "55%", flexShrink: 0 }}>
              <div className="num">No. {cur.no}</div>
              {set.company && <div style={{ marginTop: 6 }}><SealCo set={set} /></div>}
            </div>
          </div>
          <div style={{ margin: "18px 0", background: "#F5F5F7", border: `1px solid ${INK}`, padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap" }}>
            <span style={{ fontWeight: 700 }}>御見積金額（税込）</span>
            <span className="num" style={{ fontSize: 24 }}>{yen(c.total)}</span>
          </div>
          <div className="tblscroll" style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 480 }}>
              <thead><tr style={{ background: INK, color: "#fff" }}>
                {["工事項目", "数量", "単位", "単価", "金額"].map((h, i) => (
                  <th key={h} style={{ padding: "7px 8px", textAlign: i >= 1 ? "right" : "left", fontWeight: 500 }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {cur.items.map((it) => (
                  <tr key={it.id} style={{ borderBottom: "1px solid #E5E5EA" }}>
                    <td style={{ padding: "7px 8px" }}><Ed v={it.name} on={(t) => updItem(it.id, { name: t })} /></td>
                    <td className="num" style={{ padding: "7px 8px", textAlign: "right" }}><Ed num v={it.qty} on={(t) => updItem(it.id, { qty: numOf(t, it.qty) })} /></td>
                    <td style={{ padding: "7px 8px", textAlign: "right" }}><Ed v={it.unit} on={(t) => updItem(it.id, { unit: t })} /></td>
                    <td className="num" style={{ padding: "7px 8px", textAlign: "right" }}><Ed num v={yen(it.price)} on={(t) => updItem(it.id, { price: numOf(t, it.price) })} /></td>
                    <td className="num" style={{ padding: "7px 8px", textAlign: "right" }}>{yen(it.qty * it.price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
            <table style={{ fontSize: 13, borderCollapse: "collapse", minWidth: 250 }}><tbody>
              {[["直接工事費", c.direct], [`諸経費（${set.overheadRate}%）`, c.overhead],
                ...(+cur.discount ? [["出精値引き", -cur.discount]] : []),
                ["小計（税抜）", c.beforeTax], ["消費税（10%）", c.tax]].map(([l, v]) => (
                <tr key={l} style={{ borderBottom: "1px solid #E5E5EA" }}>
                  <td style={{ padding: "6px 10px", color: SUB }}>{l}</td>
                  <td className="num" style={{ padding: "6px 10px", textAlign: "right" }}>{yen(v)}</td>
                </tr>
              ))}
              <tr style={{ background: "#F5F5F7", fontWeight: 700 }}>
                <td style={{ padding: "8px 10px" }}>合計</td>
                <td className="num" style={{ padding: "8px 10px", textAlign: "right" }}>{yen(c.total)}</td>
              </tr>
            </tbody></table>
          </div>
          {cur.notes && (
            <div style={{ marginTop: 18, fontSize: 12, color: "#4A4A4F", whiteSpace: "pre-wrap", borderTop: "1px solid #E5E5EA", paddingTop: 10 }}><Ed multi v={cur.notes} on={(t) => saveCur({ ...cur, notes: t })} /></div>
          )}
        </div>
        )}

        {docTab === "報告書" && (
          <div className="card sheet-print" style={{ maxWidth: 760, margin: "0 auto", padding: "34px 24px" }}>
            <h2 style={{ textAlign: "center", letterSpacing: ".2em", fontSize: 20, margin: "0 0 6px", borderBottom: `3px double ${INK}`, paddingBottom: 10 }}>{(cur.workType || "戸建") === "戸建" ? "外壁劣化 現地診断報告書" : "現地調査報告書"}</h2>
            <p style={{ fontSize: 13, textAlign: "center", color: SUB, margin: "0 0 16px" }}><Ed v={cur.customer || "＿＿"} on={(t) => saveCur({ ...cur, customer: t })} /> 様邸　<Ed v={cur.site || "　"} on={(t) => saveCur({ ...cur, site: t })} />　調査日 {cur.date}</p>
            <div style={{ fontWeight: 700, fontSize: 14, margin: "0 0 6px" }}>■ 診断結果</div>
            {cur.symptoms.length === 0 ? (
              <p style={{ fontSize: 13 }}>特筆すべき劣化症状は確認されませんでした。</p>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                <tbody>{cur.symptoms.map((id) => { const s = SYMPTOMS.find((x) => x.id === id) || (cur.customSyms || []).find((x) => x.id === id); return s ? (
                  <tr key={id} style={{ borderBottom: "1px solid #E5E5EA" }}>
                    <td style={{ padding: "7px 8px", fontWeight: 700, whiteSpace: "nowrap", verticalAlign: "top" }}><span style={{ color: "#FF3B30" }}>●</span> <Ed v={(cur.symL || {})[id] || s.label} on={(t) => saveCur({ ...cur, symL: { ...(cur.symL || {}), [id]: t } })} /></td>
                    <td style={{ padding: "7px 8px" }}><Ed v={(cur.symNotes || {})[id] || s.note || "現地調査にて確認しました。"} on={(t) => saveCur({ ...cur, symNotes: { ...(cur.symNotes || {}), [id]: t } })} /></td>
                  </tr>) : null; })}
                </tbody>
              </table>
            )}
            {photos.length > 0 && (<>
              <div style={{ fontWeight: 700, fontSize: 14, margin: "18px 0 8px" }}>■ 現場写真</div>
              <div className="print-photos" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {photos.map((p) => (
                  <figure key={p.id} style={{ margin: 0 }}>
                    <img src={p.data} alt={p.tag} style={{ width: "100%", borderRadius: 8, display: "block" }} />
                    <figcaption style={{ fontSize: 11, color: SUB, marginTop: 3 }}>▲ {p.tag}：<Ed v={p.note || "　"} on={(t) => savePhotos(photos.map((x) => (x.id === p.id ? { ...x, note: t } : x)))} /></figcaption>
                  </figure>
                ))}
              </div>
            </>)}
            <div style={{ fontWeight: 700, fontSize: 14, margin: "18px 0 6px" }}>■ 総評・ご提案</div>
            <p style={{ fontSize: 13, lineHeight: 1.8 }}>
              <Ed multi v={cur.aiText ? cur.aiText : (cur.symptoms.length > 0
                ? "上記のとおり、塗膜の保護機能低下が進行している箇所が確認されました。放置すると下地の劣化が進み補修費用が大きくなるおそれがあるため、" + cur.grade + "仕様での塗替え（御見積 No." + cur.no + "）をご提案いたします。"
                : "現時点で大きな劣化は確認されませんでした。今後も定期的な点検をおすすめいたします。")} on={(t) => saveCur({ ...cur, aiText: t })} />
            </p>
            {set.company && <p style={{ fontSize: 12, textAlign: "right", marginTop: 16 }}><SealCo set={set} /></p>}
          </div>
        )}

        {docTab === "仕様書" && (() => {
          const wallQ = +((cur.items.find((i) => i.name.startsWith("外壁塗装")) || {}).qty || 0);
          const roofQ = +((cur.items.find((i) => i.name.startsWith("屋根塗装")) || {}).qty || 0);
          const sealQ = +((cur.items.find((i) => i.name.includes("シーリング")) || {}).qty || 0);
          const crack = cur.items.some((i) => i.name.includes("クラック"));
          const bio = cur.items.some((i) => i.name.includes("バイオ"));
          const steps = [
            ["高圧洗浄", bio ? "バイオ洗浄剤で苔・藻を根から除去後、水洗い" : "高圧水で汚れ・脆弱塗膜を除去", "1回"],
            ["養生", "窓・床・植栽等を飛散防止シートで保護", "－"],
            ...(crack ? [["下地補修", "クラック部をシール材・フィラーで補修", "適宜"]] : []),
            ...(sealQ ? [["シーリング打替", "既存撤去後、新規シーリング材を充填", sealQ + "m"]] : []),
            ["下塗り", "シーラーで下地を強化し、上塗りの密着性を確保", "1回"],
            ["中塗り", cur.grade + "塗料を規定膜厚で塗布", "1回"],
            ["上塗り", cur.grade + "塗料で仕上げ塗装（乾燥時間を厳守）", "1回"],
            ...(roofQ ? [["屋根塗装", "下塗り＋" + cur.grade + " 2回塗り", "3回"]] : []),
            ["検査・清掃", "お客様立会い検査のうえ、清掃して完了", "－"],
          ];
          const primer = Math.ceil(wallQ / 50), top = Math.ceil(wallQ / 30), tubes = Math.ceil(sealQ / 6);
          const shownS = cur.specSteps || steps;
          const putS = (i, col, t) => saveCur({ ...cur, specSteps: shownS.map((r, j) => (j === i ? r.map((c, k) => (k === col ? t : c)) : r)) });
          const mat = cur.mat || {};
          const putM = (k, t) => saveCur({ ...cur, mat: { ...mat, [k]: t } });
          if (!wallQ) {
            const gsteps = GSTEPS[cur.workType] || GSTEPS["内装・テナント"];
            const shownG = cur.specSteps || gsteps;
            const putG = (i, col, t) => saveCur({ ...cur, specSteps: shownG.map((r, j) => (j === i ? r.map((c, k) => (k === col ? t : c)) : r)) });
            return (
              <div className="card sheet-print" style={{ maxWidth: 760, margin: "0 auto", padding: "34px 24px" }}>
                <h2 style={{ textAlign: "center", letterSpacing: ".3em", fontSize: 20, margin: "0 0 6px", borderBottom: `3px double ${INK}`, paddingBottom: 10 }}>施工仕様書</h2>
                <p style={{ fontSize: 13, textAlign: "center", color: SUB, margin: "0 0 16px" }}><Ed v={cur.customer || "＿＿"} on={(t) => saveCur({ ...cur, customer: t })} /> 様　<Ed v={cur.title} on={(t) => saveCur({ ...cur, title: t })} /></p>
                <div style={{ fontWeight: 700, fontSize: 14, margin: "0 0 6px" }}>■ 標準施工工程</div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                  <tbody>{shownG.map(([a, b], i) => (
                    <tr key={i} style={{ borderBottom: "1px solid #E5E5EA" }}>
                      <td style={{ padding: "7px 8px", fontWeight: 600, whiteSpace: "nowrap" }}>{i + 1}. <Ed v={a} on={(t) => putG(i, 0, t)} /></td>
                      <td style={{ padding: "7px 8px" }}><Ed v={b} on={(t) => putG(i, 1, t)} /></td>
                    </tr>
                  ))}</tbody>
                </table>
                <div style={{ fontWeight: 700, fontSize: 14, margin: "18px 0 6px" }}>■ 施工項目</div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                  <tbody>{cur.items.map((it) => (
                    <tr key={it.id} style={{ borderBottom: "1px solid #E5E5EA" }}>
                      <td style={{ padding: "7px 8px" }}><Ed v={it.name} on={(t) => updItem(it.id, { name: t })} /></td>
                      <td className="num" style={{ padding: "7px 8px", textAlign: "right", whiteSpace: "nowrap" }}><Ed num v={it.qty + " " + it.unit} on={(t) => updItem(it.id, { qty: numOf(t, it.qty) })} /></td>
                    </tr>
                  ))}</tbody>
                </table>
                <p style={{ fontSize: 11, color: SUB, marginTop: 14 }}>※各工程間はメーカー規定の乾燥時間を厳守します。</p>
              </div>
            );
          }
          return (
            <div className="card sheet-print" style={{ maxWidth: 760, margin: "0 auto", padding: "34px 24px" }}>
              <h2 style={{ textAlign: "center", letterSpacing: ".3em", fontSize: 20, margin: "0 0 6px", borderBottom: `3px double ${INK}`, paddingBottom: 10 }}>施工仕様書・材料明細</h2>
              <p style={{ fontSize: 13, textAlign: "center", color: SUB, margin: "0 0 16px" }}><Ed v={cur.customer || "＿＿"} on={(t) => saveCur({ ...cur, customer: t })} /> 様邸　<Ed v={cur.title} on={(t) => saveCur({ ...cur, title: t })} />（{cur.grade}仕様）</p>
              <div style={{ fontWeight: 700, fontSize: 14, margin: "0 0 6px" }}>■ 施工工程</div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                <thead><tr style={{ background: INK, color: "#fff" }}>
                  <th style={{ padding: "6px 8px", textAlign: "left", fontWeight: 500 }}>工程</th>
                  <th style={{ padding: "6px 8px", textAlign: "left", fontWeight: 500 }}>内容</th>
                  <th style={{ padding: "6px 8px", textAlign: "right", fontWeight: 500 }}>回数/数量</th>
                </tr></thead>
                <tbody>{shownS.map(([a, b, d], i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #E5E5EA" }}>
                    <td style={{ padding: "6px 8px", fontWeight: 600, whiteSpace: "nowrap" }}>{i + 1}. <Ed v={a} on={(t) => putS(i, 0, t)} /></td>
                    <td style={{ padding: "6px 8px" }}><Ed v={b} on={(t) => putS(i, 1, t)} /></td>
                    <td className="num" style={{ padding: "6px 8px", textAlign: "right", whiteSpace: "nowrap" }}><Ed v={d} on={(t) => putS(i, 2, t)} /></td>
                  </tr>
                ))}</tbody>
              </table>
              <div style={{ fontWeight: 700, fontSize: 14, margin: "18px 0 6px" }}>■ 使用材料（概算）</div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                <tbody>
                  <tr style={{ borderBottom: "1px solid #E5E5EA" }}><td style={{ padding: "6px 8px" }}><Ed v={mat.pn || "下塗り材（シーラー 15kg缶）"} on={(t) => putM("pn", t)} /></td><td className="num" style={{ padding: "6px 8px", textAlign: "right" }}><Ed v={mat.pv || ("約" + primer + "缶（外壁 " + wallQ + "㎡）")} on={(t) => putM("pv", t)} /></td></tr>
                  <tr style={{ borderBottom: "1px solid #E5E5EA" }}><td style={{ padding: "6px 8px" }}><Ed v={mat.tn || ("上塗り材（" + cur.grade + "・15kg缶／中塗り＋上塗り分）")} on={(t) => putM("tn", t)} /></td><td className="num" style={{ padding: "6px 8px", textAlign: "right" }}><Ed v={mat.tv || ("約" + top + "缶")} on={(t) => putM("tv", t)} /></td></tr>
                  {sealQ > 0 && <tr style={{ borderBottom: "1px solid #E5E5EA" }}><td style={{ padding: "6px 8px" }}><Ed v={mat.sn || "シーリング材（320ml）"} on={(t) => putM("sn", t)} /></td><td className="num" style={{ padding: "6px 8px", textAlign: "right" }}><Ed v={mat.sv || ("約" + tubes + "本（" + sealQ + "m）")} on={(t) => putM("sv", t)} /></td></tr>}
                </tbody>
              </table>
              <p style={{ fontSize: 11, color: SUB, marginTop: 14 }}>※各工程間はメーカー規定の乾燥時間を厳守します。※缶数は標準塗布量からの概算で、下地の状態により増減します。</p>
            </div>
          );
        })()}

        {docTab === "請求書" && (
          <div className="card sheet-print" style={{ maxWidth: 760, margin: "0 auto", padding: "34px 24px" }}>
            <h2 style={{ textAlign: "center", letterSpacing: ".45em", fontSize: 22, margin: "0 0 20px", borderBottom: `3px double ${INK}`, paddingBottom: 10 }}>御 請 求 書</h2>
            <div style={{ fontSize: 17, fontWeight: 700, borderBottom: `1px solid ${INK}`, paddingBottom: 4, marginBottom: 12, maxWidth: 430 }}><Ed v={cur.customer || "＿＿＿＿"} on={(t) => saveCur({ ...cur, customer: t })} /> 様</div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
              <table style={{ fontSize: 13, borderCollapse: "collapse", flex: 1, minWidth: 0 }}><tbody>
                <tr><td style={{ paddingRight: 10, color: SUB, whiteSpace: "nowrap", verticalAlign: "top" }}>件名</td><td><Ed v={cur.title} on={(t) => saveCur({ ...cur, title: t })} />（{cur.grade}仕様）</td></tr>
                <tr><td style={{ paddingRight: 10, color: SUB, whiteSpace: "nowrap" }}>請求日</td><td className="num"><Ed num v={cur.invoiceDate || today} on={(t) => saveCur({ ...cur, invoiceDate: t })} /></td></tr>
              </tbody></table>
              <div style={{ textAlign: "right", fontSize: 12, maxWidth: "55%", flexShrink: 0 }}>
                <div className="num">No. {cur.no}-R</div>
                <div style={{ marginTop: 4 }}>登録番号：{set.invoiceNo || "（未設定）"}</div>
                {set.company && <div style={{ marginTop: 6 }}><SealCo set={set} /></div>}
              </div>
            </div>
            <div style={{ margin: "18px 0", background: "#F5F5F7", border: `1px solid ${INK}`, padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap" }}>
              <span style={{ fontWeight: 700 }}>御請求金額（税込）</span>
              <span className="num" style={{ fontSize: 24 }}>{yen(c.total)}</span>
            </div>
            <ItemsTable />
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
              <table style={{ fontSize: 13, borderCollapse: "collapse", minWidth: 260 }}><tbody>
                {[["10%対象（税抜）", c.beforeTax], ["消費税（10%）", c.tax]].map(([l, v]) => (
                  <tr key={l} style={{ borderBottom: "1px solid #E5E5EA" }}>
                    <td style={{ padding: "6px 10px", color: SUB }}>{l}</td>
                    <td className="num" style={{ padding: "6px 10px", textAlign: "right" }}>{yen(v)}</td>
                  </tr>
                ))}
                <tr style={{ background: "#F5F5F7", fontWeight: 700 }}>
                  <td style={{ padding: "8px 10px" }}>合計</td>
                  <td className="num" style={{ padding: "8px 10px", textAlign: "right" }}>{yen(c.total)}</td>
                </tr>
              </tbody></table>
            </div>
            <div style={{ marginTop: 18, border: "1px solid #E5E5EA", borderRadius: 10, padding: 12, fontSize: 13, whiteSpace: "pre-wrap" }}><b>お振込先</b>{"\n"}{set.bank || "（「単価設定」で振込先を登録してください）"}</div>
            <p style={{ fontSize: 12, color: SUB, marginTop: 10 }}>{set.terms}</p>
          </div>
        )}

        {docTab === "契約書" && (
          <div className="card sheet-print" style={{ maxWidth: 760, margin: "0 auto", padding: "34px 24px" }}>
            <h2 style={{ textAlign: "center", letterSpacing: ".3em", fontSize: 20, margin: "0 0 16px", borderBottom: `3px double ${INK}`, paddingBottom: 10 }}>工事請負契約書</h2>
            <p style={{ fontSize: 13, lineHeight: 1.8 }}>発注者 <Ed v={cur.customer || "＿＿＿＿"} on={(t) => saveCur({ ...cur, customer: t })} />（以下「甲」という）と受注者 <Ed v={otsu} on={(t) => { const ls = (set.company || "").split("\n"); ls[0] = t; persistSet({ ...set, company: ls.join("\n") }); }} />（以下「乙」という）は、下記の工事について請負契約を締結する。</p>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, margin: "10px 0 16px" }}>
              <tbody>
                {[["工事名", cur.title + "（" + cur.grade + "仕様）"], ["施工場所", cur.site || "－"], ["請負金額", yen(c.total) + "（税込・うち消費税 " + yen(c.tax) + "）"], ["工期", <Ed key="pd" v={cur.period || "　　　年　　月　　日 〜 　　　年　　月　　日"} on={(t) => saveCur({ ...cur, period: t })} />], ["支払条件", set.terms]].map(([k, v]) => (
                  <tr key={k} style={{ borderBottom: "1px solid #E5E5EA" }}>
                    <td style={{ padding: "9px 8px", color: SUB, width: 100 }}>{k}</td>
                    <td style={{ padding: "9px 8px", fontWeight: k === "請負金額" ? 700 : 500 }}>{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ fontSize: 12.5, lineHeight: 1.9 }}>
              <p style={{ margin: "4px 0" }}>第1条（施工）乙は、見積書（No.{cur.no}）および施工仕様書に基づき、本工事を誠実に施工する。</p>
              <p style={{ margin: "4px 0" }}>第2条（変更）工事内容の追加・変更が生じた場合は、甲乙協議のうえ書面により定める。</p>
              <p style={{ margin: "4px 0" }}>第3条（契約不適合責任）引渡し後1年以内に施工に起因する不具合が判明した場合、乙は無償で補修する。</p>
              <p style={{ margin: "4px 0" }}>第4条（支払）甲は乙に対し、前記の支払条件に従い請負代金を支払う。</p>
            </div>
            <p style={{ fontSize: 13, margin: "18px 0 6px" }}>契約日：<Ed v={cur.contractDate || "　　　　年　　月　　日"} on={(t) => saveCur({ ...cur, contractDate: t })} /></p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 8 }}>
              <div style={{ border: "1px solid #E5E5EA", borderRadius: 10, padding: 12, fontSize: 13, lineHeight: 2 }}>
                <b>甲（発注者）</b>
                <div style={{ display: "flex", gap: 8, alignItems: "baseline", marginTop: 8 }}>
                  <span style={{ color: SUB, flexShrink: 0, fontSize: 12 }}>住所</span>
                  <Ed style={{ flex: 1, borderBottom: "1px solid #C9CDD2" }} v={cur.customerAddr || "　"} on={(t) => saveCur({ ...cur, customerAddr: t })} />
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "baseline", marginTop: 8 }}>
                  <span style={{ color: SUB, flexShrink: 0, fontSize: 12 }}>氏名</span>
                  <Ed style={{ flex: 1, borderBottom: "1px solid #C9CDD2" }} v={cur.customer || "　"} on={(t) => saveCur({ ...cur, customer: t })} />
                  <span>㊞</span>
                </div>
              </div>
              <div style={{ border: "1px solid #E5E5EA", borderRadius: 10, padding: 12, fontSize: 13, lineHeight: 2, whiteSpace: "pre-wrap", position: "relative" }}>
                <b>乙（受注者）</b>{"\n"}<Ed multi v={set.company || "住所：\n氏名："} on={(t) => persistSet({ ...set, company: t })} />{set.seal ? "" : "　　㊞"}
                {set.seal && <img src={set.seal} alt="印" style={{ position: "absolute", right: 12, bottom: 10, width: 54, mixBlendMode: "multiply" }} />}
              </div>
            </div>
            <p style={{ fontSize: 11, color: SUB, marginTop: 14 }}>※本書式は簡易テンプレートです。金額の大きい工事では専門家（行政書士等）の確認をおすすめします。</p>
          </div>
        )}
        </div>
      </div>
    );
  }

  /* ---------- 会社・単価設定 ---------- */
  if (view === "settings") {
    const cats = set.catalogs || CATALOGS;
    const customT = (set.customTypes || []).find((t) => t.name === setType);
    const cat = customT ? customT.items : (cats[setType] || []);
    const saveCat = (items) => {
      if (customT) persistSet({ ...set, customTypes: set.customTypes.map((t) => (t.name === setType ? { ...t, items } : t)) });
      else persistSet({ ...set, catalogs: { ...cats, [setType]: items } });
    };
    const allTypes = [...WORKTYPES, ...(set.customTypes || []).map((t) => t.name)];
    const HOUSE_ROWS = [
      ...GRADES.map((g) => ({ get: () => set.gradePrices[g.name], put: (v) => persistSet({ ...set, gradePrices: { ...set.gradePrices, [g.name]: v } }), label: "外壁塗装 " + g.name + "（約" + g.years + "年・3回塗り）", unit: "㎡" })),
      ...[["scaffold", "足場架設・解体", "㎡"], ["wash", "高圧洗浄", "㎡"], ["bioWash", "バイオ高圧洗浄", "㎡"], ["masking", "養生", "㎡"], ["sealing", "シーリング打替", "m"], ["roof", "屋根塗装", "㎡"], ["crackRepair", "クラック補修", "式"]].map(([k, label, unit]) => ({ get: () => set[k], put: (v) => persistSet({ ...set, [k]: v }), label, unit })),
    ];
    const rowStyle = { display: "flex", alignItems: "center", gap: 8, padding: "10px 0", borderBottom: ".5px solid rgba(0,0,0,.08)" };
    return (
      <div className="root"><style>{css}</style><Toast />
        <header className="appbar no-print"><div className="appbar-in">
          <button className="btn btn-bar btn-mini" onClick={() => setView("home")}>← ホーム</button>
        </div></header>
        <div style={{ maxWidth: 560, margin: "0 auto", padding: "18px 16px 60px" }}>
          <h2 style={{ margin: "4px 0 12px", fontSize: 24, fontWeight: 800 }}>設定</h2>
          <Seg options={["基本情報", "タイプ別単価"]} value={setTab} onChange={setSetTab} />
          <p className="sub" style={{ fontSize: 12, margin: "8px 4px 16px" }}>ここで決めた内容は、変更しない限りすべての見積・書類に自動で適用され続けます。</p>

          {setTab === "基本情報" && (<>
          {tenantMode && (
          <>
          <div className="eyebrow" style={{ margin: "0 4px 8px" }}>ホワイトラベル（アプリ表示名・テーマ）</div>
          <div className="card" style={{ padding: 16, marginBottom: 18, display: "flex", flexDirection: "column", gap: 14 }}>
            <Field label="アプリ表示名" hint="ヘッダーやブラウザタブに表示されます。他社展開時は会社ごとに変更できます。">
              <input
                value={branding?.app_name || appLabel}
                onChange={(e) => onBrandingChange && onBrandingChange({ app_name: e.target.value })}
                placeholder="○○塗装 見積システム"
              />
            </Field>
            <Field label="テーマカラー">
              <input
                type="color"
                value={accentColor}
                onChange={(e) => onBrandingChange && onBrandingChange({ primary_color: e.target.value })}
                style={{ width: 56, height: 40, padding: 4 }}
              />
            </Field>
          </div>
          </>
          )}
          <div className="eyebrow" style={{ margin: "0 4px 8px" }}>会社情報</div>
          <div className="card" style={{ padding: 16, marginBottom: 18, display: "flex", flexDirection: "column", gap: 14 }}>
            <Field label="会社名"><input value={set.coName || ""} onChange={(e) => { const nf = { ...set, coName: e.target.value }; persistSet({ ...nf, company: buildCo(nf) }); }} placeholder="株式会社○○塗装" /></Field>
            <Field label="住所"><input value={set.coAddr || ""} onChange={(e) => { const nf = { ...set, coAddr: e.target.value }; persistSet({ ...nf, company: buildCo(nf) }); }} placeholder="○○県○○市○○町1-2-3" /></Field>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Field label="代表者名"><input value={set.coRep || ""} onChange={(e) => { const nf = { ...set, coRep: e.target.value }; persistSet({ ...nf, company: buildCo(nf) }); }} placeholder="山田 太郎" /></Field>
              <Field label="電話番号"><input value={set.coTel || ""} onChange={(e) => { const nf = { ...set, coTel: e.target.value }; persistSet({ ...nf, company: buildCo(nf) }); }} placeholder="000-000-0000" /></Field>
            </div>
            <Field label="メールアドレス"><input value={set.coMail || ""} onChange={(e) => { const nf = { ...set, coMail: e.target.value }; persistSet({ ...nf, company: buildCo(nf) }); }} placeholder="info@example.com" /></Field>
            <Field label="電子印鑑（社判・角印）" hint="透過PNG推奨。見積書・請求書・契約書・報告書に自動で押印されます">
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                {set.seal ? (
                  <img src={set.seal} alt="登録済みの印鑑" style={{ width: 64, height: 64, objectFit: "contain", background: "#fff", borderRadius: 12, padding: 5, boxShadow: "inset 0 0 0 1px #E4E5E9" }} />
                ) : (
                  <div style={{ width: 64, height: 64, borderRadius: 12, background: "#F2F2F7", display: "grid", placeItems: "center", fontSize: 11, color: "#AEAEB2" }}>未登録</div>
                )}
                <label className="btn btn-soft btn-mini" style={{ cursor: "pointer" }}>
                  {set.seal ? "変更" : "画像を選ぶ"}
                  <input type="file" accept="image/*" style={{ display: "none" }}
                    onChange={async (e) => { const f = e.target.files && e.target.files[0]; e.target.value = ""; if (!f) return; try { await persistSet({ ...set, seal: await readSeal(f) }); flash("印鑑を登録しました"); } catch (er) { flash("画像を読み込めませんでした。スクリーンショット画像でお試しください"); } }} />
                </label>
                {set.seal && <button className="btn btn-soft btn-mini" style={{ color: "#FF3B30" }} onClick={() => persistSet({ ...set, seal: "" })}>削除</button>}
              </div>
            </Field>
            <Field label="会社ロゴ" hint="書類の社名の左に自動で入ります（横長ロゴ推奨）">
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                {set.logo ? (
                  <img src={set.logo} alt="登録済みのロゴ" style={{ height: 44, maxWidth: 150, objectFit: "contain", background: "#fff", borderRadius: 12, padding: 6, boxShadow: "inset 0 0 0 1px #E4E5E9" }} />
                ) : (
                  <div style={{ width: 110, height: 44, borderRadius: 12, background: "#F2F2F7", display: "grid", placeItems: "center", fontSize: 11, color: "#AEAEB2" }}>未登録</div>
                )}
                <label className="btn btn-soft btn-mini" style={{ cursor: "pointer" }}>
                  {set.logo ? "変更" : "画像を選ぶ"}
                  <input type="file" accept="image/*" style={{ display: "none" }}
                    onChange={async (e) => { const f = e.target.files && e.target.files[0]; e.target.value = ""; if (!f) return; try { await persistSet({ ...set, logo: await readSeal(f) }); flash("ロゴを登録しました"); } catch (er) { flash("画像を読み込めませんでした。スクリーンショット画像でお試しください"); } }} />
                </label>
                {set.logo && <button className="btn btn-soft btn-mini" style={{ color: "#FF3B30" }} onClick={() => persistSet({ ...set, logo: "" })}>削除</button>}
              </div>
            </Field>
            <Field label="適格請求書 登録番号（インボイス）">
              <input value={set.invoiceNo} onChange={(e) => persistSet({ ...set, invoiceNo: e.target.value })} placeholder="T1234567890123" />
            </Field>
            <Field label="振込先（請求書に記載）">
              <textarea rows={2} value={set.bank} onChange={(e) => persistSet({ ...set, bank: e.target.value })} placeholder={"○○銀行 ○○支店 普通 1234567\nカ）○○○○"} />
            </Field>
            <Field label="支払条件（請求書・契約書に記載）">
              <input value={set.terms} onChange={(e) => persistSet({ ...set, terms: e.target.value })} />
            </Field>
            <Field label="サポート窓口URL（任意）" hint="LINE公式アカウント等のURL。ヘルプ画面の問い合わせボタンに表示されます">
              <input value={set.supportUrl || ""} onChange={(e) => persistSet({ ...set, supportUrl: e.target.value })} placeholder="https://lin.ee/..." />
            </Field>
            {!tenantMode && (
            <Field label="Claude APIキー（任意・Mac版のAI提案文用）" hint="console.anthropic.com で取得。Claude内で使う場合は不要です">
              <input value={set.apiKey} onChange={(e) => persistSet({ ...set, apiKey: e.target.value })} placeholder="sk-ant-..." />
            </Field>
            )}
            {tenantMode && (
            <p className="sub" style={{ fontSize: 13, margin: "8px 0 0" }}>AI機能はクラウド版ではサーバー経由で安全に利用できます（APIキーの入力は不要です）。</p>
            )}
          </div>

          <div className="eyebrow" style={{ margin: "0 4px 8px" }}>経営設定</div>
          <div className="card" style={{ padding: 16, marginBottom: 18 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              {[["costRate", "原価率（%）"], ["overheadRate", "諸経費率（%）"], ["marginAlert", "粗利警告（%）"]].map(([k, l]) => (
                <SettingNum key={k} label={l} value={set[k]} onChange={(e) => persistSet({ ...set, [k]: e.target.value })} />
              ))}
            </div>
          </div>

          <div className="eyebrow" style={{ margin: "0 4px 8px" }}>データの引き継ぎ（バックアップ）</div>
          <div className="card" style={{ padding: 16 }}>
            <p className="sub" style={{ fontSize: 13, margin: "0 0 12px" }}>アプリが新しい画面に更新されると、データが引き継がれないことがあります。作業の区切りで「書き出す」を押してコピーしておき、新しい画面のこの欄に貼り付けて「取り込む」と、案件・単価・写真がすべて復元されます。</p>
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <button className="btn btn-ac btn-mini" onClick={exportData}>書き出してコピー</button>
              <button className="btn btn-soft btn-mini" disabled={!ioText.trim()} onClick={importData}>取り込む</button>
            </div>
            <textarea rows={4} value={ioText} onChange={(e) => setIoText(e.target.value)} placeholder="書き出したテキストがここに入ります。復元するときは、コピーしておいたテキストをここに貼り付けて「取り込む」を押してください。" style={{ fontSize: 12 }} />
          </div>
          </>)}

          {setTab === "タイプ別単価" && (<>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 10 }}>
            {allTypes.map((w) => {
              const on = setType === w;
              return (
                <button key={w} onClick={() => { setSetType(w); setDelType(""); }}
                  style={{ border: "none", borderRadius: 12, padding: "12px 4px", fontSize: 13.5, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", background: on ? "#1B7F3B" : "#fff", color: on ? "#fff" : "#1D1D1F", transition: "all .12s", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {w}
                </button>
              );
            })}
          </div>
          <div className="card" style={{ padding: "10px 14px", marginBottom: 14, display: "flex", gap: 8, alignItems: "center" }}>
            <input value={newType} onChange={(e) => setNewType(e.target.value)} placeholder="新しい工事タイプ名（例：板金）" />
            <button className="btn btn-ac btn-mini" style={{ flexShrink: 0 }} disabled={!newType.trim() || allTypes.includes(newType.trim())}
              onClick={async () => {
                const nm = newType.trim();
                await persistSet({ ...set, customTypes: [...(set.customTypes || []), { name: nm, items: [] }] });
                setSetType(nm); setNewType(""); flash("タイプ「" + nm + "」を追加しました");
              }}>＋ 追加</button>
          </div>

          {setType === "戸建" ? (
            <div className="card" style={{ padding: "6px 16px" }}>
              {HOUSE_ROWS.map((r, i) => (
                <div key={r.label} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 0", borderBottom: i < HOUSE_ROWS.length - 1 ? ".5px solid rgba(0,0,0,.08)" : "none" }}>
                  <div style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 500 }}>{r.label}</div>
                  <input className="num" type="number" inputMode="numeric" value={r.get()} onChange={(e) => r.put(e.target.value)} style={{ width: 96, textAlign: "right", padding: "9px 10px" }} />
                  <span className="sub" style={{ fontSize: 13, width: 34 }}>/{r.unit}</span>
                </div>
              ))}
              <p className="sub" style={{ fontSize: 11.5, margin: "10px 0" }}>※戸建の項目は面積からの自動見積エンジンと連動しているため、名称は固定です。追加工事は見積の編集画面「＋ 空の行を追加」から入れられます。</p>
            </div>
          ) : (
            <div className="card" style={{ padding: "6px 16px" }}>
              {cat.map((it, idx) => (
                <div key={idx} style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 0", borderBottom: ".5px solid rgba(0,0,0,.08)" }}>
                  <input value={it.name} onChange={(e) => saveCat(cat.map((x, i) => (i === idx ? { ...x, name: e.target.value } : x)))} style={{ flex: 1, minWidth: 0, padding: "9px 10px", fontSize: 14 }} />
                  <input className="num" type="number" inputMode="numeric" value={it.price} onChange={(e) => saveCat(cat.map((x, i) => (i === idx ? { ...x, price: e.target.value } : x)))} style={{ width: 84, textAlign: "right", padding: "9px 8px" }} />
                  <input value={it.unit} onChange={(e) => saveCat(cat.map((x, i) => (i === idx ? { ...x, unit: e.target.value } : x)))} style={{ width: 48, textAlign: "center", padding: "9px 4px", fontSize: 13 }} />
                  <button className="btn btn-soft btn-mini" style={{ color: "#FF3B30", padding: "6px 9px" }} onClick={() => saveCat(cat.filter((_, i) => i !== idx))}>✕</button>
                </div>
              ))}
              <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "12px 0 10px" }}>
                <input value={addRow.name} onChange={(e) => setAddRow({ ...addRow, name: e.target.value })} placeholder="項目名を手入力" style={{ flex: 1, minWidth: 0, padding: "9px 10px", fontSize: 14 }} />
                <input className="num" type="number" inputMode="numeric" value={addRow.price} onChange={(e) => setAddRow({ ...addRow, price: e.target.value })} placeholder="単価" style={{ width: 84, textAlign: "right", padding: "9px 8px" }} />
                <input value={addRow.unit} onChange={(e) => setAddRow({ ...addRow, unit: e.target.value })} placeholder="単位" style={{ width: 48, textAlign: "center", padding: "9px 4px", fontSize: 13 }} />
                <button className="btn btn-ac btn-mini" style={{ padding: "8px 12px" }} disabled={!addRow.name.trim()}
                  onClick={() => { saveCat([...cat, { name: addRow.name.trim(), unit: addRow.unit.trim() || "式", price: +addRow.price || 0 }]); setAddRow({ name: "", unit: addRow.unit, price: "" }); flash("項目を追加しました"); }}>＋</button>
              </div>
              <p className="sub" style={{ fontSize: 11.5, margin: "0 0 10px" }}>名称・単価・単位（㎡ / m / 箇所 / 式 など）はすべて手入力で変更できます。追加した項目は見積ウィザードにすぐ反映されます。</p>
              {customT && (
                <button className="btn btn-soft btn-mini" style={{ color: "#FF3B30", marginBottom: 10 }}
                  onClick={async () => {
                    if (delType === setType) { await persistSet({ ...set, customTypes: set.customTypes.filter((t) => t.name !== setType) }); setSetType("戸建"); setDelType(""); flash("タイプを削除しました"); }
                    else { setDelType(setType); setTimeout(() => setDelType((d) => (d === setType ? "" : d)), 3000); }
                  }}>{delType === setType ? "本当に削除？（もう一度タップ）" : "このタイプを削除"}</button>
              )}
            </div>
          )}
          </>)}
        </div>
      </div>
    );
  }

  return null;
}
