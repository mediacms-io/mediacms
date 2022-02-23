import React from 'react';

export default class Daw extends React.PureComponent {
    constructor(props) {
        super(props);
    }

    render() {
        return (
            <div className="daw-container" key="daw-container">
                <span>DAW</span>
            </div>
        );
    }
}