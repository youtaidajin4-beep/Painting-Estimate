import React, { useState, useEffect } from "react";
import { BrandHeader } from "./src/components/BrandHeader";
import { InvitePanel } from "./src/components/InvitePanel";
import { useAppShell } from "./src/context/AppShellContext";
import { PRINT_HINT, PRINT_SHEET_PADDING, printPageBase } from "./src/styles/printShared";

// ---- スタンドアロン実行用：window.storage が無い環境では localStorage で保存 ----
if (typeof window !== "undefined" && !window.storage) {
  window.storage = {
    async get(key) {
      const v = window.localStorage.getItem("gm:" + key);
      if (v === null) throw new Error("not found");
      return { key, value: v };
    },
    async set(key, value) { window.localStorage.setItem("gm:" + key, value); return { key, value }; },
    async delete(key) { window.localStorage.removeItem("gm:" + key); return { key, deleted: true }; },
    async list() { return { keys: Object.keys(window.localStorage).filter((k) => k.startsWith("gm:")).map((k) => k.slice(3)) }; },
  };
}

/* ============ 現場管理 Pro ============
   出面（勤怠）・日報・現場別収支を一元管理する業務クラウド型アプリ
   デザイン方針：業務システムとしての信用感（罫線・表・落ち着いた濃緑）
*/

const PRI_DEFAULT = "#1B7F3B";   // 濃緑（プライマリ）— module fallback
const INK = "#1A1F27";
const SUB = "#5C6570";
const BD  = "#DDE1E6";
const WARN = "#B45309";
const DANGER = "#B91C1C";
const yen = (n) => "¥" + Math.round(n || 0).toLocaleString("ja-JP");
const uid = () => Math.random().toString(36).slice(2);
const today = () => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
const thisMonth = () => today().slice(0, 7);
const fmtD = (s) => { if (!s) return "—"; const [, m, d] = s.split("-"); return Number(m) + "/" + Number(d); };
const K = { sites: "gm-sites-v1", crew: "gm-crew-v1", att: "gm-att-v1", exp: "gm-exp-v1", rep: "gm-rep-v1", co: "gm-co-v1" };
const EXP_CATS = ["材料費", "外注費", "リース・機材", "交通・諸経費"];

