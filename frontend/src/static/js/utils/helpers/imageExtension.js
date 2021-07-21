export const imageExtension = (img) => {
  if (!img) {
    return;
  }
  const ext = img.split('.');
  return ext[ext.length - 1];
};
