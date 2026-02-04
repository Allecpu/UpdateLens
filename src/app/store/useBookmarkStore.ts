import { create } from 'zustand';

type BookmarkStore = {
    bookmarkedIds: string[];
    showBookmarksOnly: boolean;
    toggleBookmark: (id: string) => void;
    isBookmarked: (id: string) => boolean;
    setShowBookmarksOnly: (enabled: boolean) => void;
};

const KEY = 'updatelens.bookmarks.v1';
const SHOW_ONLY_KEY = 'updatelens.bookmarks.showOnly.v1';

export const useBookmarkStore = create<BookmarkStore>((set, get) => {
    // Load initial state from localStorage safely
    const loadInitial = (): string[] => {
        if (typeof window === 'undefined') return [];
        try {
            const saved = localStorage.getItem(KEY);
            return saved ? JSON.parse(saved) : [];
        } catch (e) {
            console.error('Failed to parse bookmarks:', e);
            return [];
        }
    };

    return {
        bookmarkedIds: loadInitial(),
        showBookmarksOnly: (() => {
            if (typeof window === 'undefined') return false;
            try {
                const raw = localStorage.getItem(SHOW_ONLY_KEY);
                return raw ? JSON.parse(raw) === true : false;
            } catch {
                return false;
            }
        })(),

        toggleBookmark: (id: string) => {
            const { bookmarkedIds } = get();
            const isBookmarked = bookmarkedIds.includes(id);

            const nextIds = isBookmarked
                ? bookmarkedIds.filter((bookmarkId) => bookmarkId !== id)
                : [...bookmarkedIds, id];

            try {
                localStorage.setItem(KEY, JSON.stringify(nextIds));
            } catch (e) {
                console.error('Failed to save bookmarks:', e);
            }

            set({ bookmarkedIds: nextIds });
        },

        isBookmarked: (id: string) => {
            return get().bookmarkedIds.includes(id);
        },
        setShowBookmarksOnly: (enabled: boolean) => {
            try {
                localStorage.setItem(SHOW_ONLY_KEY, JSON.stringify(enabled));
            } catch (e) {
                console.error('Failed to save bookmarks view mode:', e);
            }
            set({ showBookmarksOnly: enabled });
        }
    };
});
