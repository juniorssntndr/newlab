import React from 'react';
import ThemeSuggestionPopup from './ThemeSuggestionPopup.jsx';
import SunMoonAnimatedIcon from '../icons/animated/SunMoonAnimatedIcon.jsx';

export default function LandingThemeToggle({
    theme,
    onToggle,
    showSuggestion = false,
    onAcceptSuggestion = null,
    onDismissSuggestion = null
}) {
    const isDark = theme === 'dark';
    return (
        <div className="afinix-theme-toggle-wrapper">
            <button
                type="button"
                className="afinix-theme-toggle"
                aria-pressed={isDark}
                aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
                title={isDark ? 'Apariencia oscura activa. Clic para modo claro.' : 'Apariencia clara activa. Clic para modo oscuro.'}
                onClick={onToggle}
            >
                <SunMoonAnimatedIcon isDark={isDark} size={18} />
            </button>

            {showSuggestion && onAcceptSuggestion && onDismissSuggestion && (
                <ThemeSuggestionPopup
                    onAccept={onAcceptSuggestion}
                    onDismiss={onDismissSuggestion}
                />
            )}
        </div>
    );
}
