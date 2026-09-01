import React from 'react';
import '../../styles/theme-suggestion.css';

export default function ThemeSuggestionPopup({ onAccept, onDismiss }) {
    return (
        <div
            className="afinix-theme-popup"
            role="dialog"
            aria-labelledby="theme-popup-title"
            aria-describedby="theme-popup-desc"
        >
            <div className="afinix-theme-popup-header">
                <div className="afinix-theme-popup-title" id="theme-popup-title">
                    <i className="bi bi-moon-stars-fill" aria-hidden="true" />
                    <span>Modo Oscuro disponible</span>
                </div>
                <button
                    type="button"
                    className="afinix-theme-popup-close"
                    onClick={onDismiss}
                    aria-label="Cerrar sugerencia"
                    title="Cerrar"
                >
                    &times;
                </button>
            </div>
            <p className="afinix-theme-popup-text" id="theme-popup-desc">
                Detectamos que tu sistema usa tema oscuro. ¿Deseas activarlo en Afinix?
            </p>
            <div className="afinix-theme-popup-actions">
                <button
                    type="button"
                    className="btn-theme-suggest-secondary"
                    onClick={onDismiss}
                >
                    Mantener claro
                </button>
                <button
                    type="button"
                    className="btn-theme-suggest-primary"
                    onClick={onAccept}
                >
                    <i className="bi bi-check2" aria-hidden="true" />
                    Activar
                </button>
            </div>
        </div>
    );
}
