export const escapeHtml = (value: string): string => {
  const div = document.createElement('div');
  div.textContent = value;
  return div.innerHTML;
};
