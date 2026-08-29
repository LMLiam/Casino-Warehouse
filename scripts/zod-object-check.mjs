import ts from 'typescript';

export function zodObjectErrors(relativePath, source) {
  if (!isCheckedPath(relativePath)) {
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
    if (ts.isCallExpression(node) && isZodObjectCall(node) && !hasStrictCall(node)) {
      const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
      errors.push(`${relativePath}:${line + 1}:${character + 1} calls z.object without .strict(). Add .strict() to reject unrecognised keys.`);
    }

    ts.forEachChild(node, visit);
  }

  function isZodObjectCall(node) {
    return (
      ts.isPropertyAccessExpression(node.expression) &&
      ts.isIdentifier(node.expression.expression) &&
      node.expression.expression.text === 'z' &&
      node.expression.name.text === 'object'
    );
  }

  function hasStrictCall(node) {
    let current = node;
    while (current.parent) {
      const parent = current.parent;
      if (ts.isPropertyAccessExpression(parent) && parent.expression === current) {
        if (parent.name.text === 'strict' && isCalled(parent)) {
          return true;
        }
        current = parent;
        continue;
      }
      if (ts.isCallExpression(parent) && parent.expression === current) {
        current = parent;
        continue;
      }
      return false;
    }
    return false;
  }

  function isCalled(propertyAccess) {
    const parent = propertyAccess.parent;
    return ts.isCallExpression(parent) && parent.expression === propertyAccess;
  }
}

function isCheckedPath(relativePath) {
  return /^src\/.*\.tsx?$/.test(relativePath) || /^tests\/.*\.tsx?$/.test(relativePath);
}
