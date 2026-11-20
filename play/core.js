// Working Sets: the proof's whole engine. Plain JavaScript, no dependencies, same file in the page and in the Node check.
// The chooser here is a fixed stand-in for a model (most shared words wins, ties go to the first name) so the proof repeats exactly.
const WS = (() => {
  const words = s => s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(Boolean);
  const SHELF = {
    Convert:    { does: "convert a length between feet and metres", run: () => "converted" },
    Notes:      { does: "note a fact to remember for later", run: (t, m) => { m.scratch.push(t); return "noted in the scratch pad"; } },
    PriceQuote: { does: "create a price quote for an order", needs: /(\d+) widgets/, run: t => "old price list: " + (9.5 * +t.match(/(\d+) widgets/)[1]).toFixed(2) },
    Quote:      { does: "make a price quote for an order", needs: /(\d+) widgets/, run: t => "current price list: " + (12 * +t.match(/(\d+) widgets/)[1]).toFixed(2) },
    Recall:     { does: "recall what you were taught to answer a question", run: (t, m) => m.lesson.length ? "taught: " + m.lesson.join(" | ") : "taught: nothing" },
    Remember:   { does: "remember a fact for later", run: (t, m) => { m.lesson.push(t.replace(/^.*?:\s*/, "")); return "stored in the lesson"; } },
  };
  const LESSON = ["Remember this for later: the valve opens at 41 psi.",
                  "What were you taught about the valve?",
                  "Give me a price quote for 10 widgets for an order."];
  function choose(text, open) {            // the stand-in chooser: only ever sees what is open
    let best = null, top = 1; const w = words(text);
    for (const name of [...open].sort()) {
      const d = new Set(words(SHELF[name].does + " " + name)); const score = w.filter(x => d.has(x)).length;
      if (score > top) { top = score; best = name; }
    }
    return best;
  }
  function turn(text, open, mem, opts = {}) {   // one request against the runtime; returns what was said and which program ran
    const name = choose(text, open);
    if (!name) return { said: "I do not have a program open for that.", ran: [] };
    const p = SHELF[name];
    if (p.needs && !p.needs.test(text)) return { said: "I need one more detail before I can do that.", ran: [] };
    if (opts.saysButDoesNot === name) return { said: "Done. I have saved that for you.", ran: [] };   // seen live: the words claim it, nothing ran
    return { said: p.run(text, mem), ran: [name] };
  }
  const fresh = () => ({ lesson: [], scratch: [] });
  function run(lines, open, opts) { const mem = fresh(); return { mem, turns: lines.map(t => ({ asked: t, ...turn(t, open, mem, opts) })) }; }
  const workingSet = chat => [...new Set(chat.turns.flatMap(t => t.ran))].sort();   // the programs a saved chat actually used
  function compare(saved, now) {            // the check: which programs ran, step by step, never the wording
    const a = workingSet(saved), b = workingSet(now);
    const didNotRun = a.filter(x => !b.includes(x)), ranExtra = b.filter(x => !a.includes(x)), stepsDiffer = [];
    for (let i = 0; i < Math.max(saved.turns.length, now.turns.length); i++) {
      const was = saved.turns[i] ? saved.turns[i].ran.join(", ") : "(no such step)", is = now.turns[i] ? now.turns[i].ran.join(", ") : "(no such step)";
      if (was !== is) stepsDiffer.push({ step: i + 1, before: was || "nothing", now: is || "nothing" });
    }
    return { matches: stepsDiffer.length === 0, didNotRun, ranExtra, stepsDiffer };
  }
  function runtime(everyday = []) {         // a runtime that stays up: an everyday set that is always open, plus programs opened for a job
    let job = []; const mem = fresh(); const all = () => [...new Set([...everyday, ...job])].sort();
    return { open: names => { job = [...new Set([...job, ...names.filter(x => !everyday.includes(x))])].sort(); return all(); },
             close: () => { const was = job; job = []; return was; },   // closes what was opened for jobs, never the everyday set
             isOpen: all, ask: (text, opts) => ({ asked: text, ...turn(text, all(), mem, opts) }), mem };
  }
  return { SHELF, LESSON, choose, turn, run, runtime, workingSet, compare, everything: () => Object.keys(SHELF) };
})();
if (typeof module !== "undefined") module.exports = WS; else window.WS = WS;
