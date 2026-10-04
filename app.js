// פודל משפחתי: all puppies, gallery photos and texts come from data/*.json
// (the same fields the admin panel will manage later), never from this file.
document.documentElement.classList.add("js");

const GENDER = { male: "זכר", female: "נקבה" };
const BREED = { toy: "פודל טוי", mini: "פודל ננסי" };
const STATUS = {
  available: { label: "זמין", cls: "available" },
  pending: { label: "בתהליך אימוץ", cls: "pending" },
  reserved: { label: "שמור", cls: "reserved" },
  home: { label: "נמצא בבית חדש", cls: "home" },
};

let site = {};
let puppies = [];
let gallery = [];

const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const small = (src) => src.replace(/\.webp$/, "-sm.webp");

function ageText(birth) {
  const b = new Date(birth + "T00:00:00");
  const days = Math.floor((Date.now() - b) / 86400000);
  if (days < 0) return "";
  const weeks = Math.floor(days / 7);
  if (weeks < 14) return weeks === 1 ? "שבוע" : weeks === 2 ? "שבועיים" : `${weeks} שבועות`;
  const months = Math.floor(days / 30.44);
  return months === 2 ? "חודשיים" : `${months} חודשים`;
}
const ageLabel = (p) => `${p.gender === "female" ? "בת" : "בן"} ${ageText(p.birth_date)}`;
const dateHe = (d) => new Date(d + "T00:00:00").toLocaleDateString("he-IL", { day: "numeric", month: "long", year: "numeric" });

function waLink(text) {
  return `https://wa.me/${site.whatsapp}?text=${encodeURIComponent(text)}`;
}
const telLink = () => `tel:${(site.phone || "").replace(/[^\d+]/g, "")}`;

/* ---------- content ---------- */
function applyContent() {
  document.querySelectorAll("[data-content]").forEach((el) => {
    const v = site[el.dataset.content];
    if (typeof v !== "string" || !v) return;
    if (el.dataset.content === "hero_title") {
      const [a, b] = v.split(/\s[–-]\s/);
      el.innerHTML = b ? `${esc(a)}&nbsp;–<br><em>${esc(b)}</em>` : esc(v);
    }
    else el.textContent = v;
  });
  $("#aboutText").innerHTML = (site.about_text || []).map((t, i) => `<p${i ? "" : ' class="first"'}>${esc(t)}</p>`).join("");
  const general = "היי, הגעתי מהאתר של פודל משפחתי ואשמח לשמוע על הגורים.";
  document.querySelectorAll("[data-wa]").forEach((a) => { a.href = waLink(general); a.target = "_blank"; a.rel = "noopener"; });
  document.querySelectorAll("[data-tel]").forEach((a) => (a.href = telLink()));
  const ig = $("[data-ig]");
  if (site.instagram) { ig.href = site.instagram; ig.hidden = false; ig.target = "_blank"; ig.rel = "noopener"; }
  $("#year").textContent = new Date().getFullYear();
}

/* ---------- puppies ---------- */
function renderPuppies() {
  const list = puppies.filter((p) => p.is_visible);
  const grid = $("#puppyGrid");
  if (!list.length) {
    grid.innerHTML = `<p class="empty">כרגע אין גורים זמינים. כתבו לנו ונעדכן כשתהיה המלטה חדשה.</p>`;
    return;
  }
  grid.innerHTML = list.map((p) => {
    const st = STATUS[p.status] || STATUS.available;
    return `<article class="card reveal" data-id="${p.id}" tabindex="0" role="button" aria-label="פרטים על ${esc(p.name)}">
      <div class="card-photo">
        <img src="${esc(small(p.main_image))}" alt="${esc(p.alt || p.name)}" loading="lazy" width="560" height="560">
        <span class="status ${st.cls}">${st.label}</span>
      </div>
      <div class="card-body">
        <div class="card-title"><h3>${esc(p.name)}</h3><span class="age">${ageLabel(p)}</span></div>
        <div class="chips"><span>${BREED[p.breed] || ""}</span><span>${GENDER[p.gender] || ""}</span><span>${esc(p.color)}</span></div>
        <span class="more">לכל הפרטים <svg><use href="#i-arrow"/></svg></span>
      </div>
    </article>`;
  }).join("");
  grid.querySelectorAll(".card").forEach((c) => {
    const open = () => openPuppy(+c.dataset.id);
    c.addEventListener("click", open);
    c.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } });
  });
}

