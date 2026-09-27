import { useState, useEffect, useCallback } from 'react';

export const THEME_STORAGE_KEY = 'afinix_theme';
export const SUGGESTION_DISMISSED_KEY = 'afinix_theme_prompt_dismissed';

// Legacy keys for backward compatibility
const LEGACY_KEYS = ['afinix-landing-theme', 'nl_theme'];

function getSavedTheme() {
    if (typeof window === 'undefined') return null;
    try {
        const current = localStorage.getItem(THEME_STORAGE_KEY);
        if (current === 'light' || current === 'dark') return current;

        for (const key of LEGACY_KEYS) {
            const legacy = localStorage.getItem(key);
            if (legacy === 'light' || legacy === 'dark') return legacy;
        }
    } catch {
        /* ignore storage access error */
    }
    return null;
}

function getInitialTheme() {
    const saved = getSavedTheme();
    if (saved) return saved;
    // By default, always start in 'light' mode
    return 'light';
}

function checkSystemPrefersDark() {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    try {
        return window.matchMedia('(prefers-color-scheme: dark)').matches;
    } catch {
        return false;
    }
}

function isSuggestionDismissed() {
    if (typeof window === 'undefined') return true;
    try {
        return localStorage.getItem(SUGGESTION_DISMISSED_KEY) === 'true';
    } catch {
        return true;
    }
}

export function useAppTheme() {
    const [theme, setThemeState] = useState(getInitialTheme);
    const [showSuggestion, setShowSuggestion] = useState(false);

    // Apply data-theme attribute on <html> and synchronize with localStorage
    const applyTheme = useCallback((newTheme) => {
        setThemeState(newTheme);
        if (typeof document !== 'undefined') {
            document.documentElement.setAttribute('data-theme', newTheme);
        }
        try {
            localStorage.setItem(THEME_STORAGE_KEY, newTheme);
            // Sync legacy keys so all existing readers stay aligned
            for (const key of LEGACY_KEYS) {
                localStorage.setItem(key, newTheme);
            }
        } catch {
            /* ignore */
        }
    }, []);

    // Initial DOM setup and evaluation of dark mode suggestion
    useEffect(() => {
        const saved = getSavedTheme();
        const initialTheme = saved || 'light';
        document.documentElement.setAttribute('data-theme', initialTheme);

        // Show suggestion if no theme is explicitly saved, system is dark, and prompt was not dismissed
        if (!saved && checkSystemPrefersDark() && !isSuggestionDismissed()) {
            const timer = setTimeout(() => {
                setShowSuggestion(true);
            }, 600);
            return () => clearTimeout(timer);
        }
    }, []);

    const toggle = useCallback(() => {
        const nextTheme = theme === 'dark' ? 'light' : 'dark';
        applyTheme(nextTheme);
        dismissSuggestion();
    }, [theme, applyTheme]);

    const dismissSuggestion = useCallback(() => {
        setShowSuggestion(false);
        try {
            localStorage.setItem(SUGGESTION_DISMISSED_KEY, 'true');
        } catch {
            /* ignore */
        }
    }, []);

    const acceptDarkSuggestion = useCallback(() => {
        applyTheme('dark');
        dismissSuggestion();
    }, [applyTheme, dismissSuggestion]);

    const keepLightSuggestion = useCallback(() => {
        applyTheme('light');
        dismissSuggestion();
    }, [applyTheme, dismissSuggestion]);

    return {
        theme,
        setTheme: applyTheme,
        toggle,
        showSuggestion,
        dismissSuggestion,
        acceptDarkSuggestion,
        keepLightSuggestion
    };
}
