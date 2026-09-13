import fs from "node:fs";
const path = "src/simulation/simulation.ts";
let text = fs.readFileSync(path, "utf8");
const stale = `  const progress = workers
      .filter((p) => p.progress > 0)
      .map((p) => \`${'${'}Math.round((p.progress / b.recipe!.duration) * 100)} %\`);
    if (progress.length) return \`Holzabbau: ${'${'}progress.join(" · ")}\`;
    if (!workers.length) return "Kein Holzfäller am Wald";
    if (outputOccupied(w, b) >= outputCapacityFor(b))
      return "Holz liegt bereit – Abholung abwarten";
    if (workers.every((p) => !p.active)) return "Holzfäller auf dem Weg";
    return "Bereit zum Holzabbau";
  }
`;
if (!text.includes(stale)) throw new Error("Stale forest status block not found");
fs.writeFileSync(path, text.replace(stale, ""));
