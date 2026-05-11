import { describe, expect, it } from 'vitest';

import { escapeHtml } from '../../../src/shared/html';

describe('escapeHtml', () => {
  it('escapes text and quoted attribute delimiters', () => {
    expect(escapeHtml(`"<script data-x='1'>&</script>`)).toBe('&quot;&lt;script data-x=&#39;1&#39;&gt;&amp;&lt;/script&gt;');
  });
});
