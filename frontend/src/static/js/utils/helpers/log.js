const log = (...x) => console[x[0]](...x.slice(1));

export const warn = (...x) => log('warn', ...x);
export const error = (...x) => log('error', ...x);
