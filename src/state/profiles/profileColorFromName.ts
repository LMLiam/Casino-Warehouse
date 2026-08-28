export const profileColorFromName = (name: string): string => {
  const colors = ['#ffd56b', '#75ff92', '#26f0ff', '#ff8ac6', '#b48cff', '#ffb13b'];
  const total = [...name].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const color = colors[total % colors.length];
  if (!color) {
    throw new Error('Profile color palette is invalid.');
  }
  return color;
};
