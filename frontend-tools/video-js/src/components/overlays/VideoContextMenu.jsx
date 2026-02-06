import React, { useEffect, useRef } from 'react';
import './VideoContextMenu.css';

function VideoContextMenu({ visible, position, onClose, onCopyVideoUrl, onCopyVideoUrlAtTime, onCopyEmbedCode }) {
    const menuRef = useRef(null);

    useEffect(() => {
        if (visible && menuRef.current) {
            // Position the menu
            menuRef.current.style.left = `${position.x}px`;
            menuRef.current.style.top = `${position.y}px`;

            // Adjust if menu goes off screen
            const rect = menuRef.current.getBoundingClientRect();
            const windowWidth = window.innerWidth;
            const windowHeight = window.innerHeight;

            if (rect.right > windowWidth) {
                menuRef.current.style.left = `${position.x - rect.width}px`;
            }
            if (rect.bottom > windowHeight) {
                menuRef.current.style.top = `${position.y - rect.height}px`;
            }
        }
    }, [visible, position]);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (visible && menuRef.current && !menuRef.current.contains(e.target)) {
                onClose();
            }
        };

        const handleEscape = (e) => {
            if (e.key === 'Escape' && visible) {
                onClose();
            }
        };

        if (visible) {
            // Use capture phase to catch events earlier, before they can be stopped
            // Listen to both mousedown and click to ensure we catch all clicks
            document.addEventListener('mousedown', handleClickOutside, true);
            document.addEventListener('click', handleClickOutside, true);
            document.addEventListener('keydown', handleEscape);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside, true);
            document.removeEventListener('click', handleClickOutside, true);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [visible, onClose]);

    if (!visible) return null;

    return (
        <div ref={menuRef} className="video-context-menu" onClick={(e) => e.stopPropagation()}>
            <div className="video-context-menu-item" onClick={onCopyVideoUrl}>
                <svg className="video-context-menu-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span>Copy video URL</span>
            </div>
            <div className="video-context-menu-item" onClick={onCopyVideoUrlAtTime}>
                <svg className="video-context-menu-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span>Copy video URL at current time</span>
            </div>
            <div className="video-context-menu-item" onClick={onCopyEmbedCode}>
                <svg className="video-context-menu-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M16 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M8 6l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span>Copy embed code</span>
            </div>
        </div>
    );
}

export default VideoContextMenu;

