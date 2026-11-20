// Working Sets: the dependency-free check. node scripts/check.mjs
import { createRequire } from "node:module";
const WS = createRequire(import.meta.url)("../play/core.js");
let pass = 0, total = 0;
const check = (name, ok) => { total++; pass += !!ok; console.log((ok ? "PASS " : "FAIL ") + name); };
const set = ["Quote", "Recall", "Remember"];
const saved = WS.run(WS.LESSON, set);                       // the job done once, with only what it needs open
check("the job done once runs three programs, one per line", saved.turns.map(t => t.ran[0]).join() === "Remember,Recall,Quote");
check("the saved chat's working set is the three programs that ran, out of six on the shelf", WS.workingSet(saved).join() === set.join() && WS.everything().length === 6);
const again = WS.run(WS.LESSON, WS.workingSet(saved));       // replay with only the working set open
check("replayed with only its working set open, every line runs the same program", WS.compare(saved, again).matches);
check("a fresh learner holds the fact after the replay and answers from it", again.mem.lesson.length === 1 && again.turns[1].said.includes("41 psi"));
check("the replayed quote uses the current price list", again.turns[2].said === "current price list: 120.00");
const all = WS.run(WS.LESSON, WS.everything());              // everything open at once
const c1 = WS.compare(saved, all);
check("with everything open, look-alikes are picked instead and the check names them", !c1.matches && c1.ranExtra.join() === "Notes,PriceQuote" && c1.didNotRun.join() === "Quote,Remember");
check("with everything open, the fact lands in the wrong place and the quote uses the old list", all.mem.lesson.length === 0 && all.turns[2].said.startsWith("old price list"));
const short = WS.run([WS.LESSON[0], WS.LESSON[1], "Give me a price quote for widgets for an order."], set);
const c2 = WS.compare(saved, short);
check("with the amount left out, the quote program does not run and the check names it", !c2.matches && c2.didNotRun.join() === "Quote" && short.turns[2].ran.length === 0);
const lie = WS.run(WS.LESSON, set, { saysButDoesNot: "Remember" });
const c3 = WS.compare(saved, lie);
check("a reply that says it saved, with nothing run, reads fine and is still caught by the check", /saved/.test(lie.turns[0].said) && !c3.matches && c3.didNotRun.join() === "Remember");
check("and the learner then cannot answer, which the words alone would have hidden", lie.turns[1].said === "taught: nothing");
const none = WS.run(WS.LESSON, []);
check("with nothing open, every line is turned down in plain words", none.turns.length === 3 && none.turns.every(t => t.ran.length === 0 && /do not have a program open/.test(t.said)));
// the comparison is step by step: the same programs in a different order, or a different number of steps, do not match
const swapped = { turns: [saved.turns[1], saved.turns[0], saved.turns[2]] };
const c4 = WS.compare(saved, swapped);
check("the same programs in a different order do not match, and the differing steps are named", !c4.matches && c4.didNotRun.length === 0 && c4.ranExtra.length === 0 && c4.stepsDiffer.map(d => d.step).join() === "1,2");
const fewer = { turns: saved.turns.slice(0, 2) }, twice = { turns: [...saved.turns, saved.turns[2]] };
check("a step missing from the end does not match", !WS.compare(saved, fewer).matches && WS.compare(saved, fewer).stepsDiffer[0].step === 3);
check("a program run one extra time does not match, though the set of programs is the same", !WS.compare(saved, twice).matches && WS.compare(saved, twice).ranExtra.length === 0);
// one runtime that stays up: open for the job, use, close; what was stored outlives the program that stored it
const rt = WS.runtime();
check("before anything is opened, the request is turned down", rt.ask(WS.LESSON[0]).ran.length === 0);
rt.open(WS.workingSet(saved));
const live = { turns: WS.LESSON.map(t => rt.ask(t)) };
check("opened for the job, the same runtime does it and the check matches", rt.isOpen().join() === set.join() && WS.compare(saved, live).matches);
check("closing returns exactly what was opened and leaves nothing open", rt.close().join() === set.join() && rt.isOpen().length === 0);
check("after closing, the same request is turned down again, and the stored fact is still there", rt.ask(WS.LESSON[1]).ran.length === 0 && rt.mem.lesson.length === 1);
rt.open(["Recall"]);
check("opened again later, a program finds what an earlier one stored", rt.ask(WS.LESSON[1]).said.includes("41 psi"));
// an everyday set stays open through every job; a second job's programs join the first's; a number that is not the amount does not count
const home = WS.runtime(["Convert"]);
home.open(["Remember"]); home.open(["Recall"]);
check("opening a second set keeps the first, and the everyday program stays open beside them", home.isOpen().join() === "Convert,Recall,Remember");
check("closing removes only what was opened for jobs and leaves the everyday set", home.close().join() === "Recall,Remember" && home.isOpen().join() === "Convert");
const odd = WS.run(["Give me a price quote for widgets for order 123."], set);
check("a number that is not the amount does not stand in for it: the quote does not run", odd.turns.length === 1 && odd.turns[0].ran.length === 0);
console.log(`${pass} of ${total}`); process.exit(pass === total ? 0 : 1);
