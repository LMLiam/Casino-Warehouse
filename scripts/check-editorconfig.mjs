#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const path = '.editorconfig';
const contents = readFileSync(path, 'utf8');
const failures = [];

if (contents.includes('\r')) {
  failures.push(`${path} must use LF line endings.`);
}

if (!contents.endsWith('\n')) {
  failures.push(`${path} must end with a newline.`);
}

contents.split('\n').forEach((line, index) => {
  if (/[ \t]+$/.test(line)) {
    failures.push(`${path}:${index + 1} must not contain trailing whitespace.`);
  }

  if (/^\t/.test(line)) {
    failures.push(`${path}:${index + 1} must not be indented with tabs.`);
  }
});

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(failure);
  }

  process.exit(1);
}

console.log(`${path} formatting looks good.`);
