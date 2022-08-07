import React from "react";

export default function DawSync() {
    return (
        <div className="daw-sync-outer">
            <div className="daw-sync" id="daw-sync">
                <button type="button" id="btn-drop" className="btn btn-outline-dark" title="Sync voice changes"
                    onClick={(event) => {
                        // TODO:
                        // Sync voices with database.
                        // Delete removed ones. Add new ones.
                        console.log('Sync voices with databse...')
                    }}
                >
                    <i className="fas fa-sync"></i>
                </button>
            </div>
        </div>
    );
}
