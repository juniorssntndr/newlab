import React from 'react';

export default function LandingThemeToggle({ theme, onToggle }) {
    const isDark = theme === 'dark';
    return (
        <button
            type="button"
            className="affinix-theme-toggle"
            onClick={onToggle}
            aria-label={isDark ? 'Activar modo claro' : 'Activar modo oscuro'}
            title={isDark ? 'Modo claro' : 'Modo oscuro'}
        >
            <span className="affinix-theme-toggle-track" aria-hidden="true">
                <span className="affinix-theme-toggle-thumb" />
            </span>
            <i className={`bi ${isDark ? 'bi-moon-stars-fill' : 'bi-sun-fill'}`} aria-hidden="true" />
        </button>
    );
}
