import fs from "node:fs";

const TZ = "Europe/Berlin";

const args = process.argv.slice(2);
const link = args[0] && /^https?:\/\//.test(args[0]) ? args[0] : null;
const rest = link ? args.slice(1) : args;
const title = rest.join(" ").trim() || null;

const now = new Date();
const ts = Math.floor(now.getTime() / 1000);

const fmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
});
const p = {};
for (const part of fmt.formatToParts(now)) p[part.type] = part.value;
if (p.hour === "24") p.hour = "00";

const dir = `entries/${p.year}/${p.month}`;
fs.mkdirSync(dir, { recursive: true });

let base = `${dir}/${p.year}-${p.month}-${p.day}-${p.hour}${p.minute}`;
let file = `${base}.md`, n = 2;
while (fs.existsSync(file)) file = `${base}-${n++}.md`;

let fm = `---\ndate: ${ts}\n`;
if (link) fm += `link: ${link}\n`;
if (title) fm += `title: ${title.replace(/\n/g, " ")}\n`;
fm += `---\n\n`;

fs.writeFileSync(file, fm, "utf8");
console.log(file);
