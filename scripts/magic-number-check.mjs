import ts from 'typescript';

const neutralInlineNumbers = new Set(['-1', '0', '0.5', '1', '2']);
const allowCommentPattern = /casino-magic-number-allow:\s+\S+/;

export function magicNumberErrors(relativePath, source) {
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
    if (isNumericLiteralLike(node) && !isAllowedNumber(node)) {
      const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
      errors.push(
        `${relativePath}:${line + 1}:${character + 1} uses unexplained numeric literal ${numericLiteralText(
          node,
        )}. Name the value with a domain constant/config/fixture, or add "casino-magic-number-allow: <reason>" for an intentional inline exception.`,
      );
    }

    ts.forEachChild(node, visit);
  }

  function isAllowedNumber(node) {
    return (
      neutralInlineNumbers.has(numericLiteralText(node)) ||
      hasAllowComment(node) ||
      isTestCaseData(node) ||
      isTypePosition(node) ||
      isNamedDeclarationInitializer(node) ||
      isNamedObjectPropertyValue(node) ||
      isEnumMemberInitializer(node) ||
      isObjectPropertyName(node) ||
      isImportExportAssertionValue(node)
    );
  }

  function hasAllowComment(node) {
    const line = lineTextForNode(node);
    return allowCommentPattern.test(line);
  }

  function isTestCaseData(node) {
    if (!relativePath.startsWith('tests/')) {
      return false;
    }

    let current = node.parent;
    while (current) {
      if (ts.isArrowFunction(current) || ts.isFunctionExpression(current)) {
        if (isTestCallback(current)) {
          return true;
        }
      }
      current = current.parent;
    }
    return false;
  }

  function isTestCallback(node) {
    const call = node.parent;
    if (!ts.isCallExpression(call)) {
      return false;
    }

    const callbackIndex = call.arguments.findIndex((argument) => argument === node);
    return callbackIndex > 0 && testCallbackCallees().has(calleeName(call.expression));
  }

  function lineTextForNode(node) {
    const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
    return sourceFile.text.split('\n')[line] ?? '';
  }

  function isNamedDeclarationInitializer(node) {
    let current = node;
    while (current.parent) {
      const parent = current.parent;
      if (ts.isVariableDeclaration(parent)) {
        return parent.initializer && nodeIsWithin(node, parent.initializer) && isConstDeclaration(parent);
      }
      if (ts.isPropertyDeclaration(parent)) {
        return parent.initializer && nodeIsWithin(node, parent.initializer) && hasReadonlyOrStaticModifier(parent);
      }
      if (ts.isParameter(parent)) {
        return Boolean(parent.initializer && nodeIsWithin(node, parent.initializer));
      }
      if (ts.isClassLike(parent)) {
        return false;
      }
      current = parent;
    }
    return false;
  }

  function isTypePosition(node) {
    let current = node;
    while (current.parent) {
      const parent = current.parent;
      if (ts.isLiteralTypeNode(parent) || ts.isTupleTypeNode(parent) || ts.isTypeAliasDeclaration(parent) || ts.isInterfaceDeclaration(parent)) {
        return true;
      }
      if (ts.isExpressionStatement(parent) || ts.isReturnStatement(parent) || ts.isVariableDeclaration(parent) || ts.isCallExpression(parent)) {
        return false;
      }
      current = parent;
    }
    return false;
  }

  function isEnumMemberInitializer(node) {
    return ts.isEnumMember(node.parent) && node.parent.initializer === node;
  }

  function isNamedObjectPropertyValue(node) {
    return ts.isPropertyAssignment(node.parent) && node.parent.initializer === node && !ts.isNumericLiteral(node.parent.name);
  }

  function isObjectPropertyName(node) {
    return (ts.isPropertyAssignment(node.parent) || ts.isPropertySignature(node.parent) || ts.isMethodDeclaration(node.parent)) && node.parent.name === node;
  }

  function isImportExportAssertionValue(node) {
    return ts.isImportAttribute(node.parent) && node.parent.value === node;
  }
}

function isCheckedPath(relativePath) {
  return /^src\/.*\.tsx?$/.test(relativePath) || /^tests\/.*\.ts$/.test(relativePath) || /^scripts\/.*\.mjs$/.test(relativePath);
}

function isNumericLiteralLike(node) {
  return (ts.isNumericLiteral(node) && !isNegativeNumericLiteral(node.parent)) || isNegativeNumericLiteral(node);
}

function isNegativeNumericLiteral(node) {
  return ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.MinusToken && ts.isNumericLiteral(node.operand);
}

function numericLiteralText(node) {
  return isNegativeNumericLiteral(node) ? `-${node.operand.getText()}` : node.getText();
}

function isConstDeclaration(node) {
  return Boolean(node.parent && ts.isVariableDeclarationList(node.parent) && (node.parent.flags & ts.NodeFlags.Const) !== 0);
}

function hasReadonlyOrStaticModifier(node) {
  return Boolean(node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ReadonlyKeyword || modifier.kind === ts.SyntaxKind.StaticKeyword));
}

function nodeIsWithin(node, ancestor) {
  return node.pos >= ancestor.pos && node.end <= ancestor.end;
}

function testCallbackCallees() {
  return new Set(['describe', 'describe.skip', 'describe.only', 'it', 'it.skip', 'it.only', 'test', 'test.skip', 'test.only']);
}

function calleeName(node) {
  if (ts.isIdentifier(node)) {
    return node.text;
  }
  if (ts.isPropertyAccessExpression(node)) {
    const parentName = calleeName(node.expression);
    return parentName ? `${parentName}.${node.name.text}` : node.name.text;
  }
  return undefined;
}