function openPuppy(id, push = true) {
  const p = puppies.find((x) => x.id === id);
  if (!p) return;
  const st = STATUS[p.status] || STATUS.available;
  const imgs = p.images?.length ? p.images : [p.main_image];
  const d = $("#puppyDialog");
  d.innerHTML = `<div class="modal">
    <button class="close" aria-label="סגירה">×</button>
    <div class="modal-photos">
      <img class="modal-main" src="${esc(imgs[0])}" alt="${esc(p.alt || p.name)}">
      ${imgs.length > 1 ? `<div class="thumbs">${imgs.map((src, i) => `<button type="button" aria-current="${i === 0}" aria-label="תמונה ${i + 1}"><img src="${esc(small(src))}" alt=""></button>`).join("")}</div>` : ""}
    </div>
    <div class="modal-body">
      <span class="status ${st.cls}">${st.label}</span>
      <h2 id="pdName">${esc(p.name)}</h2>
      <p>${esc(p.description)}</p>
      <dl class="facts">
        <div><dt>מין</dt><dd>${GENDER[p.gender] || ""}</dd></div>
        <div><dt>גזע</dt><dd>${BREED[p.breed] || ""}</dd></div>
        <div><dt>גיל</dt><dd>${ageText(p.birth_date)}</dd></div>
        <div><dt>צבע</dt><dd>${esc(p.color)}</dd></div>
        <div><dt>תאריך לידה</dt><dd>${dateHe(p.birth_date)}</dd></div>
      </dl>
      <div class="modal-actions">
        <a class="btn btn-wa" target="_blank" rel="noopener" href="${waLink(`היי, ראיתי באתר את ${p.name} ואני אשמח לקבל פרטים נוספים.`)}"><svg><use href="#i-wa"/></svg>שאלו על ${esc(p.name)} בוואטסאפ</a>
        <a class="btn btn-light" href="${telLink()}"><svg><use href="#i-phone"/></svg>התקשרו: <span dir="ltr">${esc(site.phone)}</span></a>
      </div>
    </div>
  </div>`;
  const main = $(".modal-main", d);
  d.querySelectorAll(".thumbs button").forEach((b, i) => b.addEventListener("click", () => {
    main.src = imgs[i];
    d.querySelectorAll(".thumbs button").forEach((x, j) => x.setAttribute("aria-current", i === j));
  }));
  $(".close", d).addEventListener("click", () => d.close());
  d.showModal();
  if (push) try { history.replaceState(null, "", `#${p.slug}`); } catch {}
}

/* ---------- gallery + lightbox ---------- */
let shown = [];
function renderGallery(filter = "all") {
  shown = gallery.filter((g) => filter === "all" || g.category === filter);
  $("#galleryGrid").innerHTML = shown.map((g, i) =>
    `<figure class="tile" data-i="${i}" tabindex="0" role="button" aria-label="הגדלת תמונה: ${esc(g.caption)}">
      <img src="${esc(small(g.image))}" alt="${esc(g.caption)}" loading="lazy">
      <figcaption>${esc(g.caption)}</figcaption>
    </figure>`).join("");
  document.querySelectorAll(".tile").forEach((t) => {
    const open = () => openLightbox(+t.dataset.i);
    t.addEventListener("click", open);
    t.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } });
  });
}

function openLightbox(i) {
  const lb = $("#lightbox");
  const show = (n) => {
    i = (n + shown.length) % shown.length;
    const g = shown[i];
    lb.innerHTML = `<figure>
      <button class="close" aria-label="סגירה">×</button>
      <img src="${esc(g.image)}" alt="${esc(g.caption)}">
      ${shown.length > 1 ? `<button class="lb-nav lb-prev" aria-label="הקודמת">›</button><button class="lb-nav lb-next" aria-label="הבאה">‹</button>` : ""}
      <figcaption>${esc(g.caption)}</figcaption>
    </figure>`;
    $(".close", lb).onclick = () => lb.close();
    const prev = $(".lb-prev", lb), next = $(".lb-next", lb);
    if (prev) { prev.onclick = () => show(i - 1); next.onclick = () => show(i + 1); }
  };
  lb.onkeydown = (e) => {
    if (e.key === "ArrowRight") show(i - 1);
    if (e.key === "ArrowLeft") show(i + 1);
  };
  show(i);
  lb.showModal();
}

document.querySelectorAll(".filters button").forEach((b) => b.addEventListener("click", () => {
  document.querySelectorAll(".filters button").forEach((x) => x.setAttribute("aria-pressed", x === b));
  renderGallery(b.dataset.filter);
}));

// close dialogs by clicking the backdrop
document.querySelectorAll("dialog").forEach((d) => d.addEventListener("click", (e) => { if (e.target === d) d.close(); }));
$("#puppyDialog").addEventListener("close", () => { try { history.replaceState(null, "", location.pathname + location.search); } catch {} });

/* ---------- header, menu, form ---------- */
const header = $(".site-header");
addEventListener("scroll", () => header.classList.toggle("scrolled", scrollY > 10), { passive: true });
$("#menuBtn").addEventListener("click", () => {
  const open = header.classList.toggle("menu-open");
  $("#menuBtn").setAttribute("aria-expanded", open);
});
document.querySelectorAll(".nav a").forEach((a) => a.addEventListener("click", () => {
  header.classList.remove("menu-open");
  $("#menuBtn").setAttribute("aria-expanded", false);
}));


/* ---------- reveal on scroll (content is visible without JS) ---------- */
function setupReveal() {
  if (!("IntersectionObserver" in window) || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const io = new IntersectionObserver((entries) => entries.forEach((en) => {
    if (en.isIntersecting) { en.target.classList.remove("pre"); io.unobserve(en.target); }
  }), { rootMargin: "0px 0px -8% 0px" });
  document.querySelectorAll(".reveal").forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.top > innerHeight) { el.classList.add("pre"); io.observe(el); }
  });
}

/* ---------- boot ---------- */
async function load(path) {
  const r = await fetch(path, { cache: "no-cache" });
  if (!r.ok) throw new Error(path);
  return r.json();
}
(async () => {
  try {
    [site, puppies, gallery] = await Promise.all([load("data/site.json"), load("data/puppies.json"), load("data/gallery.json")]);
  } catch (err) {
    $("#puppyGrid").innerHTML = `<p class="empty">לא הצלחנו לטעון את רשימת הגורים. נסו לרענן את העמוד.</p>`;
    console.error(err);
  }
  applyContent();
  renderPuppies();
  renderGallery();
  setupReveal();
  const slug = location.hash.slice(1);
  const p = puppies.find((x) => x.slug === slug);
  if (p) openPuppy(p.id, false);
})();
