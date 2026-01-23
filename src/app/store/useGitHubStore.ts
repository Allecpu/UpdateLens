import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface GitHubState {
    token: string | null;
    owner: string;
    repo: string;
    isWeb: boolean;
    setToken: (token: string | null) => void;
    setRepo: (owner: string, repo: string) => void;
    setIsWeb: (isWeb: boolean) => void;
    clearToken: () => void;
}

export const useGitHubStore = create<GitHubState>()(
    persist(
        (set) => ({
            token: null,
            owner: 'Allecpu',
            repo: 'UpdateLens',
            isWeb: false,
            setToken: (token) => set({ token }),
            setRepo: (owner, repo) => set({ owner, repo }),
            setIsWeb: (isWeb) => set({ isWeb }),
            clearToken: () => set({ token: null }),
        }),
        {
            name: 'updatelens.github.pat.issues',
            partialize: (state) => ({ token: state.token, owner: state.owner, repo: state.repo }),
        }
    )
);
