// Admin panel for פודל משפחתי.
// Live mode (config.js filled): Supabase email+password login, texts and gallery
// saved to table "content" (rows "site", "gallery"), photos to bucket "images".
// Demo mode (config.js empty): any login works, changes stay in this browser and
// show on the site at ?preview.
const BASE = document.querySelector('meta[name="site-base"]')?.content ?? "../";
const DRAFT_KEY = "poodle-cms-draft";
const cfg = window.CMS_CONFIG || {};
const LIVE = !!(cfg.supabaseUrl && cfg.supabaseAnonKey);
const sb = LIVE ? supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey) : null;

const CATEGORIES = { puppies: "גורים", family: "המשפחה", home: "החיים בבית", special: "רגעים מיוחדים" };

// Every text and image on the page, grouped the way they appear on the site.
const GROUPS = [
  { title: "ראש העמוד", anchor: "", fields: [
    { key: "hero_title", label: "כותרת ראשית" },
    { key: "hero_subtitle", label: "משפט מתחת לכותרת", type: "area" },
    { key: "hero_button", label: "טקסט הכפתור" },
    { key: "hero_note", label: "הכיתוב בכתב יד ליד התמונה", type: "area", hint: "שורה חדשה = ירידת שורה באתר" },
    { key: "hero_image", label: "התמונה הגדולה", type: "image" },
    { key: "hero_bubble_image", label: "התמונה העגולה הקטנה", type: "image" },
  ] },
  { title: "גלריה", anchor: "#gallery", fields: [
    { key: "gallery_title", label: "כותרת" },
    { key: "gallery_subtitle", label: "משפט מתחת לכותרת", type: "area" },
  ] },
  { title: "קצת עלינו", anchor: "#about", fields: [
    { key: "about_title", label: "כותרת" },
    { key: "about_text", label: "הטקסט", type: "paras", hint: "שורה ריקה בין פסקאות" },
    { key: "about_note", label: "הכיתוב בכתב יד ליד התמונה" },
    { key: "about_image", label: "התמונה", type: "image" },
  ] },
  { title: "למה אצלנו", anchor: "#why", fields: [
    { key: "why_title", label: "כותרת" },
    { type: "why" },
  ] },
  { title: "בואו להכיר", anchor: "#contact", fields: [
    { key: "contact_title", label: "כותרת" },
    { key: "contact_text", label: "הטקסט", type: "area" },
    { key: "contact_note", label: "השורה בכתב יד" },
  ] },
  { title: "פרטי קשר", anchor: "#contact", fields: [
    { key: "phone", label: "טלפון להצגה ולחיוג", ltr: true },
    { key: "whatsapp", label: "מספר וואטסאפ", ltr: true, hint: "בפורמט בינלאומי בלי + ובלי 0, למשל 972509459570" },
    { key: "facebook", label: "קישור לפייסבוק", ltr: true },
    { key: "instagram", label: "קישור לאינסטגרם", ltr: true, hint: "ריק = האייקון לא יופיע" },
  ] },
  { title: "תחתית העמוד", anchor: "", fields: [
    { key: "footer_text", label: "המשפט בתחתית" },
  ] },
];

let saved = { site: {}, gallery: [] };
let state = { site: {}, gallery: [] };

const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const clone = (o) => JSON.parse(JSON.stringify(o));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
// Repo photos and uploads both have a "-sm.webp" twin for thumbnails.
const small = (src) => /\.webp$/.test(src || "") ? src.replace(/\.webp$/, "-sm.webp") : src;
const url = (src) => !src || /^(https?:|data:|blob:)/.test(src) ? src : BASE + src;

function toast(msg, bad = false) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.toggle("bad", bad);
  t.classList.add("show");
  clearTimeout(toast.t);
  toast.t = setTimeout(() => t.classList.remove("show"), bad ? 6000 : 2600);
}
function busy(msg) {
  const el = document.createElement("div");
  el.className = "busy";
  el.textContent = msg;
  document.body.append(el);
  return () => el.remove();
}

