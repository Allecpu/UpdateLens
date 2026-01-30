/**
 * Returns a relative time string (e.g., "3 giorni fa", "in 2 settimane", "oggi")
 */
export const getRelativeDateLabel = (dateString: string): string => {
    if (!dateString) return '';

    const now = new Date();

    // Parse input date. Handling potential formats.
    // Assuming 'YYYY-MM-DD' or 'YYYY-MM'
    const date = new Date(dateString);

    if (isNaN(date.getTime())) {
        return dateString; // Return original if parse fails
    }

    const diffMs = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    // Future dates
    if (diffDays > 0) {
        if (diffDays === 1) return 'Domani';
        if (diffDays < 7) return `Tra ${diffDays} giorni`;
        if (diffDays < 14) return 'Tra una settimana';
        if (diffDays < 30) return `Tra ${Math.floor(diffDays / 7)} settimane`;
        if (diffDays < 60) return 'Tra un mese';
        return `Tra ${Math.floor(diffDays / 30)} mesi`;
    }

    // Past dates
    const absDays = Math.abs(diffDays);
    if (absDays === 0) return 'Oggi';
    if (absDays === 1) return 'Ieri';
    if (absDays < 7) return `${absDays} giorni fa`;
    if (absDays < 14) return 'Una settimana fa';
    if (absDays < 30) return `${Math.floor(absDays / 7)} settimane fa`;
    if (absDays < 60) return 'Un mese fa';
    return `${Math.floor(absDays / 30)} mesi fa`;
};

/**
 * Checks if a date is considered "recent" (within last N days)
 */
export const isRecentDate = (dateString: string, days: number = 30): boolean => {
    if (!dateString) return false;
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return false;

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    return diffDays >= 0 && diffDays <= days;
};
