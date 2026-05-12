import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, extname, join, normalize, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mathRandomErrors } from './math-random-check.mjs';
import { topLevelElementErrors } from './top-level-elements-check.mjs';

const workspaceRoot = resolve(new URL('..', import.meta.url).pathname);
const sourceRoot = join(workspaceRoot, 'src');
const testRoot = join(workspaceRoot, 'tests');
const trackedTypeScriptFiles = gitTrackedTypeScriptFiles();
const sourceFiles = listFiles(sourceRoot).filter((file) => ['.ts', '.tsx'].includes(extname(file)) && !file.endsWith('.d.ts'));
const testFiles = listFiles(testRoot).filter((file) => ['.ts', '.tsx'].includes(extname(file)) && !file.endsWith('.d.ts'));
const relativeSourceFiles = new Set(sourceFiles.map(toWorkspacePath));
const errors = [];
const appModuleFolders = new Set(['actions', 'dom', 'format', 'input', 'rooms', 'shell', 'state', 'views']);
const testSuiteFolders = new Set(['e2e', 'unit']);
const unitTestDomainFolders = new Set(['app', 'assets', 'audio', 'game', 'multiplayer', 'schemas', 'state']);

function main() {
  for (const file of sourceFiles) {
    const relativePath = toWorkspacePath(file);
    const source = readFileSync(file, 'utf8');

    checkImportBoundaries(relativePath, source);
    checkMathRandom(relativePath, source);
    checkBankrollMutation(relativePath, source);
    checkUiPayoutDuplication(relativePath, source);
    checkTopLevelElementCount(relativePath, source);
    checkFileSize(relativePath, source);
    checkVagueFilename(relativePath);
    checkAppFolderLayout(relativePath);
  }

  checkDirectUnknownCasts();
  checkTestFolderLayout();
  checkCycles();

  if (errors.length > 0) {
    console.error(['Architecture check failed:', ...errors.map((error) => `- ${error}`)].join('\n'));
    process.exit(1);
  }

  console.log(`Architecture check passed for ${sourceFiles.length} source files.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}

function checkImportBoundaries(relativePath, source) {
  for (const specifier of importSpecifiers(source)) {
    const importedPath = resolveImport(relativePath, specifier);
    if (!importedPath) {
      continue;
    }

    if (
      relativePath.startsWith('src/game/') &&
      (importedPath.startsWith('src/ui/') || importedPath.startsWith('src/app/') || importedPath.startsWith('src/multiplayer/'))
    ) {
      errors.push(`${relativePath} imports forbidden upper-layer module ${importedPath}. Game engines must stay UI/server independent.`);
    }

    if (
      (relativePath.startsWith('src/multiplayer/') || relativePath.startsWith('src/state/')) &&
      (importedPath.startsWith('src/ui/') || importedPath.startsWith('src/app/'))
    ) {
      errors.push(`${relativePath} imports forbidden UI/app module ${importedPath}. Multiplayer and state modules must stay UI independent.`);
    }

    if (relativePath.startsWith('src/ui/') && importedPath.startsWith('src/app/')) {
      errors.push(`${relativePath} imports app shell module ${importedPath}. UI primitives should not depend on the application coordinator.`);
    }
  }
}

function checkMathRandom(relativePath, source) {
  errors.push(...mathRandomErrors(relativePath, source));
}

function checkBankrollMutation(relativePath, source) {
  const allowed = new Set(['src/game/engine/BeatTheHouseGame.ts', 'src/multiplayer/roomAuthority.ts']);
  const mutatesBankroll = /\bthis\.bankroll\s*(?:[+\-*/]?=|\+\+|--)|\.bankroll\s*(?:[+\-*/]?=|\+\+|--)/.test(source);
  if (mutatesBankroll && !allowed.has(relativePath)) {
    errors.push(`${relativePath} mutates bankroll directly. Route changes through the authorised game/room/profile ledger modules.`);
  }
}

function checkUiPayoutDuplication(relativePath, source) {
  if (!relativePath.startsWith('src/ui/')) {
    return;
  }

  const forbiddenPatterns = [
    /\bwholeChipPayout\b/,
    /\blinePayout\b/,
    /\bjackpotPayout\b/,
    /\bsettleSeat\b/,
    /\bsettleHandReturn\b/,
    /\b(?:3|4|9|10|18|50|120|150|1000):1\b/,
    /\b3:2\b/,
  ];
  if (forbiddenPatterns.some((pattern) => pattern.test(source))) {
    errors.push(`${relativePath} appears to duplicate payout or settlement logic in the UI layer.`);
  }
}

function checkTopLevelElementCount(relativePath, source) {
  errors.push(...topLevelElementErrors(relativePath, source));
}

function checkFileSize(relativePath, source) {
  const lines = source.split('\n').length;
  if (lines <= 700) {
    return;
  }
  errors.push(`${relativePath} has ${lines} lines. Split files above 700 lines.`);
}

function checkVagueFilename(relativePath) {
  if (/(^|\/)(utils?|helpers?|misc|manager)\.(ts|tsx)$/.test(relativePath)) {
    errors.push(`${relativePath} has a vague filename. Use a domain-specific module name.`);
  }
}

function checkAppFolderLayout(relativePath) {
  if (!relativePath.startsWith('src/app/')) {
    return;
  }

  const parts = relativePath.split('/');
  const folder = parts[2];
  if (parts.length < 4 || !appModuleFolders.has(folder)) {
    errors.push(`${relativePath} is not in an approved app folder. Use one of: ${[...appModuleFolders].sort().join(', ')}.`);
  }
}

function checkDirectUnknownCasts() {
  for (const file of trackedTypeScriptFiles) {
    const relativePath = toWorkspacePath(file);
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(/\bas\s+unknown\b/g)) {
      const line = source.slice(0, match.index).split('\n').length;
      errors.push(`${relativePath}:${line} uses a direct cast through unknown. Use validation, typed fakes, or a named escape-hatch helper instead.`);
    }
  }
}

function gitTrackedTypeScriptFiles() {
  return execFileSync('git', ['ls-files', '*.ts', '*.tsx'], { cwd: workspaceRoot, encoding: 'utf8' })
    .split('\n')
    .filter((path) => path && !path.endsWith('.d.ts'))
    .map((path) => resolve(workspaceRoot, path));
}

function checkTestFolderLayout() {
  for (const file of testFiles) {
    const relativePath = toWorkspacePath(file);
    const parts = relativePath.split('/');
    const suiteFolder = parts[1];
    if (!testSuiteFolders.has(suiteFolder)) {
      errors.push(`${relativePath} is not in an approved test suite folder. Use tests/unit/<domain>/ or tests/e2e/.`);
      continue;
    }
    if (suiteFolder === 'unit' && !unitTestDomainFolders.has(parts[2])) {
      errors.push(`${relativePath} is not in an approved unit test domain folder. Use one of: ${[...unitTestDomainFolders].sort().join(', ')}.`);
    }
  }
}

function checkCycles() {
  const graph = new Map();
  for (const file of sourceFiles) {
    const relativePath = toWorkspacePath(file);
    graph.set(
      relativePath,
      importSpecifiers(readFileSync(file, 'utf8'))
        .map((specifier) => resolveImport(relativePath, specifier))
        .filter((specifier) => specifier && relativeSourceFiles.has(specifier)),
    );
  }

  const visiting = new Set();
  const visited = new Set();
  const stack = [];

  for (const node of graph.keys()) {
    visit(node);
  }

  function visit(node) {
    if (visited.has(node)) {
      return;
    }
    if (visiting.has(node)) {
      const cycle = stack.slice(stack.indexOf(node)).concat(node);
      errors.push(`Circular dependency detected: ${cycle.join(' -> ')}`);
      return;
    }

    visiting.add(node);
    stack.push(node);
    for (const next of graph.get(node) ?? []) {
      visit(next);
    }
    stack.pop();
    visiting.delete(node);
    visited.add(node);
  }
}

function importSpecifiers(source) {
  const specifiers = [];
  const patterns = [
    /import\s+(?:type\s+)?[\s\S]*?\s+from\s+['"]([^'"]+)['"]/g,
    /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /export\s+[\s\S]*?\s+from\s+['"]([^'"]+)['"]/g,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      specifiers.push(match[1]);
    }
  }
  return specifiers;
}

function resolveImport(fromRelativePath, specifier) {
  if (!specifier.startsWith('.')) {
    return undefined;
  }

  const base = resolve(workspaceRoot, dirname(fromRelativePath), specifier);
  const candidates = [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), join(base, 'index.tsx')];
  const match = candidates.find((candidate) => existsSync(candidate));
  return match ? toWorkspacePath(match) : undefined;
}

function listFiles(dir, ignoredNames = new Set()) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (ignoredNames.has(name)) {
      return [];
    }
    return statSync(path).isDirectory() ? listFiles(path, ignoredNames) : [path];
  });
}

function toWorkspacePath(path) {
  return normalize(relative(workspaceRoot, path)).replaceAll('\\', '/');
}