/* ---------- data ---------- */
async function loadJson(path) {
  const r = await fetch(BASE + path, { cache: "no-cache" });
  if (!r.ok) throw new Error(path);
  return r.json();
}
async function loadAll() {
  const [site, gallery] = await Promise.all([loadJson("data/site.json"), loadJson("data/gallery.json")]);
  let stored = {};
  if (LIVE) {
    const { data, error } = await sb.from("content").select("id,data");
    if (error) throw error;
    stored = Object.fromEntries(data.map((r) => [r.id, r.data]));
  } else {
    try { stored = JSON.parse(localStorage.getItem(DRAFT_KEY)) || {}; } catch {}
  }
  saved = { site: { ...site, ...stored.site }, gallery: stored.gallery || gallery };
  state = clone(saved);
}
async function saveAll() {
  if (LIVE) {
    const { error } = await sb.from("content").upsert([
      { id: "site", data: state.site },
      { id: "gallery", data: state.gallery },
    ]);
    if (error) throw error;
  } else {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(state));
  }
  saved = clone(state);
}

// Shrink to webp in two sizes, like the photos already in the repo.
function toWebp(file, max) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * k);
      c.height = Math.round(img.height * k);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      c.toBlob((b) => (b ? resolve(b) : reject(new Error("webp"))), "image/webp", 0.82);
    };
    img.onerror = () => reject(new Error("התמונה לא נפתחה"));
    img.src = URL.createObjectURL(file);
  });
}
const asDataUrl = (blob) => new Promise((r) => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(blob); });

async function uploadPhoto(file) {
  if (!LIVE) return asDataUrl(await toWebp(file, 900)); // demo: kept small to fit in browser storage
  const [big, sm] = await Promise.all([toWebp(file, 1600), toWebp(file, 560)]);
  const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const opts = { contentType: "image/webp", cacheControl: "31536000" };
  const a = await sb.storage.from("images").upload(`${name}.webp`, big, opts);
  if (a.error) throw a.error;
  const b = await sb.storage.from("images").upload(`${name}-sm.webp`, sm, opts);
  if (b.error) throw b.error;
  return sb.storage.from("images").getPublicUrl(`${name}.webp`).data.publicUrl;
}

/* ---------- dirty state ---------- */
function refreshDirty() {
  const dirty = !same(state, saved);
  $("#save").disabled = !dirty;
  $("#discard").disabled = !dirty;
  const st = $("#saveState");
  st.textContent = dirty ? "יש שינויים שלא נשמרו" : "הכול שמור";
  st.classList.toggle("dirty", dirty);
  document.querySelectorAll(".field[data-key]").forEach((f) => {
    const k = f.dataset.key;
    f.classList.toggle("changed", !same(state.site[k], saved.site[k]) || (f.dataset.alt && !same(state.site[k + "_alt"], saved.site[k + "_alt"])));
  });
}
addEventListener("beforeunload", (e) => { if (!same(state, saved)) { e.preventDefault(); e.returnValue = ""; } });

/* ---------- texts tab ---------- */
function fieldHtml(f) {
  const v = state.site[f.key];
  const hint = f.hint ? `<span class="hint">${esc(f.hint)}</span>` : "";
  const dir = f.ltr ? ' dir="ltr"' : "";
  if (f.type === "image") {
    return `<div class="field image-field" data-key="${f.key}" data-alt="1">
      <div class="thumb"><img src="${esc(url(small(v)))}" alt=""></div>
      <div class="side">
        <span class="label">${esc(f.label)}</span>
        <label class="btn ghost small file-btn" style="justify-self:start">החלפת תמונה<input type="file" accept="image/*" data-image="${f.key}" hidden></label>
        <label>תיאור התמונה <span class="hint">לנגישות ולגוגל, משפט קצר על מה רואים</span>
          <input type="text" data-key="${f.key}_alt" value="${esc(state.site[f.key + "_alt"])}"></label>
      </div>
    </div>`;
  }
  if (f.type === "paras") {
    return `<div class="field" data-key="${f.key}"><label>${esc(f.label)} ${hint}
      <textarea data-key="${f.key}" data-paras rows="9">${esc((v || []).join("\n\n"))}</textarea></label></div>`;
  }
  if (f.type === "area") {
    return `<div class="field" data-key="${f.key}"><label>${esc(f.label)} ${hint}
      <textarea data-key="${f.key}" rows="2">${esc(v)}</textarea></label></div>`;
  }
  return `<div class="field" data-key="${f.key}"><label>${esc(f.label)} ${hint}
    <input type="text" data-key="${f.key}" value="${esc(v)}"${dir}></label></div>`;
}
function whyHtml() {
  return `<div class="row2">${[1, 2, 3, 4].map((n) => `<div class="why-pair">
    <b>יתרון ${n}</b>
    ${fieldHtml({ key: `why${n}_title`, label: "כותרת" })}
    ${fieldHtml({ key: `why${n}_text`, label: "הסבר", type: "area" })}
  </div>`).join("")}</div>`;
}
function renderTexts() {
  $("#tab-texts").innerHTML = GROUPS.map((g) => `<div class="group">
    <h2>${esc(g.title)}${g.anchor !== undefined ? `<a href="${esc(siteUrl() + g.anchor)}" target="_blank" rel="noopener">איפה זה באתר ↗</a>` : ""}</h2>
    ${g.fields.map((f) => (f.type === "why" ? whyHtml() : fieldHtml(f))).join("")}
  </div>`).join("");
  refreshDirty();
}
$("#tab-texts").addEventListener("input", (e) => {
  const k = e.target.dataset.key;
  if (!k) return;
  state.site[k] = "paras" in e.target.dataset
    ? e.target.value.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
    : e.target.value;
  refreshDirty();
});
$("#tab-texts").addEventListener("change", async (e) => {
  const k = e.target.dataset.image;
  if (!k || !e.target.files[0]) return;
  const done = busy("מעלה תמונה…");
  try {
    state.site[k] = await uploadPhoto(e.target.files[0]);
    renderTexts();
    toast("התמונה הוחלפה. לחצו שמירה כדי לפרסם");
  } catch (err) {
    console.error(err);
    toast("העלאת התמונה נכשלה: " + (err.message || err), true);
  } finally { done(); }
});

