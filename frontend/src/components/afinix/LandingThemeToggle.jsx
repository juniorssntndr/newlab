import React from 'react';

export default function LandingThemeToggle({ theme, onToggle }) {
    const isDark = theme === 'dark';
    return (
        <button
            type="button"
            className="afinix-theme-toggle"
            onClick={onToggle}
            aria-label={isDark ? 'Activar modo claro' : 'Activar modo oscuro'}
            title={isDark ? 'Modo claro' : 'Modo oscuro'}
        >
            <span className="afinix-theme-toggle-track" aria-hidden="true">
                <span className="afinix-theme-toggle-thumb" />
            </span>
            <i className={`bi ${isDark ? 'bi-moon-stars-fill' : 'bi-sun-fill'}`} aria-hidden="true" />
        </button>
    );
}
