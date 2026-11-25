// Public release bodies come from the user-facing history, never the release audit.
const fs = require('node:fs');
const path = require('node:path');

const historyFile = path.join(__dirname, '../docs/releases/release-notes.md');

function getReleaseNotes(tag, history = fs.readFileSync(historyFile, 'utf8')) {
  if (!/^v\d+\.\d+$/.test(tag)) throw new Error('Expected a release tag such as v6.9');
  const version = tag.slice(1);
  // Template headings use the same level, so only dated version headings delimit releases.
  const headings = [...history.matchAll(/^## (\d+\.\d+) · \d{4}-\d{2}-\d{2}[ \t]*\r?$/gm)];
  const sections = headings.map((heading, index) => ({
    version: heading[1],
    body: history.slice(heading.index + heading[0].length, headings[index + 1]?.index ?? history.length),
  })).filter(section => section.version === version);
  if (sections.length !== 1) throw new Error(`Expected exactly one release notes section for ${tag}`);
  const body = sections[0].body.replace(/\r\n/g, '\n')
    .replace(/^(?:[ \t]*\n)+/, '').replace(/(?:\n[ \t]*)+$/, '');
  const lines = body.trim().split('\n').filter(line => line.trim());
  if (!lines.length) throw new Error(`${tag} release notes must not be empty`);
  if (lines.every(line => /^- \S/.test(line))) return `${lines.join('\n')}\n`;
  if (!/^## 📢 版本概述[ \t]*\n/.test(body)) {
    throw new Error(`${tag} release notes must be a user-facing list or start with the version overview template`);
  }
  if (/^#(?:[ \t]+|$)/m.test(body)) {
    throw new Error(`${tag} release notes must not repeat the release title as a level-one heading`);
  }
  const blocks = body.split(/^## [^\n]*(?:\n|$)/m).slice(1);
  if (/^##[ \t]*$/m.test(body) || blocks.some(block => !block.split('\n').some(line =>
    line.trim() && !/^(?:#{1,6}(?:\s|$)|-{3,}\s*$)/.test(line)))) {
    throw new Error(`${tag} release notes must not contain empty template sections`);
  }
  return `${body}\n`;
}

if (require.main === module) {
  try {
    const notes = getReleaseNotes(process.argv[2]);
    if (process.argv[3]) fs.writeFileSync(process.argv[3], notes, 'utf8');
    else process.stdout.write(notes);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { getReleaseNotes };