/* ---------- gallery tab ---------- */
function renderGallery() {
  const list = $("#galleryList");
  if (!state.gallery.length) {
    list.innerHTML = `<p class="empty">אין עדיין תמונות בגלריה. לחצו "הוספת תמונות" כדי להתחיל.</p>`;
    refreshDirty();
    return;
  }
  list.innerHTML = state.gallery.map((g, i) => `<article class="gcard" draggable="true" data-i="${i}">
    <div class="pic"><img src="${esc(url(small(g.image)))}" alt="${esc(g.caption)}" loading="lazy"><span class="num">${i + 1}</span></div>
    <div class="body">
      <label>כיתוב<input type="text" data-f="caption" value="${esc(g.caption)}"></label>
      <label>קטגוריה<select data-f="category">${Object.entries(CATEGORIES).map(([v, t]) => `<option value="${v}"${g.category === v ? " selected" : ""}>${t}</option>`).join("")}</select></label>
      <div class="tools">
        <label class="btn ghost file-btn">החלפה<input type="file" accept="image/*" data-replace hidden></label>
        <button class="btn ghost danger" data-act="del">מחיקה</button>
        <span class="move">
          <button class="btn ghost" data-act="up" aria-label="הזזה קדימה"${i ? "" : " disabled"}>→</button>
          <button class="btn ghost" data-act="down" aria-label="הזזה אחורה"${i < state.gallery.length - 1 ? "" : " disabled"}>←</button>
        </span>
      </div>
    </div>
  </article>`).join("");
  refreshDirty();
}
const cardIndex = (el) => +el.closest(".gcard").dataset.i;
function move(from, to) {
  if (to < 0 || to >= state.gallery.length || from === to) return;
  const [g] = state.gallery.splice(from, 1);
  state.gallery.splice(to, 0, g);
  renderGallery();
}
$("#galleryList").addEventListener("input", (e) => {
  const f = e.target.dataset.f;
  if (!f) return;
  state.gallery[cardIndex(e.target)][f] = e.target.value;
  refreshDirty();
});
$("#galleryList").addEventListener("click", (e) => {
  const b = e.target.closest("[data-act]");
  if (!b) return;
  const i = cardIndex(b);
  if (b.dataset.act === "up") move(i, i - 1);
  if (b.dataset.act === "down") move(i, i + 1);
  if (b.dataset.act === "del" && confirm("למחוק את התמונה מהגלריה?")) {
    state.gallery.splice(i, 1);
    renderGallery();
  }
});
$("#galleryList").addEventListener("change", async (e) => {
  if (!("replace" in e.target.dataset) || !e.target.files[0]) return;
  const i = cardIndex(e.target);
  const done = busy("מעלה תמונה…");
  try {
    state.gallery[i].image = await uploadPhoto(e.target.files[0]);
    renderGallery();
  } catch (err) {
    console.error(err);
    toast("העלאת התמונה נכשלה: " + (err.message || err), true);
  } finally { done(); }
});
$("#addPhotos").addEventListener("change", async (e) => {
  const files = [...e.target.files];
  if (!files.length) return;
  const done = busy(`מעלה ${files.length > 1 ? files.length + " תמונות" : "תמונה"}…`);
  let ok = 0;
  for (const file of files) {
    try {
      state.gallery.unshift({ image: await uploadPhoto(file), caption: "", category: "puppies" });
      ok++;
    } catch (err) {
      console.error(err);
      toast(`העלאת ${file.name} נכשלה`, true);
    }
  }
  done();
  e.target.value = "";
  renderGallery();
  if (ok) toast(ok > 1 ? `${ok} תמונות נוספו בראש הגלריה. כדאי להוסיף כיתוב` : "התמונה נוספה בראש הגלריה. כדאי להוסיף כיתוב");
});
// drag to reorder (desktop); the arrow buttons cover touch screens
let dragFrom = null;
$("#galleryList").addEventListener("dragstart", (e) => {
  const c = e.target.closest(".gcard");
  if (!c) return;
  dragFrom = +c.dataset.i;
  c.classList.add("dragging");
  e.dataTransfer.effectAllowed = "move";
});
$("#galleryList").addEventListener("dragover", (e) => {
  const c = e.target.closest(".gcard");
  if (dragFrom === null || !c) return;
  e.preventDefault();
  document.querySelectorAll(".gcard.over").forEach((x) => x !== c && x.classList.remove("over"));
  c.classList.add("over");
});
$("#galleryList").addEventListener("drop", (e) => {
  const c = e.target.closest(".gcard");
  if (dragFrom === null || !c) return;
  e.preventDefault();
  const from = dragFrom;
  dragFrom = null;
  move(from, +c.dataset.i);
});
$("#galleryList").addEventListener("dragend", () => {
  dragFrom = null;
  document.querySelectorAll(".gcard").forEach((x) => x.classList.remove("dragging", "over"));
});

