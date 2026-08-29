import ts from 'typescript';

export function stateLoaderErrors(relativePath, source) {
  if (!isStateLoaderPath(relativePath)) {
    return [];
  }

  const sourceFile = ts.createSourceFile(relativePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const errors = [];

  visit(sourceFile);

  return errors;

  function visit(node) {
    if (ts.isThrowStatement(node)) {
      const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
      errors.push(
        `${relativePath}:${line + 1}:${character + 1} throws from a state loader. Return a Result and let the caller recover or delete invalid state.`,
      );
    }

    ts.forEachChild(node, visit);
  }
}

function isStateLoaderPath(relativePath) {
  return /^src\/state\/(?:[^/]+\/)*load[^/]*\.tsx?$/.test(relativePath);
}
