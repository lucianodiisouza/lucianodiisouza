// Regenerates the "Featured Projects" table in README.md from the single source
// of truth: my-apps/projects.js. Fetches its public raw copy, keeps every project
// flagged `featured: true`, and rewrites the rows between the FEATURED markers.
//
// Stars come straight from projects.js (refreshed there every 6h), so this repo
// stays a mirror rather than re-querying the GitHub API. Run: node scripts/update-featured.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const README = path.join(__dirname, "..", "README.md");
const SOURCE =
  process.env.PROJECTS_URL ||
  "https://raw.githubusercontent.com/lucianodiisouza/my-apps/main/projects.js";

const START = "<!-- FEATURED:START (auto-generated from my-apps/projects.js — do not edit by hand) -->";
const END = "<!-- FEATURED:END -->";

const res = await fetch(SOURCE, { headers: { "User-Agent": "update-featured-script" } });
if (!res.ok) throw new Error(`Failed to fetch projects.js: ${res.status}`);
const src = await res.text();
const PROJECTS = eval(`${src}\nPROJECTS`); // projects.js is a plain script, not a module

const linkFor = (p) => p.github || (p.links || [])[0]?.url || null;
const escape = (s) => String(s).replace(/\|/g, "\\|");

const featured = PROJECTS.filter((p) => p.featured && linkFor(p)).sort((a, b) => {
  // Highest stars first; projects without a star count (e.g. closed source) last.
  if (a.stars == null && b.stars == null) return 0;
  if (a.stars == null) return 1;
  if (b.stars == null) return -1;
  return b.stars - a.stars;
});

const rows = featured.map((p) => {
  // Non-breaking space keeps ⭐ and the (possibly 2-digit) count on one line.
  const stars = p.stars == null ? "—" : `⭐&nbsp;${p.stars}`;
  return `| ${stars} | [**${escape(p.name)}**](${linkFor(p)}) | ${escape(p.tagline)} |`;
});

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
