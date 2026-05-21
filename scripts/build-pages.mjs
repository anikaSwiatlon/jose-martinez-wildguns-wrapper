#!/usr/bin/env node
// scripts/build-pages.mjs
//
// Builds the static GitHub Pages site under _site/ from:
//   - docs/site/_layout.html   (shared header/footer/nav)
//   - docs/site/*.html         (per-page body content)
//   - docs/site/assets/        (CSS, images)
//   - CHANGELOG.md             (rendered into patchnotes.html)
//   - LICENSE                  (rendered into legal.html#license)
//   - PRIVACY.md               (rendered into legal.html#privacy)
//
// The script enriches each CHANGELOG version block with the matching GitHub
// Release's asset download link, fetched from the public Releases API at
// build time. No npm dependencies; runs on the Node version pinned in
// pages.yml (24+).

import { readFile, writeFile, mkdir, cp, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SITE_SRC  = path.join(REPO_ROOT, "docs", "site");
const OUT_DIR   = path.join(REPO_ROOT, "_site");

const PAGES = [
  { file: "index.html",      title: "Home" },
  { file: "patchnotes.html", title: "Patchnotes" },
  { file: "legal.html",      title: "License & Privacy" },
  { file: "contact.html",    title: "Contact" },
];

const { owner, repo } = resolveOwnerRepo();

main().catch(err => { console.error(err); process.exit(1); });

async function main() {
  await mkdir(OUT_DIR,                       { recursive: true });
  await mkdir(path.join(OUT_DIR, "assets"),  { recursive: true });

  const layout = await readFile(path.join(SITE_SRC, "_layout.html"), "utf8");
  const releases = await fetchReleases();
  const changelog = await readOptional(path.join(REPO_ROOT, "CHANGELOG.md"));
  const license   = await readOptional(path.join(REPO_ROOT, "LICENSE"));
  const privacy   = await readOptional(path.join(REPO_ROOT, "PRIVACY.md"));

  for (const page of PAGES) {
    const srcPath = path.join(SITE_SRC, page.file);
    if (!existsSync(srcPath)) {
      console.warn(`Skipping ${page.file} — source not found.`);
      continue;
    }
    let body = await readFile(srcPath, "utf8");

    if (page.file === "patchnotes.html") {
      body = body.replace("<!-- patchnotes-content -->", renderChangelog(changelog, releases));
    }
    if (page.file === "legal.html") {
      body = body
        .replace("<!-- license-content -->", renderLicense(license))
        .replace("<!-- privacy-content -->", renderMarkdown(privacy ?? "_No privacy notice on file yet._"));
    }

    const html = interpolate(layout, { title: page.title, content: body, owner, repo });
    await writeFile(path.join(OUT_DIR, page.file), html, "utf8");
    console.log(`  ✓ ${page.file}`);
  }

  // Copy the assets directory recursively.
  const assetsSrc = path.join(SITE_SRC, "assets");
  if (existsSync(assetsSrc)) {
    await cp(assetsSrc, path.join(OUT_DIR, "assets"), { recursive: true });
    console.log("  ✓ assets/");
  }

  console.log(`\nDone. Site written to ${path.relative(REPO_ROOT, OUT_DIR)}/`);
}

// ── Template helpers ──────────────────────────────────────────────────────

function interpolate(template, vars) {
  return template
    .replaceAll("{{title}}",   vars.title   ?? "")
    .replaceAll("{{content}}", vars.content ?? "")
    .replaceAll("{{owner}}",   vars.owner   ?? "")
    .replaceAll("{{repo}}",    vars.repo    ?? "");
}

async function readOptional(p) {
  try { return await readFile(p, "utf8"); }
  catch { return null; }
}

// ── Owner / repo resolution ───────────────────────────────────────────────
//
// In CI, GITHUB_REPOSITORY is set to "owner/repo". Locally we fall back to
// hardcoded defaults so `node scripts/build-pages.mjs` produces sensible
// links even without the env var.

function resolveOwnerRepo() {
  const env = process.env.GITHUB_REPOSITORY;
  if (env && env.includes("/")) {
    const [o, r] = env.split("/");
    return { owner: o, repo: r };
  }
  return { owner: "anikaSwiatlon", repo: "jose-martinez-wildguns-wrapper" };
}

// ── GitHub Releases API ───────────────────────────────────────────────────
//
// Returns a map from version tag (e.g. "v0.2.1") to release object so we can
// look up download links per CHANGELOG version. Falls back to {} on any
// network / auth failure — patchnotes still render, just without asset links.

async function fetchReleases() {
  const url = `https://api.github.com/repos/${owner}/${repo}/releases?per_page=100`;
  const headers = { "Accept": "application/vnd.github+json", "User-Agent": "build-pages" };
  if (process.env.GITHUB_TOKEN) headers["Authorization"] = `Bearer ${process.env.GITHUB_TOKEN}`;
  try {
    const res = await fetch(url, { headers });
    if (!res.ok) {
      console.warn(`  ! Releases API returned ${res.status}; patchnotes will render without download links.`);
      return {};
    }
    const list = await res.json();
    const map = {};
    for (const r of list) {
      const tag = r.tag_name;
      const asset = (r.assets ?? []).find(a => a.name.endsWith(".zip"));
      map[tag] = {
        publishedAt: r.published_at,
        htmlUrl:     r.html_url,
        assetUrl:    asset?.browser_download_url ?? null,
        assetName:   asset?.name ?? null,
      };
    }
    return map;
  } catch (e) {
    console.warn(`  ! Could not fetch releases (${e.message}); patchnotes will render without download links.`);
    return {};
  }
}

// ── Changelog rendering ──────────────────────────────────────────────────────
//
// Expects Keep-a-Changelog format:
//   ## [0.3.0] — 2026-06-01     # released, has GitHub Release with asset
//   ## [Unreleased]             # in-progress, no release yet
//
// Splits on `^## ` headers, then renders each block with a release asset
// link if present.

function renderChangelog(text, releasesByTag) {
  if (!text) {
    return `<p class="lede">Changelog file not found in the repo. Add <code>CHANGELOG.md</code> at the root.</p>`;
  }
  const lines = text.split(/\r?\n/);
  const blocks = [];
  let current = null;

  for (const line of lines) {
    const versionMatch = line.match(/^##\s+\[?([^\]]+?)\]?\s*(?:[—-]\s*(.+))?$/);
    if (versionMatch && !/^#/.test(versionMatch[1].slice(1))) {
      // Closes the previous block.
      if (current) blocks.push(current);
      current = {
        version: versionMatch[1].trim(),
        date:    versionMatch[2]?.trim() ?? null,
        body:    [],
      };
      continue;
    }
    if (current) current.body.push(line);
  }
  if (current) blocks.push(current);

  // Drop any leading H1 / preamble lines that landed in the first body before a real version.
  const releaseBlocks = blocks.filter(b => /^[\d.]+$|^Unreleased$/i.test(b.version) || /^v?\d/.test(b.version));

  if (releaseBlocks.length === 0) {
    return `<p class="lede">No versions parsed from <code>CHANGELOG.md</code> yet.</p>`;
  }

  return releaseBlocks.map(b => renderReleaseBlock(b, releasesByTag)).join("\n");
}

function renderReleaseBlock(block, releasesByTag) {
  const isUnreleased = /^unreleased$/i.test(block.version);
  const versionLabel = isUnreleased ? "Unreleased" : `v${block.version.replace(/^v/, "")}`;
  const tagKey = `v${block.version.replace(/^v/, "")}`;
  const release = releasesByTag[tagKey];

  let dateLabel = block.date ?? "";
  if (release?.publishedAt) {
    dateLabel = release.publishedAt.slice(0, 10);
  }

  const assetLink = release?.assetUrl
    ? `<span class="release-asset"><a href="${escapeAttr(release.assetUrl)}">Download ${escapeHtml(release.assetName)}</a></span>`
    : "";

  const body = renderMarkdown(block.body.join("\n").trim());

  return `
<article class="release-block${isUnreleased ? " unreleased" : ""}">
  <h2>
    <span class="release-tag">${escapeHtml(versionLabel)}</span>
    ${dateLabel ? `<span class="release-date">${escapeHtml(dateLabel)}</span>` : ""}
    ${assetLink}
  </h2>
  ${body}
</article>`;
}

// ── License rendering ─────────────────────────────────────────────────────

function renderLicense(licenseText) {
  if (!licenseText) {
    return `<p class="lede">LICENSE file not found in the repo.</p>`;
  }
  return `<pre>${escapeHtml(licenseText.trim())}</pre>`;
}

// ── Tiny Markdown renderer ────────────────────────────────────────────────
//
// Only what CHANGELOG and PRIVACY actually use: headers (## / ###), unordered
// lists, paragraphs, inline code, bold/italic, links. Anything more elaborate
// can land later — keeps the build script dep-free.

function renderMarkdown(src) {
  if (!src) return "";
  const lines = src.split(/\r?\n/);
  const out = [];
  let inList = false;
  let paragraph = [];
  // Accumulate the current list item's text so wrapped lines (indented
  // continuation) join the same <li> rather than breaking it.
  let liBuffer = null;

  function flushParagraph() {
    if (paragraph.length) {
      out.push(`<p>${inline(paragraph.join(" "))}</p>`);
      paragraph = [];
    }
  }
  function flushLi() {
    if (liBuffer !== null) {
      out.push(`<li>${inline(liBuffer)}</li>`);
      liBuffer = null;
    }
  }
  function closeList() {
    flushLi();
    if (inList) { out.push("</ul>"); inList = false; }
  }

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, "");
    if (!line) { flushParagraph(); closeList(); continue; }

    const h3 = line.match(/^###\s+(.*)$/);
    if (h3) { flushParagraph(); closeList(); out.push(`<h3>${inline(h3[1])}</h3>`); continue; }
    const h2 = line.match(/^##\s+(.*)$/);
    if (h2) { flushParagraph(); closeList(); out.push(`<h3>${inline(h2[1])}</h3>`); continue; }

    const li = line.match(/^[-*]\s+(.*)$/);
    if (li) {
      flushParagraph();
      if (!inList) { out.push("<ul>"); inList = true; }
      flushLi();
      liBuffer = li[1];
      continue;
    }

    // Indented continuation of the current list item.
    if (inList && /^\s+\S/.test(raw)) {
      liBuffer = (liBuffer ?? "") + " " + line.trim();
      continue;
    }

    closeList();
    paragraph.push(line);
  }
  flushParagraph();
  closeList();
  return out.join("\n");
}

function inline(text) {
  let s = escapeHtml(text);
  // Inline code.
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  // Links [text](url) — url is URL-encoded by the author; we just decode the entity-escape we just applied.
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, txt, url) =>
    `<a href="${url.replace(/&amp;/g, "&")}">${txt}</a>`);
  // Bold / italic.
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, "<em>$1</em>");
  return s;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
function escapeAttr(s) { return escapeHtml(s); }
