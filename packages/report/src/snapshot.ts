import type { UsageStats } from "@a11y/shared";
import { esc } from "./html";
import { growth, monthLabel, rangeLabel } from "./usage";

// A short, shareable two-slide summary of usage statistics (for a LinkedIn document post).
// Slides are 1080x1350 (4:5 portrait), the size LinkedIn shows largest in the feed. Self-contained:
// no scripts, no network, charts are inline SVG, so the HTML and the PDF made from it look the same.

export const SNAPSHOT_WIDTH = 1080;
export const SNAPSHOT_HEIGHT = 1350;

export interface SnapshotOptions {
  appName: string;
  /** Shown as the call to action, e.g. "accessibility-scan.netlify.app". */
  appUrl?: string;
  /** Accent colour (hex). */
  accent?: string;
}

const compact = (n: number) =>
  n >= 1_000_000 ? `${trim(n / 1_000_000)}M` : n >= 10_000 ? `${Math.round(n / 1000)}k` : n >= 1000 ? `${trim(n / 1000)}k` : String(Math.round(n));
const trim = (n: number) => n.toFixed(1).replace(/\.0$/, "");
const hours = (h: number) => (h >= 100 ? compact(h) : trim(h));

interface Point {
  label: string;
  value: number;
}

function lineChart(points: Point[], color: string, w = 920, h = 300) {
  const pad = { top: 64, right: 30, bottom: 50, left: 30 };
  const max = Math.max(1, ...points.map((p) => p.value));
  const step = points.length > 1 ? (w - pad.left - pad.right) / (points.length - 1) : 0;
  const x = (i: number) => pad.left + (points.length > 1 ? i * step : (w - pad.left - pad.right) / 2);
  const y = (v: number) => pad.top + (h - pad.top - pad.bottom) * (1 - v / max);
  const path = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const area = `${path} L${x(points.length - 1).toFixed(1)},${h - pad.bottom} L${x(0).toFixed(1)},${h - pad.bottom} Z`;
  const every = Math.ceil(points.length / 6);
  const last = points.length - 1;
  return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${esc(points.map((p) => `${p.label}: ${p.value}`).join(", "))}">
    <defs><linearGradient id="fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".28"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>
    <line x1="${pad.left}" x2="${w - pad.right}" y1="${h - pad.bottom}" y2="${h - pad.bottom}" stroke="#cbd5e1" stroke-width="2"/>
    ${points.length > 1 ? `<path d="${area}" fill="url(#fill)"/><path d="${path}" fill="none" stroke="${color}" stroke-width="6" stroke-linejoin="round" stroke-linecap="round"/>` : ""}
    ${points.map((p, i) => (i === last || points.length === 1 ? `<circle cx="${x(i)}" cy="${y(p.value)}" r="11" fill="${color}" stroke="#fff" stroke-width="4"/>` : "")).join("")}
    <text x="${Math.min(x(last), w - pad.right)}" y="${y(points[last].value) - 24}" text-anchor="end" font-size="30" font-weight="800" fill="#0f172a">${esc(compact(points[last].value))}</text>
    ${points
      .map((p, i) => ((last - i) % every === 0 ? `<text x="${x(i)}" y="${h - 12}" text-anchor="middle" font-size="22" fill="#475569">${esc(p.label)}</text>` : ""))
      .join("")}
  </svg>`;
}

function barChart(points: Point[], color: string, format: (n: number) => string, w = 920, h = 300) {
  const pad = { top: 44, bottom: 50, side: 10 };
  const max = Math.max(1, ...points.map((p) => p.value));
  const slot = (w - pad.side * 2) / points.length;
  const bw = Math.min(90, slot * 0.64);
  const every = Math.ceil(points.length / 6);
  const last = points.length - 1;
  return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${esc(points.map((p) => `${p.label}: ${format(p.value)}`).join(", "))}">
    ${points
      .map((p, i) => {
        const bh = ((h - pad.top - pad.bottom) * p.value) / max;
        const cx = pad.side + slot * i + slot / 2;
        const top = h - pad.bottom - bh;
        return `<rect x="${(cx - bw / 2).toFixed(1)}" y="${top.toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(bh, 2).toFixed(1)}" rx="6" fill="${color}" opacity="${i === last ? 1 : 0.45}"/>
        ${i === last || points.length <= 6 ? `<text x="${cx}" y="${top - 12}" text-anchor="middle" font-size="24" font-weight="700" fill="#0f172a">${esc(format(p.value))}</text>` : ""}
        ${(last - i) % every === 0 ? `<text x="${cx}" y="${h - 12}" text-anchor="middle" font-size="22" fill="#475569">${esc(p.label)}</text>` : ""}`;
      })
      .join("")}
  </svg>`;
}

