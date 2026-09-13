import fs from "node:fs";
const path = "src/handbook/logistik.md";
let text = fs.readFileSync(path, "utf8");
const from = "Lehmgräber und Steinbrecher werden im Hauptquartier zugewiesen, suchen selbständig ein freies passendes Vorkommen und wechseln nach dessen Erschöpfung zum nächsten. Pro Vorkommen arbeitet höchstens eine Person.";
const to = "Lehmgräber und Steinbrecher werden am HQ zugewiesen, suchen selbständig freie Vorkommen und wechseln nach deren Erschöpfung automatisch weiter. Pro Vorkommen arbeitet höchstens eine Person.";
if (!text.includes(from)) throw new Error("Handbook migration source not found");
fs.writeFileSync(path, text.replace(from, to));
