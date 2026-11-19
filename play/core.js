// Shared Presents proof core. Pure, no network. Runs in a browser (WebCrypto) and in Node 20+ (globalThis.crypto).
// A catalog holds agent sources by fingerprint; a stack names exact versions plus static routes; a transcript turn
// names its speaker and stack. Replaying turn k loads exactly what turn k names, checks every fingerprint, and
// answers with the loaded agents only. Agents here are tiny pure functions so the answer is reproducible byte for byte.
export const enc = s => new TextEncoder().encode(s);
export async function sha256(s) {
  const b = await globalThis.crypto.subtle.digest("SHA-256", enc(s));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, "0")).join("");
}
export function canon(v) {               // RFC 8785-style for the plain JSON used here
  if (Array.isArray(v)) return "[" + v.map(canon).join(",") + "]";
  if (v && typeof v === "object") return "{" + Object.keys(v).sort().map(k => JSON.stringify(k) + ":" + canon(v[k])).join(",") + "}";
  return JSON.stringify(v);
}
// Four agents. Each source is a pure function body of (text) -> string.
export const SOURCES = {
  "disk_care_agent.py@1": "return 'Disk: 32 GB free on ' + (text.match(/mini-\\w+/)||['this Mac'])[0] + '.'",
  "disk_care_agent.py@2": "return 'Disk: 32 GB free on ' + (text.match(/mini-\\w+/)||['this Mac'])[0] + '; 4 GB of caches can go to the Trash.'",
  "fleet_agent.py@1":     "return 'Fleet: handed to mini-b, which has a browser.'",
  "browser_agent.py@1":   "return 'Browser: opened ' + (text.match(/[a-z]+\\.(com|org)/)||['the page'])[0] + '.'",
  "memory_agent.py@1":    "return 'Memory: saved \"' + text.slice(0, 40) + '\".'",
};
export async function buildCatalog(sources = SOURCES) {
  const cat = {};
  for (const [k, src] of Object.entries(sources)) cat[await sha256(src)] = { name: k.split("@")[0], src };
  return cat;
}
export async function ref(cat, key, sources = SOURCES) { const h = await sha256(sources[key]); return { name: key.split("@")[0], sha256: h }; }
// A stack: exact refs, child stacks, and static routes (whole words in recent turns pick a child).
export async function stacks(cat) {
  return {
    "care":    { refs: [await ref(cat, "disk_care_agent.py@1")], routes: [] },
    "care-v2": { refs: [await ref(cat, "disk_care_agent.py@2")], routes: [] },
    "web":     { refs: [await ref(cat, "fleet_agent.py@1"), await ref(cat, "browser_agent.py@1")], routes: [] },
    "keeper":  { refs: [await ref(cat, "memory_agent.py@1")], routes: [] },
    "hub":     { refs: [], routes: [{ when: ["disk", "space"], stack: "care" }, { when: ["open", "browser"], stack: "web" }] },
  };
}
const words = t => new Set(t.toLowerCase().match(/[a-z0-9]+/g) || []);
export function resolve(st, name, context, seen = new Set()) {
  if (seen.has(name)) return []; seen.add(name);
  const s = st[name]; if (!s) throw new Error("unknown stack " + name);
  const w = words(context); let out = [...s.refs];
  for (const r of s.routes) if (r.when.some(x => w.has(x))) out = out.concat(resolve(st, r.stack, context, seen));
  return out;
}
// Load: fetch each ref by fingerprint and re-hash it. Any mismatch refuses the whole turn (never half-loaded).
export async function load(cat, refs) {
  const loaded = [];
  for (const r of refs) {
    const e = cat[r.sha256];
    if (!e) return { ok: false, why: "missing " + r.name };
    if (await sha256(e.src) !== r.sha256) return { ok: false, why: "fingerprint mismatch on " + r.name };
    loaded.push({ name: e.name, sha256: r.sha256, fn: new Function("text", e.src) });
  }
  return { ok: true, loaded };
}
// Replay one turn: the speaker's stack, routed by the last 4 turns, answers with only what loaded.
export async function replayTurn(cat, st, transcript, k) {
  const t = transcript.turns[k];
  const context = transcript.turns.slice(Math.max(0, k - 3), k + 1).map(x => x.said).join(" ");
  const refs = resolve(st, t.stack, context);
  const l = await load(cat, refs);
  if (!l.ok) return { k, speaker: t.speaker, refused: l.why, agents: [] };
  const answer = l.loaded.map(a => a.fn(t.said)).join(" ");
  return { k, speaker: t.speaker, agents: l.loaded.map(a => a.name + "@" + a.sha256.slice(0, 8)), answer, answer_sha256: await sha256(answer) };
}
export async function replayAll(cat, st, transcript) { const out = []; for (let k = 0; k < transcript.turns.length; k++) out.push(await replayTurn(cat, st, transcript, k)); return out; }
// Seal: record each turn's agents and answer hash, so a later replay can be compared byte for byte.
export async function seal(cat, st, transcript) {
  const r = await replayAll(cat, st, transcript);
  return { ...transcript, turns: transcript.turns.map((t, i) => ({ ...t, agents: r[i].agents, answer_sha256: r[i].answer_sha256 })) };
}
export function fork(transcript, k, parentHash, newTurns) {
  return { genesis: { parent: parentHash, at_turn: k }, turns: transcript.turns.slice(0, k + 1).concat(newTurns) };
}
export const TRANSCRIPT = { turns: [
  { speaker: "Kody",    stack: "hub",    said: "mini-a is slow, check disk space" },
  { speaker: "Care",    stack: "care",   said: "check disk on mini-a" },
  { speaker: "Kody",    stack: "hub",    said: "now open the browser to swift.org" },
  { speaker: "Web",     stack: "web",    said: "open swift.org" },
  { speaker: "Keeper",  stack: "keeper", said: "remember mini-a was full on Nov 19" },
  { speaker: "Kody",    stack: "hub",    said: "thanks, that is all" },
  { speaker: "Care",    stack: "care",   said: "check disk on mini-a again" },
] };