const CSS = (accent: string) => `
  @page { size: ${SNAPSHOT_WIDTH}px ${SNAPSHOT_HEIGHT}px; margin: 0; }
  * { box-sizing: border-box; margin: 0; }
  html, body { background: #e2e8f0; }
  body { font-family: "Inter", "Segoe UI", -apple-system, Roboto, Helvetica, Arial, sans-serif; color: #0f172a; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .slide { width: ${SNAPSHOT_WIDTH}px; height: ${SNAPSHOT_HEIGHT}px; padding: 88px 80px 72px; display: flex; flex-direction: column; overflow: hidden; position: relative; break-after: page; }
  .slide:last-child { break-after: auto; }
  @media screen { .slide { margin: 24px auto; box-shadow: 0 10px 40px rgb(15 23 42 / .18); } }
  .hero { background: radial-gradient(1100px 700px at 100% 0%, ${accent}55, transparent 60%), #0b1220; color: #f8fafc; }
  .story { background: #fff; }
  .brand { font-size: 30px; font-weight: 800; letter-spacing: -.01em; display: flex; align-items: center; gap: 14px; }
  .brand .dot { width: 22px; height: 22px; border-radius: 6px; background: ${accent}; }
  .period { margin-top: 10px; font-size: 26px; opacity: .7; }
  .headline { margin-top: 64px; font-size: 76px; line-height: 1.04; font-weight: 800; letter-spacing: -.03em; }
  .headline em { font-style: normal; color: ${accent}; }
  .hero .headline em { color: #7cc0ff; }
  .lede { margin-top: 36px; font-size: 32px; line-height: 1.4; opacity: .82; max-width: 860px; }
  .lede strong { color: #fff; }
  .grid { margin-top: auto; display: grid; grid-template-columns: 1fr 1fr; gap: 22px; }
  .stat { border-radius: 24px; padding: 30px 32px; background: rgb(255 255 255 / .07); border: 1px solid rgb(255 255 255 / .12); }
  .stat .v { font-size: 74px; font-weight: 800; letter-spacing: -.03em; line-height: 1; font-variant-numeric: tabular-nums; }
  .stat .l { margin-top: 12px; font-size: 25px; opacity: .78; }
  .badge { display: inline-block; margin-left: 12px; vertical-align: middle; font-size: 26px; font-weight: 700; padding: 6px 14px; border-radius: 999px; background: #16a34a; color: #fff; letter-spacing: 0; }
  .badge.down { background: #64748b; }
  h2 { font-size: 40px; font-weight: 800; letter-spacing: -.02em; }
  .sub { font-size: 24px; color: #475569; margin-top: 6px; }
  .block { margin-top: 30px; }
  .chart { margin-top: 18px; }
  .issues { margin-top: 18px; display: grid; gap: 14px; }
  .issue { display: flex; align-items: center; gap: 24px; padding: 12px 24px; border-radius: 18px; background: #f1f5f9; }
  .issue .p { font-size: 46px; font-weight: 800; color: ${accent}; min-width: 140px; font-variant-numeric: tabular-nums; }
  .issue .t { font-size: 26px; line-height: 1.25; }
  .cta { margin-top: auto; display: flex; justify-content: space-between; align-items: center; font-size: 28px; font-weight: 700; padding-top: 28px; border-top: 2px solid #e2e8f0; }
  .cta .url { color: ${accent}; }
`;

