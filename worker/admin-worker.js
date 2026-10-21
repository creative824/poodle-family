// Cloudflare Worker behind admin.poodle-family.co.il.
// https://admin.poodle-family.co.il/<ADMIN_KEY> opens the admin panel; saving
// commits data/site.json, data/gallery.json and new photos to the repo, and
// GitHub Pages republishes the site.
// Secrets (Worker → Settings → Variables and Secrets):
//   ADMIN_KEY     the secret part of the link
//   GITHUB_TOKEN  fine-grained token, this repo only, Contents: read and write
const REPO = "creative824/poodle-family";
const BRANCH = "main";
const SITE = "https://creative824.github.io/poodle-family/";
const MAX_BODY = 40 * 1024 * 1024;
const PHOTO_PATH = /^images\/u\/[\w-]+\.webp$/;

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const [first, second] = url.pathname.split("/").filter(Boolean);
    try {
      if (first === "api") {
        if (!(await keyOk(req.headers.get("X-Admin-Key"), env))) return json({ error: "unauthorized" }, 401);
        if (second === "content" && req.method === "GET") return json(await readContent(env));
        if (second === "save" && req.method === "POST") return json(await save(req, env));
        return json({ error: "not found" }, 404);
      }
      if (req.method === "GET" && first && !second && (await keyOk(decodeURIComponent(first), env))) return await adminPage();
      return new Response("הדף לא נמצא", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
    } catch (err) {
      return json({ error: String(err.message || err) }, 500);
    }
  },
};

async function keyOk(given, env) {
  if (!given || !env.ADMIN_KEY) return false;
  const h = async (s) => new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));
  const [a, b] = await Promise.all([h(given), h(env.ADMIN_KEY)]);
  return crypto.subtle.timingSafeEqual(a, b);
}

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });

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

async function gh(env, path, init = {}) {
  const r = await fetch(`https://api.github.com/repos/${REPO}/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "poodle-family-admin",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
    },
  });
  if (!r.ok) throw new Error(`GitHub ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r.json();
}

async function readFile(env, path) {
  const f = await gh(env, `contents/${path}?ref=${BRANCH}`);
  const bytes = Uint8Array.from(atob(f.content.replace(/\n/g, "")), (c) => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}
async function readContent(env) {
  const [site, gallery] = await Promise.all([readFile(env, "data/site.json"), readFile(env, "data/gallery.json")]);
  return { site, gallery };
}

async function save(req, env) {
  if (+req.headers.get("Content-Length") > MAX_BODY) throw new Error("התמונות גדולות מדי לשמירה אחת");
  const { site, gallery, files = [] } = await req.json();
  if (!site || typeof site !== "object" || Array.isArray(site)) throw new Error("bad site");
  if (!Array.isArray(gallery) || !gallery.every((g) => g && typeof g.image === "string")) throw new Error("bad gallery");
  for (const f of files) {
    const ok = f && typeof f.base64 === "string" && (PHOTO_PATH.test(f.path) || PHOTO_PATH.test(f.path?.replace(/-sm\.webp$/, ".webp")));
    if (!ok) throw new Error("bad file " + (f && f.path));
  }

  // one commit for everything: blobs → tree → commit → move the branch
  const ref = await gh(env, `git/ref/heads/${BRANCH}`);
  const head = await gh(env, `git/commits/${ref.object.sha}`);
  const blob = (content, encoding) => gh(env, "git/blobs", { method: "POST", body: JSON.stringify({ content, encoding }) });
  const entries = [
    { path: "data/site.json", content: JSON.stringify(site, null, 2) + "\n" },
    { path: "data/gallery.json", content: JSON.stringify(gallery, null, 2) + "\n" },
  ].map((e) => ({ path: e.path, mode: "100644", type: "blob", content: e.content }));
  for (const f of files) entries.push({ path: f.path, mode: "100644", type: "blob", sha: (await blob(f.base64, "base64")).sha });
  const tree = await gh(env, "git/trees", { method: "POST", body: JSON.stringify({ base_tree: head.tree.sha, tree: entries }) });
  if (tree.sha === head.tree.sha) return { ok: true, unchanged: true };
  const commit = await gh(env, "git/commits", {
    method: "POST",
    body: JSON.stringify({ message: "עדכון תוכן מממשק הניהול", tree: tree.sha, parents: [ref.object.sha] }),
  });
  await gh(env, `git/refs/heads/${BRANCH}`, { method: "PATCH", body: JSON.stringify({ sha: commit.sha }) });
  return { ok: true, commit: commit.sha };
}
