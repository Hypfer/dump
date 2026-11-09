import fs from "node:fs";
import path from "node:path";
import MarkdownIt from "markdown-it";

const TZ = "Europe/Berlin";

const md = new MarkdownIt({ linkify: true, typographer: true });

const renderLink = md.renderer.rules.link_open || ((tokens, idx, options, env, self) => self.renderToken(tokens, idx, options));
md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
  const href = tokens[idx].attrGet("href") || "";
  if (/^https?:\/\//i.test(href)) {
    tokens[idx].attrSet("target", "_blank");
    tokens[idx].attrSet("rel", "noopener");
  }
  return renderLink(tokens, idx, options, env, self);
};

const site = {
  url: "https://dump.hypfer.de",
  title: "Hypfer’s dumping grounds",
  brand: "Hypfer’s dumping grounds",
  tagline: "Somewhat curated internet",
  description: "Stuff I deemed worthy of note",
  tz: TZ,
};

function parseFrontmatter(raw) {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return [{}, raw];
  const fm = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
    if (kv) fm[kv[1]] = kv[2].replace(/^["']|["']$/g, "").trim();
  }
  return [fm, m[2]];
}

function partsInTZ(date) {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
    weekday: "short",
  });
  const o = {};
  for (const p of fmt.formatToParts(date)) o[p.type] = p.value;
  if (o.hour === "24") o.hour = "00";
  return o;
}

function domainOf(link) {
  try {
    return new URL(link).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function headlineOf(title, domain, body) {
  if (title) return title;
  const line = body
    .split(/\r?\n/)
    .map((s) => s.trim())
    .find((s) => s.length > 0) || domain || "post";
  return line
    .replace(/^>\s?/, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*_`#]+/g, "");
}

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function feedHtml(e) {
  const bits = [];
  if (e.title) {
    bits.push(e.link
      ? `<p><a href="${esc(e.link)}">${esc(e.title)}</a></p>`
      : `<p><strong>${esc(e.title)}</strong></p>`);
  } else if (e.link && !e.bodyHtml) {
    bits.push(`<p><strong><a href="${esc(e.link)}">${esc(e.domain)}</a></strong></p>`);
  }
  if (e.bodyHtml) bits.push(e.bodyHtml);
  if (e.bodyFirst) bits.push(`<p><a href="${esc(e.link)}">${esc(e.link)}</a></p>`);
  if (e.via) {
    bits.push(e.viaLink
      ? `<p>Via <a href="${esc(e.viaLink)}">${esc(e.via)}</a></p>`
      : `<p>Thanks, ${esc(e.via)}!</p>`);
  }
  return bits.join("\n");
}

function loadEntries() {
  const dir = path.join(process.cwd(), "entries");
  if (!fs.existsSync(dir)) return [];

  const seenAnchors = new Map();
  const entries = [];

  const files = fs
    .readdirSync(dir, { recursive: true })
    .map((f) => String(f).replaceAll("\\", "/"))
    .filter((f) => f.endsWith(".md"))
    .sort();

  for (const f of files) {
    const [fm, body] = parseFrontmatter(fs.readFileSync(path.join(dir, f), "utf8"));
    const trimmedBody = body.trim();

    const ts = Number(fm.date);
    if (!Number.isFinite(ts) || ts <= 0) { console.warn(`[blog] ${f}: bad date "${fm.date}" - skipped`); continue; }
    const date = new Date(ts * 1000);
    if (!fm.link && !trimmedBody) { console.warn(`[blog] ${f}: neither link nor body - skipped`); continue; }

    let anchor = ts.toString(16);
    const n = (seenAnchors.get(anchor) ?? 0) + 1;
    seenAnchors.set(anchor, n);
    if (n > 1) anchor = `${anchor}-${n}`;

    const p = partsInTZ(date);
    const e = {
      file: f,
      date,
      ts,
      anchor,
      dayKey: `${p.year}/${p.month}/${p.day}`,
      title: fm.title || null,
      link: fm.link || null,
      via: fm.via || null,
      viaLink: fm.via_link || null,
      bodyHtml: md.render(trimmedBody),
    };
    e.domain = e.link ? domainOf(e.link) : null;
    e.headline = headlineOf(fm.title, e.domain, trimmedBody);
    e.bareLink = Boolean(e.link) && !e.title && !e.bodyHtml;
    e.bodyFirst = Boolean(e.link) && !e.title && Boolean(e.bodyHtml);
    e.compact = Boolean(e.link) && !e.bodyHtml && !e.via;
    e.dayUrl = `/a/${e.dayKey}/`;
    e.dayLabel = `${p.weekday} · ${p.year}-${p.month}-${p.day}`;
      e.permalink = `/p/${e.anchor}/`;
    e.feedHtml = feedHtml(e);
    entries.push(e);
  }

  entries.sort((a, b) => b.date - a.date);
  entries.forEach((x, i) => {
    x.newer = entries[i - 1] ?? null;
    x.older = entries[i + 1] ?? null;
  });
  return entries;
}

function groupIntoDays(entries) {
  const days = [];
  for (const e of entries) {
    let day = days[days.length - 1];
    if (!day || day.key !== e.dayKey) {
      const p = partsInTZ(e.date);
      day = {
        key: e.dayKey,
        dateLabel: `${p.weekday} · ${p.year}-${p.month}-${p.day}`,
        isoDate: `${p.year}-${p.month}-${p.day}`,
        url: `/a/${e.dayKey}/`,
        entries: [],
      };
      days.push(day);
    }
    day.entries.push(e);
  }
  days.forEach((d, i) => {
    d.newer = days[i - 1] ?? null;
    d.older = days[i + 1] ?? null;
  });
  return days;
}

const MONTHS = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];

function groupIntoMonths(days) {
  const months = [];
  for (const d of days) {
    const key = d.key.slice(0, 7);
    let m = months[months.length - 1];
    if (!m || m.key !== key) {
      const [y, mo] = key.split("/");
      m = { key, label: key.replace("/", "-"), name: MONTHS[+mo - 1], url: `/a/${key}/`, days: [], count: 0 };
      months.push(m);
    }
    m.days.push(d);
    m.count += d.entries.length;
  }
  return months;
}

function groupIntoYears(months) {
  const years = [];
  for (const m of months) {
    const key = m.key.slice(0, 4);
    let y = years[years.length - 1];
    if (!y || y.key !== key) {
      y = { key, label: key, months: [], count: 0 };
      years.push(y);
    }
    y.months.push(m);
    y.count += m.count;
  }
  return years;
}

export default function () {
  const entries = loadEntries();
  const days = groupIntoDays(entries);
  const months = groupIntoMonths(days);
  const years = groupIntoYears(months);
  return { site, entries, days, months, years };
}
