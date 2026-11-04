// Regenerates the "Featured Projects" table in README.md from the single source
// of truth: my-apps/projects.js (the catalog) and my-apps/data/github.json (stars,
// refreshed there every 6h). Fetches their public raw copies, keeps the projects
// listed in FEATURED below, and rewrites the rows between the FEATURED markers.
//
// The catalog has no "featured" flag (its `pinned` only drives the my-apps home),
// so the profile's selection lives here, by slug. Run: node scripts/update-featured.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const README = path.join(__dirname, "..", "README.md");
const RAW = "https://raw.githubusercontent.com/lucianodiisouza/my-apps/main";
const SOURCE = process.env.PROJECTS_URL || `${RAW}/projects.js`;
const STARS_SOURCE = process.env.GITHUB_DATA_URL || `${RAW}/data/github.json`;

// Slugs from my-apps/projects.js shown on the profile.
const FEATURED = [
  "recta",
  "detran-questions",
  "primo-academy",
  "semaphore",
  "primeclip",
  "lifeboard",
  "shakedrop",
  "pr-widget",
  "primodock",
  "primorec",
  "typecourse",
  "primoengine",
  "conduzir",
];

const START = "<!-- FEATURED:START (auto-generated from my-apps/projects.js — do not edit by hand) -->";
const END = "<!-- FEATURED:END -->";

async function get(url) {
  const res = await fetch(url, { headers: { "User-Agent": "update-featured-script" } });
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  return res.text();
}

const src = await get(SOURCE);
const PROJECTS = eval(`${src}\nPROJECTS`); // projects.js is a plain script, not a module
const GITHUB = JSON.parse(await get(STARS_SOURCE));

const linkFor = (p) => p.github || p.site?.url || (p.links || [])[0]?.url || null;
const taglineFor = (p) => p.en?.tagline || p.tagline;
const escape = (s) => String(s).replace(/\|/g, "\\|");

const featured = FEATURED.map((slug) => {
  const p = PROJECTS.find((x) => x.slug === slug);
  if (!p) console.warn(`Featured slug not found in projects.js: ${slug}`);
  return p && { ...p, stars: GITHUB[slug]?.stars ?? null };
})
  .filter((p) => p && linkFor(p))
  .sort((a, b) => {
  // Highest stars first; projects without a star count (e.g. closed source) last.
  if (a.stars == null && b.stars == null) return 0;
  if (a.stars == null) return 1;
  if (b.stars == null) return -1;
  return b.stars - a.stars;
});

const rows = featured.map((p) => {
  // Non-breaking space keeps ⭐ and the (possibly 2-digit) count on one line.
  const stars = p.stars == null ? "—" : `⭐&nbsp;${p.stars}`;
  return `| ${stars} | [**${escape(p.name)}**](${linkFor(p)}) | ${escape(taglineFor(p))} |`;
});

// Never wipe the table: a schema change upstream once emptied it silently.
if (featured.length === 0) throw new Error("No featured projects resolved; refusing to empty the table.");

const table = [
  "| Stars | Project | Description |",
  "| --- | --- | --- |",
  ...rows,
].join("\n");

const readme = fs.readFileSync(README, "utf8");
const block = new RegExp(
  `${START.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[\\s\\S]*?${END.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`
);
if (!block.test(readme)) throw new Error("FEATURED markers not found in README.md");

const updated = readme.replace(block, `${START}\n${table}\n${END}`);
fs.writeFileSync(README, updated);
console.log(`Updated featured table with ${featured.length} projects.`);
