// Cloudflare Worker behind admin.poodle-family.co.il (deployed by
// .github/workflows/admin-worker.yml, settings in worker/wrangler.toml).
//   /<key>             the admin panel (the static page from the site)
//   /api/content|save  read / save, need the key in X-Admin-Key
//   /public/content    what the site reads on every visit
//   /img/<name>.webp   photos uploaded from the panel
// Texts and photos live in the KV namespace CONTENT. Only a SHA-256 of the key
// is stored (ADMIN_KEY_SHA256), so the repo can stay public.
const SITE = "https://creative824.github.io/poodle-family/";
const MAX_BODY = 40 * 1024 * 1024;
const PHOTO = /^[\w-]+\.webp$/;
const CORS = { "Access-Control-Allow-Origin": "*" };

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const [first, second] = url.pathname.split("/").filter(Boolean);
    try {
      if (first === "public" && second === "content") return await publicContent(env);
      if (first === "img" && second) return await photo(env, second);
      if (first === "api") {
        if (!(await keyOk(req.headers.get("X-Admin-Key"), env))) return json({ error: "unauthorized" }, 401);
        if (second === "content" && req.method === "GET") return json(await readContent(env));
        if (second === "save" && req.method === "POST") return json(await save(req, env, url.origin));
        return json({ error: "not found" }, 404);
      }
      if (req.method === "GET" && first && !second && (await keyOk(decodeURIComponent(first), env))) return await adminPage();
      return new Response("הדף לא נמצא", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
    } catch (err) {
      return json({ error: String(err.message || err) }, 500);
    }
  },
};

const sha256 = async (s) => new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));
async function keyOk(given, env) {
  const want = env.ADMIN_KEY_SHA256 || "";
  if (!given || want.length !== 64) return false;
  const a = await sha256(given);
  const b = Uint8Array.from(want.match(/../g), (h) => parseInt(h, 16));
  return crypto.subtle.timingSafeEqual(a, b);
}

const json = (data, status = 200, extra = {}) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...extra } });

// The panel itself is the static page from the site; <base> keeps its relative links working.
async function adminPage() {
  const r = await fetch(SITE + "admin/index.html", { cf: { cacheTtl: 0 } });
  if (!r.ok) throw new Error("admin page " + r.status);
  const base = new URL("./", r.url).href;
  const html = (await r.text()).replace(
    "<head>",
    `<head>\n<base href="${base}">\n<meta name="admin-mode" content="worker">`,
  );
  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow", "Referrer-Policy": "no-referrer" },
  });
}

async function readContent(env) {
  const saved = await env.CONTENT.get("content", "json");
  if (saved) return saved;
  // nothing saved yet: start from the JSON files on the site
  const get = async (p) => (await fetch(SITE + p, { cf: { cacheTtl: 0 } })).json();
  const [site, gallery] = await Promise.all([get("data/site.json"), get("data/gallery.json")]);
  return { site, gallery };
}

async function publicContent(env) {
  const saved = await env.CONTENT.get("content", { type: "json", cacheTtl: 30 });
  return json(saved || {}, 200, { ...CORS, "Cache-Control": "public, max-age=30" });
}

async function photo(env, name) {
  if (!PHOTO.test(name)) return new Response("not found", { status: 404 });
  const data = await env.CONTENT.get("img:" + name, { type: "arrayBuffer", cacheTtl: 86400 });
  if (!data) return new Response("not found", { status: 404 });
  return new Response(data, { headers: { "Content-Type": "image/webp", "Cache-Control": "public, max-age=31536000, immutable", ...CORS } });
}

async function save(req, env, origin) {
  if (+req.headers.get("Content-Length") > MAX_BODY) throw new Error("התמונות גדולות מדי לשמירה אחת");
  const { site, gallery, files = [] } = await req.json();
  if (!site || typeof site !== "object" || Array.isArray(site)) throw new Error("bad site");
  if (!Array.isArray(gallery) || !gallery.every((g) => g && typeof g.image === "string")) throw new Error("bad gallery");
  for (const f of files) {
    if (!f || typeof f.base64 !== "string" || !PHOTO.test(f.name || "")) throw new Error("bad file " + (f && f.name));
  }
  // photos first, so the content never points at a photo that isn't there
  for (const f of files) {
    const bytes = Uint8Array.from(atob(f.base64), (c) => c.charCodeAt(0));
    await env.CONTENT.put("img:" + f.name, bytes);
  }
  const value = JSON.stringify({ site, gallery, saved_at: new Date().toISOString() });
  await env.CONTENT.put("content", value);
  // every saved version is kept for 90 days, in case a save needs undoing
  await env.CONTENT.put("history:" + Date.now(), value, { expirationTtl: 60 * 60 * 24 * 90 });
  return { ok: true, photos: origin + "/img/" };
}
