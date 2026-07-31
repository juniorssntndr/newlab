const DRAFT_KEY = 'afinix.orderWizard.draft.v1';

export const saveOrderWizardDraft = (draft) => {
    try {
        sessionStorage.setItem(DRAFT_KEY, JSON.stringify({
            ...draft,
            savedAt: Date.now(),
        }));
    } catch {
        // ignore quota / private mode
    }
};

export const readOrderWizardDraft = () => {
    try {
        const raw = sessionStorage.getItem(DRAFT_KEY);
        if (!raw) return null;
        return JSON.parse(raw);
    } catch {
        return null;
    }
};

export const clearOrderWizardDraft = () => {
    try {
        sessionStorage.removeItem(DRAFT_KEY);
    } catch {
        // ignore
    }
};
