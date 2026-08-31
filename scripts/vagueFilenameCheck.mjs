export function checkVagueFilename(relativePath) {
  if (/(^|\/)[^/]*(?:util(?:s)?|helper(?:s)?|misc|manager)[^/]*\.(ts|tsx)$/i.test(relativePath)) {
    return `${relativePath} has a vague filename. Use a domain-specific module name.`;
  }
  return undefined;
}
