import React from 'react';

export default function LandingThemeToggle({ theme, onToggle }) {
    const isDark = theme === 'dark';
    return (
        <button
            type="button"
            className="afinix-theme-toggle"
            aria-pressed={isDark}
            aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            title={isDark ? 'Apariencia oscura activa. Clic para modo claro.' : 'Apariencia clara activa. Clic para modo oscuro.'}
            onClick={onToggle}
        >
            <i className={`bi ${isDark ? 'bi-sun-fill' : 'bi-moon-stars-fill'}`} aria-hidden="true" />
        </button>
    );
}
