#!/usr/bin/env node
import fs from "node:fs";

const version = process.argv[2];
if (!version) {
  console.error("Usage: extract-release-notes.mjs <version>");
  process.exit(1);
}

if (!fs.existsSync("CHANGELOG.md")) {
  process.stdout.write(`Release ${version}.`);
  process.exit(0);
}

const log = fs.readFileSync("CHANGELOG.md", "utf8");
const escaped = version.replace(/\./g, "\\.");
const heading = new RegExp(`## \\[?${escaped}\\]?[^\\n]*\\n([\\s\\S]*?)(?=\\n## |$)`);
const match = log.match(heading);

process.stdout.write(match ? match[1].trim() : `Release ${version}.`);
