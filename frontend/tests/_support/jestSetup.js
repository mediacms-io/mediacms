const { TextDecoder, TextEncoder } = require('util');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

if (typeof globalThis.TextEncoder === 'undefined') {
    globalThis.TextEncoder = TextEncoder;
    globalThis.TextDecoder = TextDecoder;
}

if (typeof globalThis.MessageChannel === 'undefined') {
    globalThis.MessageChannel = class MessageChannel {
        constructor() {
            this.port1 = { onmessage: null, close() {} };
            this.port2 = {
                postMessage: (data) => setTimeout(() => this.port1.onmessage && this.port1.onmessage({ data }), 0),
                close() {},
            };
        }
    };
}