/** Self-contained HTML of the two slides. */
export function snapshotHtml(s: UsageStats, opts: SnapshotOptions) {
  const accent = /^#[0-9a-f]{3,8}$/i.test(opts.accent ?? "") ? opts.accent! : "#2a78d6";
  const last = s.monthly.at(-1);
  const mau = last?.mau ?? s.kpis.active_users;
  const g = growth(s.monthly);
  const period = s.monthly.length === 1 && last ? monthLabel(last.month) : rangeLabel(s);
  const badge = g == null ? "" : `<span class="badge${g < 0 ? " down" : ""}">${g >= 0 ? "+" : ""}${trim(g)}% MoM</span>`;

  const stats: [string, string][] = [
    [`${compact(mau)}${badge}`, s.monthly.length > 1 ? "monthly active users" : "active users"],
    [hours(s.kpis.scan_hours), "hours of automated scanning"],
    [compact(s.kpis.pages_scanned), "web pages audited"],
    [compact(s.findings.issues_found), "accessibility issues found"],
  ];

  const trend =
    s.monthly.length >= 2
      ? { title: "Monthly active users", points: s.monthly.map((m) => ({ label: monthLabel(m.month).split(" ")[0], value: m.mau })) }
      : { title: "Daily active users", points: s.daily.map((d) => ({ label: d.day.slice(8), value: d.active_users })) };
  const time =
    s.monthly.length >= 2
      ? { title: "Hours scanned per month", points: s.monthly.map((m) => ({ label: monthLabel(m.month).split(" ")[0], value: m.scan_minutes / 60 })) }
      : null;
  const checked = s.findings.pages_checked;
  const issues = s.findings.top_rules.slice(0, 3).filter(() => checked > 0);

  const hero = `<section class="slide hero">
    <div class="brand"><span class="dot"></span>${esc(opts.appName)}</div>
    <div class="period">${esc(period)}</div>
    <h1 class="headline">Making the web <em>accessible</em>, one page at a time.</h1>
    <p class="lede">${esc(compact(s.kpis.scans))} automated audits for accessibility, SEO and performance${
      s.findings.avg_a11y != null ? `. Average accessibility score: <strong>${esc(s.findings.avg_a11y)}/100</strong>` : ""
    }.</p>
    <div class="grid">${stats.map(([v, l]) => `<div class="stat"><div class="v">${v}</div><div class="l">${esc(l)}</div></div>`).join("")}</div>
  </section>`;

  const story = `<section class="slide story">
    <div class="brand"><span class="dot"></span>${esc(opts.appName)}</div>
    <div class="block"><h2>${esc(trend.title)}</h2><div class="chart">${lineChart(trend.points, accent, 920, time ? 250 : 400)}</div></div>
    ${time ? `<div class="block"><h2>${esc(time.title)}</h2><div class="chart">${barChart(time.points, accent, (n) => hours(n), 920, 220)}</div></div>` : ""}
    ${
      issues.length
        ? `<div class="block"><h2>What we found most</h2><div class="sub">Share of audited pages with each issue</div><div class="issues">${issues
            .map((r) => `<div class="issue"><div class="p">${Math.round((r.pages / checked) * 100)}%</div><div class="t">${esc(r.help)}</div></div>`)
            .join("")}</div></div>`
        : ""
    }
    <div class="cta"><span>Is your site accessible?</span>${opts.appUrl ? `<span class="url">${esc(opts.appUrl)}</span>` : ""}</div>
  </section>`;

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=${SNAPSHOT_WIDTH}"><title>${esc(opts.appName)} · ${esc(period)}</title><style>${CSS(accent)}</style></head>
<body>${hero}${story}</body></html>`;
}
