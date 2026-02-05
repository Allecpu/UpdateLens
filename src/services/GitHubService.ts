export interface GitHubIssue {
    id: number;
    number: number;
    title: string;
    body: string;
    state: 'open' | 'closed';
    html_url: string;
    user: {
        login: string;
        avatar_url: string;
    };
    labels: {
        name: string;
        color: string;
        description?: string;
    }[];
    created_at: string;
    updated_at: string;
    pull_request?: {
        url: string;
        html_url: string;
        diff_url: string;
        patch_url: string;
    };
}

export interface GitHubComment {
    id: number;
    body: string;
    user: {
        login: string;
        avatar_url: string;
    };
    created_at: string;
    updated_at: string;
    html_url: string;
}

export interface GitHubLabel {
    name: string;
    color: string;
    description?: string;
}

export interface CreateIssuePayload {
    title: string;
    body: string;
    labels?: string[];
    state?: 'open' | 'closed';
}

export interface GitHubIssuesClientOptions {
    token?: string;
    owner: string;
    repo: string;
    isWeb?: boolean;
}

export class GitHubIssuesClient {
    private baseUrl = 'https://api.github.com';
    private owner: string;
    private repo: string;
    private token?: string;
    private isWeb: boolean;

    constructor(options: GitHubIssuesClientOptions) {
        this.owner = options.owner;
        this.repo = options.repo;
        this.token = options.token;
        this.isWeb = options.isWeb ?? false;
    }

    private get headers() {
        const headers: Record<string, string> = {
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
        };
        if (this.isWeb) {
            headers['X-Requested-With'] = 'XMLHttpRequest';
        }
        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }
        return headers;
    }

    private get apiBase() {
        return this.isWeb ? '/api/github' : `${this.baseUrl}/repos/${this.owner}/${this.repo}`;
    }

    async listIssues(state: 'open' | 'closed' | 'all' = 'open'): Promise<GitHubIssue[]> {
        const url = this.isWeb
            ? `/api/github/issues?state=${state}`
            : `${this.apiBase}/issues?state=${state}&per_page=100`;

        const response = await fetch(url, { headers: this.headers });
        if (!response.ok) {
            throw new Error(`GitHub API error: ${response.statusText}`);
        }
        return response.json();
    }

    async createIssue(payload: CreateIssuePayload): Promise<GitHubIssue> {
        const url = this.isWeb ? '/api/github/issues' : `${this.apiBase}/issues`;

        const response = await fetch(url, {
            method: 'POST',
            headers: this.headers,
            body: JSON.stringify(payload),
        });
        if (!response.ok) {
            throw new Error(`GitHub API error: ${response.statusText}`);
        }
        return response.json();
    }

    async updateIssue(issueNumber: number, payload: Partial<CreateIssuePayload> & { state?: 'open' | 'closed' }): Promise<GitHubIssue> {
        const base = this.isWeb ? '/api/github' : `${this.baseUrl}/repos/${this.owner}/${this.repo}`;
        const url = `${base}/issues/${issueNumber}`;

        const response = await fetch(url, {
            method: 'PATCH',
            headers: this.headers,
            body: JSON.stringify(payload),
        });
        if (!response.ok) {
            throw new Error(`GitHub API error: ${response.statusText}`);
        }
        return response.json();
    }

    async listLabels(): Promise<GitHubLabel[]> {
        const url = this.isWeb ? '/api/github/labels' : `${this.apiBase}/labels`;
        const response = await fetch(url, { headers: this.headers });
        if (!response.ok) {
            throw new Error(`GitHub API error: ${response.statusText}`);
        }
        return response.json();
    }

    async listComments(issueNumber: number): Promise<GitHubComment[]> {
        const base = this.isWeb ? '/api/github' : `${this.baseUrl}/repos/${this.owner}/${this.repo}`;
        const url = `${base}/issues/${issueNumber}/comments`;

        const response = await fetch(url, { headers: this.headers });
        if (!response.ok) {
            throw new Error(`GitHub API error: ${response.statusText}`);
        }
        return response.json();
    }

    async validateToken(token: string): Promise<{ ok: boolean; message: string }> {
        try {
            const response = await fetch(`https://api.github.com/user`, {
                headers: {
                    ...this.headers,
                    'Authorization': `Bearer ${token}`
                }
            });
            if (response.ok) {
                const user = await response.json();
                return { ok: true, message: `Connesso come ${user.login}` };
            }
            if (response.status === 401) {
                return { ok: false, message: 'Token non valido (401)' };
            }
            return { ok: false, message: `Errore GitHub: ${response.statusText}` };
        } catch (err) {
            return { ok: false, message: 'Impossibile contattare GitHub API' };
        }
    }
    async uploadFile(path: string, contentBase64: string, message: string): Promise<{ download_url: string }> {
        // Ensure we use the correct base URL for contents
        const base = this.isWeb ? '/api/github' : `https://api.github.com/repos/${this.owner}/${this.repo}`;
        const url = `${base}/contents/${path}`;

        const response = await fetch(url, {
            method: 'PUT',
            headers: this.headers,
            body: JSON.stringify({
                message,
                content: contentBase64,
            }),
        });
        if (!response.ok) {
            const err = await response.json().catch(() => ({ message: response.statusText }));
            throw new Error(err.message || `GitHub API error: ${response.statusText}`);
        }
        const data = await response.json();
        const contentPath = data.content?.path || path;
        const downloadUrl = data.content?.download_url
            || `https://raw.githubusercontent.com/${this.owner}/${this.repo}/main/${contentPath}`;
        return { download_url: downloadUrl };
    }

    async addComment(issueNumber: number, body: string): Promise<void> {
        const base = this.isWeb ? '/api/github' : `https://api.github.com/repos/${this.owner}/${this.repo}`;
        const url = `${base}/issues/${issueNumber}/comments`;

        const response = await fetch(url, {
            method: 'POST',
            headers: this.headers,
            body: JSON.stringify({ body }),
        });
        if (!response.ok) {
            const err = await response.json().catch(() => ({ message: response.statusText }));
            throw new Error(err.message || `GitHub API error: ${response.statusText}`);
        }
    }
}
