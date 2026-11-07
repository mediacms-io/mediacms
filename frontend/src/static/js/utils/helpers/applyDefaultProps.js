export function applyDefaultProps(props, defaults) {
  const resolved = { ...props };
  for (const key of Object.keys(defaults)) {
    if (resolved[key] === undefined) {
      resolved[key] = defaults[key];
    }
  }
  return resolved;
}
