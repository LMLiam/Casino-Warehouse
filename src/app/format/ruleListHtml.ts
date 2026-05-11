import { escapeHtml } from '../../shared/html';

export const renderRuleList = (items: readonly string[]): string => `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
