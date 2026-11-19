// Plain Node, no dependencies: the proof's core must hold, and must fail when tampered.
import * as C from "../play/core.js";
let pass = 0, total = 0; const check = (n, ok) => { total++; if (ok) pass++; console.log((ok ? "PASS " : "FAIL ") + n); };
check("sha256('abc') matches FIPS 180-4", await C.sha256("abc") === "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
const cat = await C.buildCatalog(), st = await C.stacks(cat), T = C.TRANSCRIPT;
const sealed = await C.seal(cat, st, T);
const again = await C.replayAll(cat, st, sealed);
check("every turn replays to its sealed answer (7 of 7)", again.every((r, i) => r.answer_sha256 === sealed.turns[i].answer_sha256));
const want = ["disk_care", "disk_care", "disk_care,fleet,browser", "fleet,browser", "memory", "fleet,browser", "disk_care"];
const got = again.map(r => r.agents.map(x => x.split("_agent")[0]).join(","));
check("each turn loads exactly what it names, routed by the last 4 turns (7 of 7): " + got.join(" | "), got.join("|") === want.join("|"));
check("unload: turn 4 (Keeper) holds only memory; the care and web agents from turns 0..3 are gone", got[4] === "memory");
check("group chat: three speakers (Care, Web, Keeper) each answer with only their own stack", got[1] === "disk_care" && got[3] === "fleet,browser" && got[4] === "memory");
// Time travel: a new agent version arrives; old chats still replay with the version they named.
const cat2 = await C.buildCatalog(); const st2 = await C.stacks(cat2); st2.care = st2["care-v2"];
const fresh = await C.replayTurn(cat2, st2, sealed, 1);
const pinned = await C.replayTurn(cat2, await C.stacks(cat2), sealed, 1);
check("upgrade changes the answer for a new chat", fresh.answer_sha256 !== sealed.turns[1].answer_sha256);
check("the old chat, replayed with what it named, is unchanged", pinned.answer_sha256 === sealed.turns[1].answer_sha256);
// Fork at turn 3: shared prefix identical, the branch differs, the parent is named.
const parent = await C.sha256(C.canon(sealed));
const f = C.fork(sealed, 3, parent, [{ speaker: "Kody", stack: "hub", said: "check disk space instead" }]);
const fr = await C.replayAll(cat, st, f);
check("fork keeps turns 0..3 byte-identical", [0, 1, 2, 3].every(i => fr[i].answer_sha256 === sealed.turns[i].answer_sha256));
check("fork names its parent", f.genesis.parent === parent && f.genesis.at_turn === 3);
// Tamper: change one byte of an agent in the catalog; the turn that names it is refused, never half-loaded.
const bad = structuredClone(cat); const h = Object.keys(bad).find(x => bad[x].name === "browser_agent.py"); bad[h].src += " ";
const tr = await C.replayTurn(bad, st, sealed, 3);
check("tampered agent: the turn is refused", !!tr.refused && /fingerprint/.test(tr.refused));
check("tampered agent: other turns still replay", (await C.replayTurn(bad, st, sealed, 1)).answer_sha256 === sealed.turns[1].answer_sha256);
console.log(`RESULT ${pass} of ${total}`); process.exit(pass === total ? 0 : 1);
