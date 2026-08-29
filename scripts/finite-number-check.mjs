import ts from 'typescript';

const sharedFiniteNumberPath = 'src/schemas/casinoSchemas/finiteNumberSchema.ts';

export function finiteNumberErrors(relativePath, source) {
  if (!isCheckedPath(relativePath) || relativePath === sharedFiniteNumberPath) {
    return [];
  }

  const sourceFile = ts.createSourceFile(
    relativePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    relativePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const errors = [];

  visit(sourceFile);

  return errors;

  function visit(node) {
    if (isDirectFiniteNumberCall(node)) {
      const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
      errors.push(
        `${relativePath}:${line + 1}:${character + 1} uses z.number().finite() directly. Import finiteNumberSchema from src/schemas/casinoSchemas/finiteNumberSchema instead.`,
      );
    }

    ts.forEachChild(node, visit);
  }

  function isDirectFiniteNumberCall(node) {
    if (
      !ts.isCallExpression(node) ||
      node.arguments.length !== 0 ||
      !ts.isPropertyAccessExpression(node.expression) ||
      node.expression.name.text !== 'finite'
    ) {
      return false;
    }

    const numberCall = node.expression.expression;
    return (
      ts.isCallExpression(numberCall) &&
      numberCall.arguments.length === 0 &&
      ts.isPropertyAccessExpression(numberCall.expression) &&
      numberCall.expression.name.text === 'number' &&
      ts.isIdentifier(numberCall.expression.expression) &&
      numberCall.expression.expression.text === 'z'
    );
  }
}

function isCheckedPath(relativePath) {
  return /^src\/.*\.tsx?$/.test(relativePath) || /^tests\/.*\.tsx?$/.test(relativePath);
}
