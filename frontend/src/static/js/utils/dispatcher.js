const callbacks = new Map();
let lastId = 0;
let dispatching = false;

export function register(callback) {
  lastId += 1;
  const id = `ID_${lastId}`;
  callbacks.set(id, callback);
  return id;
}

export function unregister(id) {
  callbacks.delete(id);
}

export function dispatch(payload) {
  if (dispatching) {
    throw new Error('Dispatch.dispatch(...): Cannot dispatch in the middle of a dispatch.');
  }
  dispatching = true;
  try {
    for (const callback of [...callbacks.values()]) {
      callback(payload);
    }
  } finally {
    dispatching = false;
  }
}

export default { register, unregister, dispatch };