/* ---------- shell ---------- */
const siteUrl = () => BASE + (LIVE ? "" : "?preview");
document.querySelectorAll(".tabs button").forEach((b) => b.addEventListener("click", () => {
  document.querySelectorAll(".tabs button").forEach((x) => x.setAttribute("aria-selected", x === b));
  document.querySelectorAll(".tab-panel").forEach((p) => (p.hidden = p.id !== "tab-" + b.dataset.tab));
}));
$("#save").addEventListener("click", async () => {
  const done = busy("שומר…");
  try {
    await saveAll();
    refreshDirty();
    toast(LIVE ? "נשמר! השינויים כבר באתר" : "נשמר בהדגמה. אפשר לראות ב״צפייה באתר״");
  } catch (err) {
    console.error(err);
    const quota = err && err.name === "QuotaExceededError";
    toast(quota ? "אין מספיק מקום בדפדפן להדגמה. נסו פחות תמונות" : "השמירה נכשלה: " + (err.message || err), true);
  } finally { done(); }
});
$("#discard").addEventListener("click", () => {
  if (!confirm("לבטל את כל השינויים שלא נשמרו?")) return;
  state = clone(saved);
  renderTexts();
  renderGallery();
});

async function showApp() {
  const done = busy("טוען…");
  try {
    await loadAll();
  } catch (err) {
    console.error(err);
    toast("לא הצלחנו לטעון את התוכן: " + (err.message || err), true);
  } finally { done(); }
  $("#loginView").hidden = true;
  $("#appView").hidden = false;
  $("#viewSite").href = siteUrl();
  renderTexts();
  renderGallery();
}
function showLogin() {
  $("#appView").hidden = true;
  $("#loginView").hidden = false;
}
$("#loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  $("#loginError").textContent = "";
  if (LIVE) {
    const { error } = await sb.auth.signInWithPassword({ email: fd.get("email").trim(), password: fd.get("password") });
    if (error) {
      $("#loginError").textContent = /invalid/i.test(error.message) ? "אימייל או סיסמה לא נכונים" : error.message;
      return;
    }
  } else {
    sessionStorage.setItem("poodle-demo-login", "1");
  }
  showApp();
});
$("#logout").addEventListener("click", async () => {
  if (!same(state, saved) && !confirm("יש שינויים שלא נשמרו. לצאת בכל זאת?")) return;
  state = clone(saved);
  if (LIVE) await sb.auth.signOut();
  else sessionStorage.removeItem("poodle-demo-login");
  showLogin();
});

(async () => {
  $("#demoBar").hidden = LIVE;
  $("#loginHint").hidden = LIVE;
  let in_ = false;
  if (LIVE) in_ = !!(await sb.auth.getSession()).data.session;
  else in_ = sessionStorage.getItem("poodle-demo-login") === "1";
  in_ ? showApp() : showLogin();
})();
