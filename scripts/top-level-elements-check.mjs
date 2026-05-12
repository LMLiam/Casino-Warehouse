import ts from 'typescript';

export function topLevelElementErrors(relativePath, source) {
  const sourceFile = ts.createSourceFile(
    relativePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    relativePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );

  if (isReExportOnlyModule(sourceFile)) {
    return [`${relativePath} only re-exports declarations from other modules. Import focused module files directly instead.`];
  }

  const elements = topLevelElements(sourceFile);
  if (elements.length <= 1) {
    return [];
  }

  return [
    `${relativePath} declares ${elements.length} top-level elements (${elements.map((element) => element.name).join(', ')}). Keep one module-scope element per file.`,
  ];
}

function topLevelElements(sourceFile) {
  return sourceFile.statements.flatMap((statement) => {
    if (ts.isVariableStatement(statement)) {
      return statement.declarationList.declarations.map((declaration) => ({
        kind: variableDeclarationKind(statement),
        name: declaration.name.getText(sourceFile),
      }));
    }

    if (ts.isClassDeclaration(statement)) {
      return [{ kind: 'class', name: statement.name?.text ?? 'default class' }];
    }
    if (ts.isFunctionDeclaration(statement)) {
      return [{ kind: 'function', name: statement.name?.text ?? 'default function' }];
    }
    if (ts.isInterfaceDeclaration(statement)) {
      return [{ kind: 'interface', name: statement.name.text }];
    }
    if (ts.isTypeAliasDeclaration(statement)) {
      return [{ kind: 'type', name: statement.name.text }];
    }
    if (ts.isEnumDeclaration(statement)) {
      return [{ kind: 'enum', name: statement.name.text }];
    }

    return [];
  });
}

function variableDeclarationKind(statement) {
  if ((statement.declarationList.flags & ts.NodeFlags.Const) !== 0) {
    return 'const';
  }
  if ((statement.declarationList.flags & ts.NodeFlags.Let) !== 0) {
    return 'let';
  }
  return 'var';
}

function isReExportOnlyModule(sourceFile) {
  const meaningfulStatements = sourceFile.statements.filter((statement) => statement.kind !== ts.SyntaxKind.NotEmittedStatement);
  if (meaningfulStatements.length === 0) {
    return false;
  }
  return (
    meaningfulStatements.every((statement) => ts.isExportDeclaration(statement) || ts.isImportDeclaration(statement)) &&
    meaningfulStatements.some((statement) => ts.isExportDeclaration(statement))
  );
}
