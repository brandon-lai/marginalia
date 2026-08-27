/**
 * Composites every highlight colour against the real page background and
 * reports the contrast ratio of the body text over it, in both themes.
 * Reading happens at night, and a highlight that makes its own text harder to
 * read is worse than no highlight.
 */
import { execFileSync } from "node:child_process"

const EXPR = `(()=>{
  const parse=(c)=>{const n=c.match(/[\\d.]+/g).map(Number);
    return c.startsWith("color(")?[n[0]*255,n[1]*255,n[2]*255,n[3]??1]:[n[0],n[1],n[2],n[3]??1]};
  const lum=([r,g,b])=>{const f=(v)=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4)};
    return 0.2126*f(r)+0.7152*f(g)+0.0722*f(b)};
  const ratio=(a,b)=>{const [l1,l2]=[lum(a),lum(b)].sort((x,y)=>y-x);return (l1+0.05)/(l2+0.05)};
  const pageBg=parse(getComputedStyle(document.body).backgroundColor);
  const out={};
  for (const c of ["yellow","green","blue","pink"]) {
    const el=document.createElement("mark");
    el.className="hl "+c; el.textContent="x";
    document.body.appendChild(el);
    const cs=getComputedStyle(el);
    const [r,g,b,a]=parse(cs.backgroundColor);
    const comp=[r*a+pageBg[0]*(1-a), g*a+pageBg[1]*(1-a), b*a+pageBg[2]*(1-a)];
    out[c]=Math.round(ratio(parse(cs.color),comp)*100)/100;
    el.remove();
  }
  return out;
})()`

const url = process.argv[2] ?? "http://localhost:3117/"
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

let bad = 0
for (const theme of ["light", "dark"]) {
  // The previous probe's Chrome needs a moment to release the debugging port.
  if (theme !== "light") await sleep(2500)
  const raw = execFileSync("node", ["scripts/probe.mjs", url, EXPR, "1200", "900"], {
    env: { ...process.env, THEME: theme },
    encoding: "utf8",
  })
  const res = JSON.parse(raw)
  const rows = Object.entries(res).map(([k, v]) => `${k} ${v}${v < 4.5 ? " ✗" : " ✓"}`)
  for (const v of Object.values(res)) if (v < 4.5) bad++
  console.log(`${theme.padEnd(6)} ${rows.join("  ")}`)
}
console.log(bad ? `\n${bad} colour(s) below the 4.5:1 AA threshold for body text` : "\nall highlight colours pass AA in both themes")
process.exit(bad ? 1 : 0)
