const mathRandomAllowedFiles = new Set(['src/ui/renderers/EffectRenderer.ts']);

export function mathRandomErrors(relativePath, source) {
  if (!relativePath.startsWith('src/') || !/\bMath\.random\s*\(/.test(source) || mathRandomAllowedFiles.has(relativePath)) {
    return [];
  }
  return [`${relativePath} calls Math.random directly. Use an injected RNG, secure random helper, or keep visual-only randomness in an allowlisted renderer.`];
}
