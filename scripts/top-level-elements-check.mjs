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

  const elements = exportedTopLevelElements(sourceFile);
  if (elements.length <= 1) {
    return [];
  }

  return [
    `${relativePath} exports ${elements.length} top-level elements (${elements.map((element) => element.name).join(', ')}). Keep one primary exported element per file.`,
  ];
}

function exportedTopLevelElements(sourceFile) {
  return sourceFile.statements.flatMap((statement) => {
    if (!isExported(statement)) {
      return [];
    }

    if (ts.isVariableStatement(statement)) {
      return statement.declarationList.declarations.map((declaration) => ({
        kind: 'const',
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

function isExported(statement) {
  return statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) ?? false;
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
