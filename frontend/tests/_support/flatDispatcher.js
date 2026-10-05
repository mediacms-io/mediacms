const { Dispatcher } = require('flux');

const dispatcher = new Dispatcher();

module.exports = {
    register: (callback) => dispatcher.register(callback),
    unregister: (id) => dispatcher.unregister(id),
    waitFor: (ids) => dispatcher.waitFor(ids),
    dispatch: (payload) => dispatcher.dispatch(payload),
    isDispatching: () => dispatcher.isDispatching(),
};
