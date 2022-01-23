export function itemClassname(defaultClassname, inheritedClassname, isActiveInPlaylistPlayback) {
  let classname = defaultClassname;

  if ('' !== inheritedClassname) {
    classname += ' ' + inheritedClassname;
  }

  if (isActiveInPlaylistPlayback) {
    classname += ' pl-active-item';
  }

  return classname;
}
