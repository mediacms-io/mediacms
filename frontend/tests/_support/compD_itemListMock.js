const React = require('react');

const calls = [];

function ItemList(props) {
    calls.push(props);
    return React.createElement('div', { className: 'mock-item-list ' + (props.className || ''), 'data-items': (props.items || []).length });
}

module.exports = { ItemList, __calls: calls };