export default function GenbaKanriPro({ branding = null, tenantMode = false }) {
  const PRI = branding?.primary_color || (typeof window !== "undefined" && window.__tenantBranding?.primary_color) || "#1B7F3B";
  const [view, setView] = useState("home"); // home | attend | report | site | crew | sheet | settings | done
  const [menuOpen, setMenuOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const appShell = useAppShell();
  const [sites, setSites] = useState([]);
  const [crew, setCrew] = useState([]);
  const [att, setAtt] = useState([]);
  const [exps, setExps] = useState([]);
  const [reps, setReps] = useState([]);
  const [co, setCo] = useState({ name: "" });
  const [toast, setToast] = useState("");
  const [loaded, setLoaded] = useState(false);

  const [attDate, setAttDate] = useState(today());
  const [attSite, setAttSite] = useState("");
  const [attDraft, setAttDraft] = useState({});
  const [curSiteId, setCurSiteId] = useState(null);
  const [newSite, setNewSite] = useState(null);
  const [newWorker, setNewWorker] = useState({ name: "", wage: "" });
  const [expRow, setExpRow] = useState({ name: "", cat: "材料費", amount: "" });
  const [repDraft, setRepDraft] = useState({ date: today(), siteId: "", work: "", tomorrow: "", photos: [] });
  const [sheetMonth, setSheetMonth] = useState(thisMonth());
  const [sheetSite, setSheetSite] = useState("");
  const [delId, setDelId] = useState(null);
  const [ioText, setIoText] = useState("");

  /* ---------- 読み込み・保存 ---------- */
  useEffect(() => {
    (async () => {
      const cloud = tenantMode ? window.__genbaStorage : null;
      const load = async (key, fb) => {
        if (cloud) return cloud.load(key, fb);
        try { const r = await window.storage.get(key); return JSON.parse(r.value); } catch { return fb; }
      };
      setSites(await load(K.sites, []));
      setCrew(await load(K.crew, []));
      setAtt(await load(K.att, []));
      setExps(await load(K.exp, []));
      setReps(await load(K.rep, []));
      const coData = await load(K.co, { name: "" });
      setCo(tenantMode && branding?.co_name ? { name: branding.co_name } : coData);
      setLoaded(true);
    })();
  }, [tenantMode, branding?.co_name]);
  const save = async (key, v, setter) => {
    setter(v);
    if (tenantMode && window.__genbaStorage) {
      await window.__genbaStorage.save(key, v);
      return;
    }
    try { await window.storage.set(key, JSON.stringify(v)); } catch {}
  };
  const flash = (m) => { setToast(m); setTimeout(() => setToast(""), 2200); };

  /* ---------- 集計 ---------- */
  const wageOf = (wid) => Number((crew.find((w) => w.id === wid) || {}).wage || 0);
  const nameOf = (wid) => (crew.find((w) => w.id === wid) || {}).name || "（削除済）";
  const siteName = (sid) => (sites.find((s) => s.id === sid) || {}).name || "（削除済）";
  const siteCalc = (s) => {
    const a = att.filter((x) => x.siteId === s.id);
    const labor = a.reduce((sum, x) => sum + x.ninku * wageOf(x.workerId), 0);
    const ninku = a.reduce((sum, x) => sum + x.ninku, 0);
    const expense = exps.filter((x) => x.siteId === s.id).reduce((sum, x) => sum + Number(x.amount || 0), 0);
    const amount = Number(s.amount || 0);
    const cost = labor + expense;
    const profit = amount - cost;
    const rate = amount ? Math.round((profit / amount) * 100) : 0;
    return { labor, ninku, expense, amount, cost, profit, rate };
  };
  const rateColor = (c) => !c.amount ? SUB : c.rate >= 30 ? PRI : c.rate >= 15 ? WARN : DANGER;

  /* ---------- 共通UI ---------- */
  const Toast = () => toast ? (
    <div className="no-print toastx">{toast}</div>
  ) : null;

  const Logo = () => (
    <BrandHeader
      branding={branding || window.__tenantBranding || { app_name: "現場管理 Pro", primary_color: PRI }}
    />
  );

  const Bar = ({ onBack, title, right }) => (
    <header className="appbar no-print"><div className="appbar-in">
      {onBack
        ? <button className="btn-link" onClick={onBack}>← ホーム</button>
        : <Logo />}
      {title && <span className="bar-title">{title}</span>}
      {right || <span style={{ width: 44 }} />}
    </div></header>
  );

  const icons = {
    person: <><circle cx="12" cy="8" r="3.6" /><path d="M4.8 19.4c1.3-3.1 4-4.7 7.2-4.7s5.9 1.6 7.2 4.7" /></>,
    sheet: <><rect x="4.5" y="3.6" width="15" height="16.8" rx="1.6" /><path d="M8 8h8M8 12h8M8 16h4.5" /></>,
    check: <><circle cx="12" cy="12" r="8.4" /><path d="m8.4 12.2 2.4 2.4 4.8-5.2" /></>,
    building: <><rect x="5" y="4" width="14" height="16.4" rx="1.5" /><path d="M9 8.2h1.6M13.4 8.2H15M9 12h1.6M13.4 12H15M10.5 20.4v-3.6h3v3.6" /></>,
    paint: <><path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" /></>,
    invite: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M19 8v6M22 11h-6" /></>,
    logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" /></>,
  };
  const Icon = ({ k }) => <svg className="mi-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{icons[k]}</svg>;

  const Menu = () => {
    const items = [
      ["person", "職人管理", () => setView("crew")],
      ["sheet", "出面表（印刷）", () => setView("sheet")],
      ["check", "完了した現場", () => setView("done")],
      ["building", "会社情報・データ", () => setView("settings")],
    ];
    if (tenantMode && appShell) {
      items.push(["paint", "塗装見積を開く", () => appShell.switchApp("paint")]);
      if (appShell.canInvite) {
        items.push(["invite", "メンバー招待", () => setInviteOpen(true)]);
      }
      items.push(["logout", "ログアウト", () => appShell.signOut()]);
    }
    return (
      <>
        {menuOpen ? (
          <div className="menu-ovl no-print" onClick={() => setMenuOpen(false)}>
            <nav className="menu-panel" onClick={(ev) => ev.stopPropagation()}>
              <div className="menu-head">
                <Logo />
                <button className="menu-x" aria-label="閉じる" onClick={() => setMenuOpen(false)}>✕</button>
              </div>
              {items.map(([k, label, go]) => (
                <button key={label} className="menu-item" onClick={() => { setMenuOpen(false); go(); }}>
                  <Icon k={k} />{label}<span className="mi-arrow">›</span>
                </button>
              ))}
              {co.name && <div className="menu-co">{co.name}</div>}
            </nav>
          </div>
        ) : null}
        {tenantMode && <InvitePanel open={inviteOpen} onClose={() => setInviteOpen(false)} />}
      </>
    );
  };

  if (!loaded) return <div className="root"><style>{css}</style></div>;

  /* ---------- ダッシュボード ---------- */
  if (view === "home") {
    const active = sites.filter((s) => !s.done);
    const attM = att.filter((x) => (x.date || "").startsWith(thisMonth()));
    const ninkuM = attM.reduce((s, x) => s + x.ninku, 0);
    const laborM = attM.reduce((s, x) => s + x.ninku * wageOf(x.workerId), 0);
    const profitAll = active.reduce((s, x) => s + siteCalc(x).profit, 0);
    const attToday = att.filter((x) => x.date === today());
    const bySite = {};
    attToday.forEach((x) => { (bySite[x.siteId] = bySite[x.siteId] || []).push(x); });
    return (
      <div className="root"><style>{css}</style><Toast /><Menu />
        <header className="appbar no-print"><div className="appbar-in">
          <Logo />
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {co.name && <span className="co-name">{co.name}</span>}
            <button className="hbg" aria-label="メニュー" onClick={() => setMenuOpen(true)}><span /><span /><span /></button>
          </div>
        </div></header>
        <div className="wrap">
          <div className="page-head">
            <h1>ダッシュボード</h1>
            <span className="date-line">{new Date().toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric", weekday: "short" })}</span>
          </div>

          <div className="home-grid"><div className="home-side">
          <div className="kpis">
            {[["今月の稼働", ninkuM.toLocaleString("ja-JP"), "人工"], ["今月の労務費", yen(laborM), ""], ["進行中現場の粗利", yen(profitAll), ""]].map(([l, v, u]) => (
              <div key={l} className="kpi"><div className="kpi-l">{l}</div><div className="kpi-v num">{v}<span className="kpi-u">{u}</span></div></div>
            ))}
          </div>

          <div className="act-row">
            <button className="btn btn-pri" onClick={() => { setAttDate(today()); setAttSite(active[0] ? active[0].id : ""); setView("attend"); }}>出面を記録</button>
            <button className="btn btn-line" onClick={() => { setRepDraft({ date: today(), siteId: active[0] ? active[0].id : "", work: "", tomorrow: "", photos: [] }); setView("report"); }}>日報を作成</button>
          </div>

          {Object.keys(bySite).length > 0 && (
            <div className="panel">
              <div className="panel-h">本日の出面</div>
              <table className="tbl">
                <tbody>
                  {Object.entries(bySite).map(([sid, list]) => (
                    <tr key={sid}>
                      <td style={{ fontWeight: 600 }}>{siteName(sid)}</td>
                      <td className="sub">{list.map((x) => nameOf(x.workerId) + " " + x.ninku).join("、")}</td>
                      <td className="num" style={{ textAlign: "right", whiteSpace: "nowrap" }}>計 {list.reduce((s, x) => s + x.ninku, 0)} 人工</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          </div>

          <div className="home-main">
          <div className="panel">
            <div className="panel-h">
              進行中の現場<span className="count">{active.length}件</span>
              <button className="btn btn-line btn-s" style={{ marginLeft: "auto" }} onClick={() => setNewSite({ name: "", client: "", addr: "", amount: "" })}>＋ 現場を登録</button>
            </div>

            {newSite && (
              <div className="form-block">
                <div className="grid2">
                  <label className="fld"><span>現場名 <em>必須</em></span><input placeholder="例：〇〇工場 外壁塗装工事" value={newSite.name} onChange={(e) => setNewSite({ ...newSite, name: e.target.value })} /></label>
                  <label className="fld"><span>元請・発注者</span><input value={newSite.client} onChange={(e) => setNewSite({ ...newSite, client: e.target.value })} /></label>
                  <label className="fld"><span>住所</span><input placeholder="現場の所在地" value={newSite.addr} onChange={(e) => setNewSite({ ...newSite, addr: e.target.value })} /></label>
                  <label className="fld"><span>受注金額（税抜）</span><input type="number" inputMode="numeric" value={newSite.amount} onChange={(e) => setNewSite({ ...newSite, amount: e.target.value })} /></label>
                </div>
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 10 }}>
                  <button className="btn btn-line btn-s" onClick={() => setNewSite(null)}>取り消す</button>
                  <button className="btn btn-pri btn-s" disabled={!newSite.name} onClick={async () => { await save(K.sites, [{ id: uid(), ...newSite, start: today(), done: "" }, ...sites], setSites); setNewSite(null); flash("現場を登録しました"); }}>登録する</button>
                </div>
              </div>
            )}

            {active.length === 0 && !newSite ? (
              <div className="empty">
                <p style={{ fontWeight: 600, margin: "0 0 4px" }}>現場が登録されていません</p>
                <p className="sub" style={{ margin: 0, fontSize: 13 }}>現場名と受注金額を登録すると、出面と収支の管理を開始できます。</p>
                <button className="btn btn-pri btn-s" style={{ marginTop: 12 }} onClick={() => setNewSite({ name: "", client: "", addr: "", amount: "" })}>＋ 現場を登録</button>
              </div>
            ) : (
              <table className="tbl site-tbl">
                <thead className="pc-only"><tr><th style={{ textAlign: "left" }}>現場</th><th>人工</th><th>原価</th><th>受注金額</th><th>粗利</th><th>操作</th></tr></thead>
                <tbody>
                  {active.map((s) => {
                    const c = siteCalc(s);
                    const ratio = c.amount ? Math.min(100, Math.round((c.cost / c.amount) * 100)) : 0;
                    return (
                      <tr key={s.id}>
                        <td data-l="現場" style={{ textAlign: "left" }}>
                          <div style={{ fontWeight: 600 }}>{s.name}</div>
                          <div className="sub" style={{ fontSize: 12 }}>{s.client || "—"}・{fmtD(s.start)}〜</div>
                          <div className="costbar"><i style={{ width: ratio + "%", background: c.cost > c.amount ? DANGER : ratio > 85 ? WARN : PRI }} /></div>
                        </td>
                        <td data-l="人工" className="num">{c.ninku}</td>
                        <td data-l="原価" className="num">{yen(c.cost)}</td>
                        <td data-l="受注金額" className="num">{yen(c.amount)}</td>
                        <td data-l="粗利" className="num" style={{ color: rateColor(c), fontWeight: 700 }}>{c.amount ? c.rate + "%" : "—"}</td>
                        <td data-l="操作">
                          <span className="ops">
                            <button className="btn-link" onClick={() => { setCurSiteId(s.id); setExpRow({ name: "", cat: "材料費", amount: "" }); setView("site"); }}>詳細</button>
                            <button className="btn-link" onClick={() => { setRepDraft({ date: today(), siteId: s.id, work: "", tomorrow: "", photos: [] }); setView("report"); }}>日報</button>
                            <button className="btn-link" onClick={async () => { await save(K.sites, sites.map((x) => x.id === s.id ? { ...x, done: today() } : x), setSites); flash("現場を完了にしました"); }}>完了</button>
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
          </div>
          </div>
        </div>
      </div>
    );
  }

  /* ---------- 出面を記録 ---------- */
  if (view === "attend") {
    const active = sites.filter((s) => !s.done);
    const existing = att.filter((x) => x.date === attDate && x.siteId === attSite);
    const draftInit = () => { const d = {}; existing.forEach((x) => { d[x.workerId] = x.ninku; }); return d; };
    const draft = Object.keys(attDraft).length || existing.length === 0 ? attDraft : draftInit();
    const toggle = (wid) => { const d = { ...draft }; if (d[wid]) delete d[wid]; else d[wid] = 1; setAttDraft(d); };
    const cycle = (wid) => { const seq = [0.5, 1, 1.5]; const d = { ...draft }; d[wid] = seq[(seq.indexOf(d[wid]) + 1) % seq.length]; setAttDraft(d); };
    const total = Object.values(draft).reduce((s, n) => s + n, 0);
    return (
      <div className="root"><style>{css}</style><Toast />
        <Bar onBack={() => { setAttDraft({}); setView("home"); }} title="出面記録" />
        <div className="wrap" style={{ maxWidth: 680 }}>
          <div className="panel">
            <div className="grid2" style={{ padding: "14px 16px" }}>
              <label className="fld"><span>日付</span><input type="date" value={attDate} onChange={(e) => { setAttDate(e.target.value); setAttDraft({}); }} /></label>
              <label className="fld"><span>現場</span>
                <select value={attSite} onChange={(e) => { setAttSite(e.target.value); setAttDraft({}); }}>
                  <option value="">選択してください</option>
                  {active.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </label>
            </div>
          </div>

          {crew.length === 0 ? (
            <div className="panel"><div className="empty">
              <p style={{ fontWeight: 600, margin: "0 0 10px" }}>職人が登録されていません</p>
              <button className="btn btn-pri btn-s" onClick={() => setView("crew")}>職人管理で登録する</button>
            </div></div>
          ) : (
            <>
              <p className="sub" style={{ fontSize: 12.5, margin: "0 2px 8px" }}>出勤した職人を選択してください。選択後にもう一度押すと 0.5 → 1.0 → 1.5 人工の順に切り替わります。</p>
              <div className="panel">
                <table className="tbl">
                  <tbody>
                    {crew.map((w) => {
                      const on = draft[w.id];
                      return (
                        <tr key={w.id} className={on ? "row-on" : ""} onClick={() => on ? cycle(w.id) : toggle(w.id)} style={{ cursor: "pointer" }}>
                          <td style={{ fontWeight: 600, textAlign: "left" }}>{w.name}</td>
                          <td className="num" style={{ textAlign: "right", color: on ? PRI : "#A6ADB5", fontWeight: 700, whiteSpace: "nowrap" }}>{on ? on + " 人工" : "未選択"}</td>
                          <td style={{ width: 64, textAlign: "right" }}>
                            {on && <button className="btn-link danger" onClick={(e) => { e.stopPropagation(); toggle(w.id); }}>外す</button>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <button className="btn btn-pri btn-lg" disabled={!attSite || total === 0} onClick={async () => {
                const rest = att.filter((x) => !(x.date === attDate && x.siteId === attSite));
                const add = Object.entries(draft).map(([wid, n]) => ({ id: uid(), date: attDate, siteId: attSite, workerId: wid, ninku: n }));
                await save(K.att, [...rest, ...add], setAtt);
                setAttDraft({}); setView("home"); flash("出面を保存しました（計 " + total + " 人工）");
              }}>保存する（計 {total} 人工）</button>
            </>
          )}
        </div>
      </div>
    );
  }

  /* ---------- 日報作成 ---------- */
  if (view === "report") {
    const active = sites.filter((s) => !s.done);
    const r = repDraft;
    const dayAtt = att.filter((x) => x.date === r.date && x.siteId === r.siteId);
    const addPhotos = (files) => {
      [...files].slice(0, 6 - r.photos.length).forEach((f) => {
        const rd = new FileReader();
        rd.onload = () => setRepDraft((p) => ({ ...p, photos: [...p.photos, rd.result] }));
        rd.readAsDataURL(f);
      });
    };
    const siteReps = reps.filter((x) => !r.siteId || x.siteId === r.siteId).slice(0, 8);
    return (
      <div className="root"><style>{css}</style><Toast />
        <Bar onBack={() => setView("home")} title="日報作成" />
        <div className="wrap" style={{ maxWidth: 680 }}>
          <div className="panel">
            <div style={{ padding: "14px 16px" }}>
              <div className="grid2">
                <label className="fld"><span>日付</span><input type="date" value={r.date} onChange={(e) => setRepDraft({ ...r, date: e.target.value })} /></label>
                <label className="fld"><span>現場</span>
                  <select value={r.siteId} onChange={(e) => setRepDraft({ ...r, siteId: e.target.value })}>
                    <option value="">選択してください</option>
                    {active.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </label>
              </div>
              {dayAtt.length > 0 && (
                <p style={{ fontSize: 12.5, margin: "10px 2px 0", color: PRI, fontWeight: 600 }}>当日の出面：{dayAtt.map((x) => nameOf(x.workerId) + " " + x.ninku).join("、")}（自動で紐づきます）</p>
              )}
              <label className="fld" style={{ marginTop: 10 }}><span>作業内容 <em>必須</em></span><textarea rows={4} value={r.work} onChange={(e) => setRepDraft({ ...r, work: e.target.value })} /></label>
              <label className="fld" style={{ marginTop: 10 }}><span>翌日の予定・連絡事項</span><textarea rows={2} value={r.tomorrow} onChange={(e) => setRepDraft({ ...r, tomorrow: e.target.value })} /></label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                {r.photos.map((p, i) => (
                  <div key={i} style={{ position: "relative" }}>
                    <img src={p} alt="" style={{ width: 84, height: 84, objectFit: "cover", borderRadius: 6, border: "1px solid " + BD }} />
                    <button onClick={() => setRepDraft({ ...r, photos: r.photos.filter((_, j) => j !== i) })} style={{ position: "absolute", top: -7, right: -7, width: 22, height: 22, borderRadius: "50%", border: "1px solid " + BD, background: "#fff", color: DANGER, fontSize: 11, cursor: "pointer" }}>✕</button>
                  </div>
                ))}
                {r.photos.length < 6 && (
                  <label style={{ width: 84, height: 84, borderRadius: 6, border: "1px dashed #B6BDC5", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, color: "#A6ADB5", cursor: "pointer", background: "#FAFBFC" }}>
                    ＋<input type="file" accept="image/*" multiple hidden onChange={(e) => addPhotos(e.target.files)} />
                  </label>
                )}
              </div>
            </div>
          </div>
          <button className="btn btn-pri btn-lg" disabled={!r.siteId || !r.work} onClick={async () => {
            await save(K.rep, [{ id: uid(), ...r }, ...reps], setReps);
            setRepDraft({ date: today(), siteId: r.siteId, work: "", tomorrow: "", photos: [] }); flash("日報を保存しました");
          }}>日報を保存</button>

          {siteReps.length > 0 && (
            <div className="panel">
              <div className="panel-h">直近の日報</div>
              <table className="tbl">
                <tbody>
                  {siteReps.map((x) => (
                    <tr key={x.id}>
                      <td className="num" style={{ width: 48, verticalAlign: "top", fontWeight: 700 }}>{fmtD(x.date)}</td>
                      <td style={{ textAlign: "left" }}>
                        <div style={{ fontWeight: 600, fontSize: 12.5 }}>{siteName(x.siteId)}</div>
                        <div style={{ fontSize: 13, whiteSpace: "pre-wrap", marginTop: 2 }}>{x.work}</div>
                        {x.photos.length > 0 && <div style={{ display: "flex", gap: 6, marginTop: 6 }}>{x.photos.map((p, i) => <img key={i} src={p} alt="" style={{ width: 46, height: 46, objectFit: "cover", borderRadius: 4, border: "1px solid " + BD }} />)}</div>}
                      </td>
                      <td style={{ width: 76, textAlign: "right", verticalAlign: "top" }}>
                        {delId === x.id
                          ? <button className="btn btn-danger btn-s" onClick={async () => { await save(K.rep, reps.filter((y) => y.id !== x.id), setReps); setDelId(null); }}>削除する</button>
                          : <button className="btn-link danger" onClick={() => setDelId(x.id)}>削除</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ---------- 現場詳細・収支 ---------- */
  if (view === "site") {
    const s = sites.find((x) => x.id === curSiteId);
    if (!s) { setView("home"); return null; }
    const c = siteCalc(s);
    const put = async (patch) => save(K.sites, sites.map((x) => x.id === s.id ? { ...x, ...patch } : x), setSites);
    const siteExps = exps.filter((x) => x.siteId === s.id);
    const attDays = {};
    att.filter((x) => x.siteId === s.id).forEach((x) => { (attDays[x.date] = attDays[x.date] || []).push(x); });
    const days = Object.keys(attDays).sort().reverse();
    const ratio = c.amount ? Math.min(100, Math.round((c.cost / c.amount) * 100)) : 0;
    return (
      <div className="root"><style>{css}</style><Toast />
        <Bar onBack={() => setView("home")} title="現場詳細" />
        <div className="wrap" style={{ maxWidth: 760 }}>
          <div className="panel">
            <div className="panel-h">基本情報</div>
            <div className="grid2" style={{ padding: "12px 16px 16px" }}>
              <label className="fld"><span>現場名</span><input value={s.name} onChange={(e) => put({ name: e.target.value })} /></label>
              <label className="fld"><span>元請・発注者</span><input value={s.client || ""} onChange={(e) => put({ client: e.target.value })} /></label>
              <label className="fld"><span>住所</span>
                <input value={s.addr || ""} onChange={(e) => put({ addr: e.target.value })} />
                {s.addr && <a className="btn-link" style={{ marginTop: 4, display: "inline-block" }} href={"https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(s.addr)} target="_blank" rel="noreferrer">地図を開く ↗</a>}
              </label>
              <label className="fld"><span>受注金額（税抜）</span><input type="number" inputMode="numeric" value={s.amount || ""} onChange={(e) => put({ amount: e.target.value })} /></label>
            </div>
          </div>

          <div className="panel">
            <div className="panel-h">収支</div>
            <table className="tbl">
              <tbody>
                <tr><td style={{ textAlign: "left" }}>受注金額</td><td className="num" style={{ textAlign: "right" }}>{yen(c.amount)}</td></tr>
                <tr><td style={{ textAlign: "left" }}>労務費（{c.ninku} 人工）</td><td className="num" style={{ textAlign: "right" }}>− {yen(c.labor)}</td></tr>
                <tr><td style={{ textAlign: "left" }}>経費</td><td className="num" style={{ textAlign: "right" }}>− {yen(c.expense)}</td></tr>
                <tr style={{ background: "#F6F8F7" }}>
                  <td style={{ textAlign: "left", fontWeight: 700 }}>粗利</td>
                  <td className="num" style={{ textAlign: "right", fontWeight: 700, fontSize: 15, color: c.profit < 0 ? DANGER : PRI }}>{yen(c.profit)}（{c.amount ? c.rate + "%" : "—"}）</td>
                </tr>
              </tbody>
            </table>
            <div style={{ padding: "10px 16px 14px" }}>
              <div className="costbar" style={{ marginTop: 0 }}><i style={{ width: ratio + "%", background: c.cost > c.amount ? DANGER : ratio > 85 ? WARN : PRI }} /></div>
              <p className="sub" style={{ fontSize: 11.5, margin: "6px 0 0" }}>原価消化率 {c.amount ? ratio + "%" : "—"}（受注金額に対する労務費＋経費の割合）</p>
            </div>
          </div>

          <div className="panel">
            <div className="panel-h">経費</div>
            <div style={{ padding: "12px 16px" }}>
              <div className="grid2">
                <label className="fld"><span>内容</span><input placeholder="例：塗料・シンナー" value={expRow.name} onChange={(e) => setExpRow({ ...expRow, name: e.target.value })} /></label>
                <label className="fld"><span>区分</span><select value={expRow.cat} onChange={(e) => setExpRow({ ...expRow, cat: e.target.value })}>{EXP_CATS.map((x) => <option key={x}>{x}</option>)}</select></label>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, marginTop: 8 }}>
                <label className="fld"><span>金額</span><input type="number" inputMode="numeric" value={expRow.amount} onChange={(e) => setExpRow({ ...expRow, amount: e.target.value })} /></label>
                <button className="btn btn-pri btn-s" style={{ alignSelf: "end", height: 42 }} disabled={!expRow.name || !expRow.amount} onClick={async () => { await save(K.exp, [{ id: uid(), siteId: s.id, date: today(), ...expRow }, ...exps], setExps); setExpRow({ name: "", cat: expRow.cat, amount: "" }); }}>追加</button>
              </div>
            </div>
            {siteExps.length > 0 && (
              <table className="tbl">
                <tbody>
                  {siteExps.map((x) => (
                    <tr key={x.id}>
                      <td style={{ textAlign: "left" }}>{x.name}<span className="sub" style={{ fontSize: 11.5, marginLeft: 6 }}>{x.cat}・{fmtD(x.date)}</span></td>
                      <td className="num" style={{ textAlign: "right", whiteSpace: "nowrap" }}>{yen(x.amount)}</td>
                      <td style={{ width: 76, textAlign: "right" }}>
                        {delId === x.id
                          ? <button className="btn btn-danger btn-s" onClick={async () => { await save(K.exp, exps.filter((y) => y.id !== x.id), setExps); setDelId(null); }}>削除する</button>
                          : <button className="btn-link danger" onClick={() => setDelId(x.id)}>削除</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="panel">
            <div className="panel-h">出面履歴</div>
            {days.length === 0
              ? <div className="empty"><p className="sub" style={{ margin: 0, fontSize: 13 }}>出面の記録がありません。ダッシュボードの「出面を記録」から入力できます。</p></div>
              : <table className="tbl"><tbody>
                  {days.map((d) => (
                    <tr key={d}>
                      <td className="num" style={{ width: 48, fontWeight: 700 }}>{fmtD(d)}</td>
                      <td className="sub" style={{ textAlign: "left" }}>{attDays[d].map((x) => nameOf(x.workerId) + " " + x.ninku).join("、")}</td>
                      <td className="num" style={{ textAlign: "right", whiteSpace: "nowrap" }}>計 {attDays[d].reduce((t, x) => t + x.ninku, 0)} 人工</td>
                    </tr>
                  ))}
                </tbody></table>}
          </div>

          {s.done
            ? <button className="btn btn-line btn-lg" onClick={async () => { await put({ done: "" }); flash("進行中に戻しました"); setView("home"); }}>進行中に戻す</button>
            : <button className="btn btn-pri btn-lg" onClick={async () => { await put({ done: today() }); flash("現場を完了にしました"); setView("home"); }}>この現場を完了にする</button>}
        </div>
      </div>
    );
  }

  /* ---------- 職人管理 ---------- */
  if (view === "crew") {
    return (
      <div className="root"><style>{css}</style><Toast />
        <Bar onBack={() => setView("home")} title="職人管理" />
        <div className="wrap" style={{ maxWidth: 680 }}>
          <div className="panel">
            <div className="panel-h">職人を登録</div>
            <div style={{ padding: "12px 16px 16px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr auto", gap: 8 }}>
                <label className="fld"><span>氏名</span><input value={newWorker.name} onChange={(e) => setNewWorker({ ...newWorker, name: e.target.value })} /></label>
                <label className="fld"><span>日当</span><input type="number" inputMode="numeric" value={newWorker.wage} onChange={(e) => setNewWorker({ ...newWorker, wage: e.target.value })} /></label>
                <button className="btn btn-pri btn-s" style={{ alignSelf: "end", height: 42 }} disabled={!newWorker.name} onClick={async () => { await save(K.crew, [...crew, { id: uid(), ...newWorker }], setCrew); setNewWorker({ name: "", wage: newWorker.wage }); }}>登録</button>
              </div>
              <p className="sub" style={{ fontSize: 11.5, margin: "8px 0 0" }}>日当 × 人工で労務費を自動計算します。応援（外注）の職人も登録できます。</p>
            </div>
          </div>
          {crew.length > 0 && (
            <div className="panel">
              <table className="tbl">
                <thead><tr><th style={{ textAlign: "left" }}>氏名</th><th style={{ textAlign: "right" }}>日当</th><th /></tr></thead>
                <tbody>
                  {crew.map((w) => (
                    <tr key={w.id}>
                      <td style={{ textAlign: "left" }}><input className="cell-in" value={w.name} onChange={(e) => save(K.crew, crew.map((x) => x.id === w.id ? { ...x, name: e.target.value } : x), setCrew)} /></td>
                      <td style={{ textAlign: "right" }}><input className="cell-in num" type="number" inputMode="numeric" style={{ textAlign: "right", width: 110 }} value={w.wage} onChange={(e) => save(K.crew, crew.map((x) => x.id === w.id ? { ...x, wage: e.target.value } : x), setCrew)} /></td>
                      <td style={{ width: 76, textAlign: "right" }}>
                        {delId === w.id
                          ? <button className="btn btn-danger btn-s" onClick={async () => { await save(K.crew, crew.filter((x) => x.id !== w.id), setCrew); setDelId(null); }}>削除する</button>
                          : <button className="btn-link danger" onClick={() => setDelId(w.id)}>削除</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ---------- 出面表（印刷） ---------- */
  if (view === "sheet") {
    const [y, m] = sheetMonth.split("-").map(Number);
    const dim = new Date(y, m, 0).getDate();
    const cell = (wid, d) => {
      const ds = sheetMonth + "-" + String(d).padStart(2, "0");
      return att.filter((x) => x.workerId === wid && x.date === ds && (!sheetSite || x.siteId === sheetSite)).reduce((s, x) => s + x.ninku, 0);
    };
    const rowTotal = (wid) => { let t = 0; for (let d = 1; d <= dim; d++) t += cell(wid, d); return t; };
    return (
      <div className="root"><style>{css}</style><Toast />
        <Bar onBack={() => setView("home")} title="出面表" right={<button className="btn-link" style={{ fontWeight: 700 }} onClick={() => window.print()}>印刷 / PDF</button>} />
        <div className="wrap">
          <div className="no-print grid2" style={{ marginBottom: 12 }}>
            <label className="fld"><span>対象月</span><input type="month" value={sheetMonth} onChange={(e) => setSheetMonth(e.target.value)} /></label>
            <label className="fld"><span>現場</span>
              <select value={sheetSite} onChange={(e) => setSheetSite(e.target.value)}>
                <option value="">全現場</option>
                {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
          </div>
          <p className="sub no-print" style={{ fontSize: 11, margin: "0 0 12px", lineHeight: 1.5 }}>{PRINT_HINT}</p>
          <div className="panel" style={{ padding: 16, overflowX: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
              <b style={{ fontSize: 15 }}>出面表　{y}年{m}月{sheetSite ? "　" + siteName(sheetSite) : ""}</b>
              <span className="sub" style={{ fontSize: 12 }}>{co.name}</span>
            </div>
            <table className="dmn">
              <thead><tr><th style={{ textAlign: "left" }}>氏名</th>{Array.from({ length: dim }, (_, i) => <th key={i}>{i + 1}</th>)}<th>計</th></tr></thead>
              <tbody>
                {crew.map((w) => (
                  <tr key={w.id}>
                    <td style={{ textAlign: "left", whiteSpace: "nowrap", fontWeight: 600 }}>{w.name}</td>
                    {Array.from({ length: dim }, (_, i) => { const v = cell(w.id, i + 1); return <td key={i} className="num">{v ? (v === 1 ? "●" : v) : ""}</td>; })}
                    <td className="num" style={{ fontWeight: 700 }}>{rowTotal(w.id)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="sub" style={{ fontSize: 11, margin: "10px 0 0" }}>● = 1.0 人工　数字 = 人工数</p>
          </div>
        </div>
      </div>
    );
  }

  /* ---------- 完了した現場 ---------- */
  if (view === "done") {
    const doneList = sites.filter((s) => s.done);
    return (
      <div className="root"><style>{css}</style><Toast />
        <Bar onBack={() => setView("home")} title="完了した現場" />
        <div className="wrap" style={{ maxWidth: 760 }}>
          <div className="panel">
            {doneList.length === 0
              ? <div className="empty"><p className="sub" style={{ margin: 0, fontSize: 13 }}>完了した現場はありません。</p></div>
              : <table className="tbl site-tbl">
                  <thead className="pc-only"><tr><th style={{ textAlign: "left" }}>現場</th><th>期間</th><th>人工</th><th>粗利</th><th>操作</th></tr></thead>
                  <tbody>
                    {doneList.map((s) => {
                      const c = siteCalc(s);
                      return (
                        <tr key={s.id}>
                          <td data-l="現場" style={{ textAlign: "left", fontWeight: 600 }}>{s.name}<div className="sub" style={{ fontSize: 12, fontWeight: 400 }}>{s.client || "—"}</div></td>
                          <td data-l="期間" className="num">{fmtD(s.start)}〜{fmtD(s.done)}</td>
                          <td data-l="人工" className="num">{c.ninku}</td>
                          <td data-l="粗利" className="num" style={{ fontWeight: 700, color: c.profit < 0 ? DANGER : PRI }}>{yen(c.profit)}</td>
                          <td data-l="操作"><span className="ops">
                            <button className="btn-link" onClick={() => { setCurSiteId(s.id); setView("site"); }}>詳細</button>
                            <button className="btn-link" onClick={async () => { await save(K.sites, sites.map((x) => x.id === s.id ? { ...x, done: "" } : x), setSites); flash("進行中に戻しました"); }}>戻す</button>
                          </span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>}
          </div>
        </div>
      </div>
    );
  }

  /* ---------- 会社情報・データ ---------- */
  if (view === "settings") {
    return (
      <div className="root"><style>{css}</style><Toast />
        <Bar onBack={() => setView("home")} title="会社情報・データ" />
        <div className="wrap" style={{ maxWidth: 680 }}>
          <div className="panel">
            <div className="panel-h">会社情報</div>
            <div style={{ padding: "12px 16px 16px" }}>
              <label className="fld"><span>会社名（出面表に印字されます）</span><input value={co.name} onChange={(e) => save(K.co, { ...co, name: e.target.value }, setCo)} /></label>
            </div>
          </div>
          <div className="panel">
            <div className="panel-h">データの引き継ぎ</div>
            <div style={{ padding: "12px 16px 16px" }}>
              <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <button className="btn btn-line btn-s" onClick={async () => {
                  const data = JSON.stringify({ sites, crew, att, exps, reps, co });
                  setIoText(data);
                  try { await navigator.clipboard.writeText(data); flash("書き出してコピーしました"); } catch { flash("下の欄からコピーしてください"); }
                }}>書き出してコピー</button>
                <button className="btn btn-pri btn-s" onClick={async () => {
                  try {
                    const d = JSON.parse(ioText);
                    await save(K.sites, d.sites || [], setSites); await save(K.crew, d.crew || [], setCrew);
                    await save(K.att, d.att || [], setAtt); await save(K.exp, d.exps || [], setExps);
                    await save(K.rep, d.reps || [], setReps); await save(K.co, d.co || { name: "" }, setCo);
                    flash("取り込みました");
                  } catch { flash("形式が正しくありません"); }
                }}>取り込む</button>
              </div>
              <textarea rows={4} placeholder="ここに貼り付けて「取り込む」を押してください" value={ioText} onChange={(e) => setIoText(e.target.value)} style={{ fontSize: 12 }} />
              <p className="sub" style={{ fontSize: 11.5, margin: "8px 0 0" }}>現場・職人・出面・経費・日報のすべてが含まれます。機種変更や別端末への引き継ぎに使用できます。</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

const css = `
  * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
  body { margin: 0; }
  html { -webkit-text-size-adjust: 100%; text-size-adjust: 100%; }
  img { max-width: 100%; }
  textarea { resize: vertical; }
  input[type=number]::-webkit-outer-spin-button, input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
  input[type=number] { -moz-appearance: textfield; appearance: textfield; }
  button { touch-action: manipulation; }
  .root { font-family: -apple-system, BlinkMacSystemFont, "Hiragino Sans", "Noto Sans JP", "Yu Gothic UI", sans-serif; background: #F4F5F7; min-height: 100vh; color: ${INK}; -webkit-font-smoothing: antialiased; font-size: 14px; }
  @media screen {
    .root { overflow-x: hidden; max-width: 100vw; }
  }
  .num { font-variant-numeric: tabular-nums; letter-spacing: 0; }
  .wrap { max-width: 960px; margin: 0 auto; padding: 18px 16px 56px; }
  .page-head { display: flex; justify-content: space-between; align-items: baseline; margin: 6px 2px 14px; flex-wrap: wrap; gap: 4px; }
  .page-head h1 { font-size: 21px; font-weight: 700; margin: 0; letter-spacing: -.01em; }
  .date-line { font-size: 12.5px; color: ${SUB}; }

  input, select, textarea { font-family: inherit; font-size: 16px; border: 1px solid #C9CFD6; border-radius: 8px; padding: 10px 12px; background: #fff; color: ${INK}; width: 100%; appearance: none; }
  input:focus, select:focus, textarea:focus { outline: none; border-color: ${PRI}; box-shadow: 0 0 0 3px ${PRI}22; }
  input::placeholder, textarea::placeholder { color: #A6ADB5; }
  .fld { display: block; }
  .fld > span { display: block; font-size: 11.5px; font-weight: 600; color: ${SUB}; letter-spacing: .04em; margin: 0 1px 4px; }
  .fld > span em { font-style: normal; color: ${DANGER}; font-size: 10.5px; margin-left: 4px; }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 12px; }
  @media (max-width: 560px) { .grid2 { grid-template-columns: 1fr; } }

  .btn { border: 1px solid transparent; border-radius: 8px; padding: 11px 18px; font-size: 14px; font-weight: 600; cursor: pointer; font-family: inherit; transition: opacity .12s, transform .15s, box-shadow .15s; touch-action: manipulation; letter-spacing: .01em; }
  .btn:active { opacity: .75; }
  .btn:disabled { opacity: .45; cursor: default; }
  .btn-pri { background: ${PRI}; color: #fff; }
  .btn-line { background: #fff; color: ${INK}; border-color: #C9CFD6; }
  .btn-danger { background: ${DANGER}; color: #fff; }
  .btn-s { padding: 7px 14px; font-size: 12.5px; }
  .btn-lg { width: 100%; padding: 14px; font-size: 15px; margin: 4px 0 20px; }
  .btn-link { border: none; background: none; color: ${PRI}; font-family: inherit; font-size: 13.5px; font-weight: 600; cursor: pointer; padding: 6px 8px; text-decoration: none; }
  .btn-link.danger { color: ${DANGER}; }
  .act-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 0 0 14px; }
  .act-row .btn { padding: 14px; font-size: 15px; }

  .panel { background: #fff; border: 1px solid ${BD}; border-radius: 10px; margin-bottom: 14px; overflow: hidden; }
  .panel-h { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 700; letter-spacing: .03em; padding: 12px 16px; border-bottom: 1px solid ${BD}; background: #FAFBFC; }
  .panel-h .count { font-size: 11.5px; font-weight: 600; color: ${SUB}; background: #EEF1F4; border-radius: 4px; padding: 2px 7px; }
  .form-block { padding: 14px 16px; border-bottom: 1px solid ${BD}; background: #FAFBFC; }
  .empty { padding: 26px 16px; text-align: center; }
  .sub { color: ${SUB}; }

  .kpis { display: grid; grid-template-columns: repeat(3, 1fr); background: #fff; border: 1px solid ${BD}; border-radius: 10px; overflow: hidden; margin-bottom: 14px; }
  .kpi { padding: 14px 16px 12px; border-left: 1px solid ${BD}; min-width: 0; }
  .kpi:first-child { border-left: none; }
  .kpi-l { font-size: 11px; font-weight: 600; color: ${SUB}; letter-spacing: .05em; }
  .kpi-v { font-size: 19px; font-weight: 700; margin-top: 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .kpi-u { font-size: 11.5px; font-weight: 600; color: ${SUB}; margin-left: 3px; }
  @media (max-width: 560px) { .kpi-v { font-size: 16px; } .kpi { padding: 11px 10px 10px; } }

  .tbl { border-collapse: collapse; width: 100%; font-size: 13.5px; }
  .tbl th { font-size: 11.5px; font-weight: 600; color: ${SUB}; letter-spacing: .04em; padding: 9px 16px; border-bottom: 1px solid ${BD}; text-align: right; background: #FAFBFC; }
  .tbl td { padding: 11px 16px; border-bottom: 1px solid #ECEFF2; text-align: right; vertical-align: middle; }
  .tbl tr:last-child td { border-bottom: none; }
  .tbl td:first-child, .tbl th:first-child { text-align: left; }
  .row-on { background: #F1F8F3; }
  .cell-in { border: none; background: none; padding: 4px 0; border-radius: 0; font-size: 13.5px; }
  .cell-in:focus { box-shadow: none; border-bottom: 1px solid ${PRI}; }
  .ops { display: flex; justify-content: flex-end; gap: 2px; flex-wrap: wrap; }
  .costbar { height: 5px; border-radius: 3px; background: #ECEFF2; overflow: hidden; margin-top: 7px; max-width: 260px; }
  .costbar i { display: block; height: 100%; transition: width .3s; }

  @media (max-width: 640px) {
    .pc-only { display: none; }
    .site-tbl, .site-tbl tbody, .site-tbl tr, .site-tbl td { display: block; width: 100%; }
    .site-tbl tr { border-bottom: 1px solid ${BD}; padding: 6px 0; }
    .site-tbl tr:last-child { border-bottom: none; }
    .site-tbl td { border: none; padding: 5px 16px; text-align: left; display: flex; justify-content: space-between; align-items: baseline; gap: 10px; }
    .site-tbl td::before { content: attr(data-l); font-size: 11px; font-weight: 600; color: ${SUB}; letter-spacing: .04em; flex-shrink: 0; }
    .site-tbl td[data-l="現場"] { display: block; }
    .site-tbl td[data-l="現場"]::before { content: none; }
    .site-tbl .ops { justify-content: flex-start; margin-left: -8px; }
  }

  .appbar { position: sticky; top: 0; z-index: 40; background: #fff; border-bottom: 1px solid ${BD}; }
  .appbar-in { max-width: none; margin: 0; padding: 8px 18px; display: flex; justify-content: space-between; align-items: center; min-height: 52px; }
  .bar-title { font-size: 14.5px; font-weight: 700; }
  .brand { display: flex; align-items: center; gap: 8px; font-size: 15.5px; font-weight: 700; letter-spacing: -.01em; color: ${INK}; }
  .brand b { color: ${PRI}; font-weight: 700; }
  .co-name { font-size: 12px; color: ${SUB}; font-weight: 600; max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .hbg { width: 44px; height: 44px; border: none; background: none; cursor: pointer; display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 5px; padding: 0; touch-action: manipulation; }
  .hbg span { display: block; width: 21px; height: 2px; border-radius: 2px; background: ${INK}; }

  .menu-ovl { position: fixed; inset: 0; z-index: 120; background: rgba(15,23,32,.4); animation: fdin .18s ease; }
  @keyframes fdin { from { opacity: 0; } to { opacity: 1; } }
  .menu-panel { position: absolute; top: 0; right: 0; bottom: 0; width: min(78vw, 300px); background: #fff; border-left: 1px solid ${BD}; padding: 6px 14px calc(20px + env(safe-area-inset-bottom)); display: flex; flex-direction: column; animation: slin .22s cubic-bezier(.32,.72,.35,1); }
  @keyframes slin { from { transform: translateX(100%); } to { transform: translateX(0); } }
  .menu-head { display: flex; justify-content: space-between; align-items: center; min-height: 52px; margin-bottom: 4px; border-bottom: 1px solid ${BD}; padding-bottom: 6px; }
  .menu-x { width: 34px; height: 34px; border: 1px solid ${BD}; border-radius: 8px; background: #fff; color: ${SUB}; font-size: 13px; cursor: pointer; touch-action: manipulation; }
  .menu-item { display: flex; align-items: center; gap: 12px; width: 100%; border: none; background: none; font-family: inherit; font-size: 15px; font-weight: 600; color: ${INK}; padding: 15px 4px; border-bottom: 1px solid #ECEFF2; cursor: pointer; text-align: left; touch-action: manipulation; }
  .menu-item:active { background: #F4F5F7; }
  .mi-ic { width: 20px; height: 20px; color: ${SUB}; flex-shrink: 0; }
  .mi-arrow { margin-left: auto; color: #B6BDC5; font-size: 19px; font-weight: 400; }
  .menu-co { margin-top: auto; font-size: 12px; color: ${SUB}; padding: 12px 4px 0; border-top: 1px solid #ECEFF2; }

  .toastx { position: fixed; top: 14px; left: 50%; transform: translateX(-50%); background: ${INK}; color: #fff; padding: 10px 18px; border-radius: 8px; font-size: 13px; font-weight: 600; z-index: 200; white-space: nowrap; box-shadow: 0 4px 14px rgba(0,0,0,.18); }

  .dmn { border-collapse: collapse; width: 100%; font-size: 11.5px; }
  .dmn th, .dmn td { border: 1px solid #C9CFD6; padding: 4px 3px; text-align: center; min-width: 20px; }
  .dmn th { background: #F4F5F7; font-weight: 600; }

  @media (hover: hover) and (pointer: fine) {
    .btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 3px 10px rgba(0,0,0,.15); }
    .btn-link:hover { text-decoration: underline; }
    .menu-item:hover { background: #F4F5F7; }
    .tbl tbody tr:hover td { background: #FAFBFC; }
    .hbg:hover span { background: #1B7F3B; }
  }

  @media (min-width: 1000px) {
    .wrap { max-width: none; padding: 22px 32px 60px; }
    .home-grid { display: grid; grid-template-columns: minmax(340px, 420px) minmax(0, 1fr); gap: 32px; align-items: start; }
    .kpi-v { font-size: 22px; }
    .home-side { position: sticky; top: 72px; }
    .home-side .kpis { grid-template-columns: 1fr; margin-bottom: 12px; }
    .home-side .kpi { border-left: none; border-top: 1px solid ${BD}; padding: 12px 16px 11px; }
    .home-side .kpi:first-child { border-top: none; }
    .home-side .act-row { margin-bottom: 12px; }
  }

  @media print {
    html, body, #root, .root { overflow: visible !important; max-width: none !important; min-height: auto !important; background: #fff !important; }
    .no-print, .appbar, .menu-ovl, .toastx { display: none !important; }
    .wrap { padding: 0 !important; max-width: none !important; margin: 0 !important; }
    .panel { box-shadow: none !important; border: none !important; border-radius: 0 !important; overflow: visible !important; padding: ${PRINT_SHEET_PADDING} !important; margin: 0 !important; }
    .dmn { font-size: 9.5px; width: 100%; table-layout: fixed; }
    .dmn th, .dmn td { padding: 2px 1px; word-break: break-all; }
    .dmn th:first-child, .dmn td:first-child { width: 72px; word-break: normal; }
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    ${printPageBase}
    @page { size: A4 landscape; }
  }
`;
