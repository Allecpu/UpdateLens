import { useEffect, useMemo, useState } from 'react';
import { useGitHubStore } from '../store/useGitHubStore';
import { GitHubIssuesClient, type GitHubIssue, type GitHubLabel } from '../../services/GitHubService';

const isFileProtocol = typeof window !== 'undefined' && window.location.protocol === 'file:';

// Basic Markdown to HTML helper
const markdownToHtml = (md: string) => {
    if (!md) return '';
    let html = md
        .replace(/^### (.*$)/gim, '<h3 class="text-lg font-bold mt-4 mb-2">$1</h3>')
        .replace(/^## (.*$)/gim, '<h2 class="text-xl font-bold mt-5 mb-3">$1</h2>')
        .replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold mt-6 mb-4">$1</h1>')
        .replace(/^\* (.*$)/gim, '<ul class="list-disc ml-5 mb-2"><li>$1</li></ul>')
        .replace(/^- (.*$)/gim, '<ul class="list-disc ml-5 mb-2"><li>$1</li></ul>')
        .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
        .replace(/\*(.*)\*/gim, '<em>$1</em>')
        .replace(/\[(.*?)\]\((.*?)\)/gim, '<a href="$2" class="text-primary hover:underline" target="_blank" rel="noopener noreferrer">$1</a>')
        .replace(/\n/gim, '<br />');

    html = html.replace(/<\/ul><ul class="list-disc ml-5 mb-2">/gim, '');
    return html;
};

const IssuesPage = () => {
    const { token, owner, repo, setToken, clearToken, isWeb, setIsWeb } = useGitHubStore();
    const [issues, setIssues] = useState<GitHubIssue[]>([]);
    const [labels, setLabels] = useState<GitHubLabel[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [filterState, setFilterState] = useState<'open' | 'closed' | 'all'>('open');
    const [search, setSearch] = useState('');
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isTokenModalOpen, setIsTokenModalOpen] = useState(false);

    // Token Config State
    const [tempToken, setTempToken] = useState('');
    const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
    const [isTesting, setIsTesting] = useState(false);

    // New Issue State
    const [newTitle, setNewTitle] = useState('');
    const [newBody, setNewBody] = useState('');
    const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
    const [severity, setSeverity] = useState('low');
    const [isPreview, setIsPreview] = useState(false);

    const client = useMemo(() => new GitHubIssuesClient({
        token: token || undefined,
        owner,
        repo,
        isWeb
    }), [token, owner, repo, isWeb]);

    const fetchIssues = async () => {
        if (!isWeb && !token) return;
        setLoading(true);
        setError(null);
        try {
            const data = await client.listIssues(filterState);
            setIssues(data);
        } catch (err: any) {
            if (err.message.includes('401')) {
                setError('Token non valido o scaduto. Ricontrolla la configurazione.');
            } else {
                setError(err instanceof Error ? err.message : 'Errore nel caricamento delle issue');
            }
        } finally {
            setLoading(false);
        }
    };

    const fetchLabels = async () => {
        if (!isWeb && !token) return;
        try {
            const data = await client.listLabels();
            setLabels(data);
        } catch (err) {
            console.error('Failed to fetch labels', err);
        }
    };

    useEffect(() => {
        if (isWeb || token) {
            fetchIssues();
            fetchLabels();
        }
    }, [filterState, token, isWeb]);

    useEffect(() => {
        const checkProxy = async () => {
            try {
                const res = await fetch('/api/github/issues?state=open');
                if (res.ok || res.status === 401 || res.status === 500) {
                    // If we get 401 or 500 (but from our proxy), it means the proxy exists
                    // A 404 would mean the route is missing
                    setIsWeb(true);
                } else {
                    setIsWeb(false);
                }
            } catch {
                setIsWeb(false);
            }
        };
        if (!isFileProtocol) {
            checkProxy();
        } else {
            setIsWeb(false);
        }
    }, []);

    const handleCreateIssue = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTitle || !newBody) return;

        setLoading(true);
        try {
            const finalLabels = [...selectedLabels];
            if (severity !== 'none') {
                const severityLabel = `severity:${severity}`;
                if (!finalLabels.includes(severityLabel)) {
                    finalLabels.push(severityLabel);
                }
            }

            await client.createIssue({
                title: newTitle,
                body: newBody,
                labels: finalLabels
            });

            setIsCreateModalOpen(false);
            setNewTitle('');
            setNewBody('');
            setSelectedLabels([]);
            setSeverity('low');
            fetchIssues();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Errore nella creazione della issue');
        } finally {
            setLoading(false);
        }
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !isWeb) return;

        setLoading(true);
        try {
            const reader = new FileReader();
            reader.onloadend = async () => {
                const base64Content = (reader.result as string).split(',')[1];
                const res = await fetch('/api/github/upload', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        filename: file.name,
                        content: base64Content
                    })
                });

                if (!res.ok) throw new Error('Errore durante l\'upload dell\'immagine');

                const data = await res.json();
                const markdownImage = `\n![${file.name}](${data.url})\n`;
                setNewBody(prev => prev + markdownImage);
            };
            reader.readAsDataURL(file);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Errore durante l\'upload');
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateStatus = async (number: number, newState: 'open' | 'closed') => {
        if (!isWeb) return;
        try {
            await client.updateIssue(number, { state: newState });
            fetchIssues();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Errore nell\'aggiornamento della issue');
        }
    };

    const handleTestToken = async () => {
        if (!tempToken) return;
        setIsTesting(true);
        setTestResult(null);
        try {
            const result = await client.validateToken(tempToken);
            setTestResult(result);
        } finally {
            setIsTesting(false);
        }
    };

    const handleSaveToken = () => {
        setToken(tempToken);
        setIsTokenModalOpen(false);
        setTempToken('');
        setTestResult(null);
    };

    const handleRemoveToken = () => {
        if (confirm('Sei sicuro di voler rimuovere il GitHub Token?')) {
            clearToken();
            setIssues([]);
        }
    };

    const filteredIssues = useMemo(() => {
        return issues.filter(issue =>
            issue.title.toLowerCase().includes(search.toLowerCase()) ||
            issue.number.toString().includes(search)
        );
    }, [issues, search]);

    const envType = isWeb ? 'WEB (SERVER)' : isFileProtocol ? 'LOCAL (OFFLINE)' : 'LOCAL (BROWSER)';
    const isTokenMissing = !isWeb && !token;

    return (
        <div className="space-y-6">
            <header className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-semibold">GitHub Issues</h1>
                    <p className="mt-2 text-sm text-muted-foreground flex items-center gap-2">
                        Repository: <span className="font-mono text-foreground">{owner}/{repo}</span>
                        <span className={`ul-chip ${isWeb ? 'bg-emerald-500/10 text-emerald-500' : isTokenMissing ? 'bg-rose-500/10 text-rose-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                            {envType}
                        </span>
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {!isWeb && (
                        <div className="flex items-center gap-2 mr-4">
                            {token ? (
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-emerald-500 font-medium flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                        Token configurato
                                    </span>
                                    <button onClick={handleRemoveToken} className="text-xs text-muted-foreground hover:text-rose-500 transition-colors">Rimuovi</button>
                                </div>
                            ) : (
                                <button
                                    onClick={() => setIsTokenModalOpen(true)}
                                    className="ul-button ul-button-ghost py-1.5 px-3 text-xs border-amber-500/30 text-amber-500"
                                >
                                    Configura Token
                                </button>
                            )}
                        </div>
                    )}
                    <button
                        disabled={isTokenMissing}
                        onClick={() => setIsCreateModalOpen(true)}
                        className="ul-button ul-button-primary flex items-center gap-2"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
                        Nuova Issue
                    </button>
                </div>
            </header>

            {error && (
                <div className="ul-surface border-l-4 border-rose-500 px-4 py-3 text-sm text-rose-500">
                    {error}
                </div>
            )}

            {isTokenMissing ? (
                <div className="ul-surface py-20 flex flex-col items-center justify-center text-center space-y-6 px-6">
                    <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m0 0v3m0-3h3m-3 0H9m12 1a9 9 0 11-18 0 9 9 0 0118 0zM12 9V7m0 2v2"></path></svg>
                    </div>
                    <div>
                        <h3 className="text-xl font-semibold">Configurazione richiesta</h3>
                        <p className="mt-2 text-muted-foreground max-w-md">
                            Per visualizzare e creare issue in modalità locale, devi configurare un GitHub Personal Access Token (PAT) con permessi <code className="bg-accent px-1 rounded">Issues RW</code> e <code className="bg-accent px-1 rounded">Metadata RO</code>.
                        </p>
                    </div>
                    <button
                        onClick={() => setIsTokenModalOpen(true)}
                        className="ul-button ul-button-primary bg-amber-500 hover:bg-amber-600"
                    >
                        Configura GitHub Token
                    </button>
                </div>
            ) : (
                <>
                    <div className="ul-surface p-4 flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setFilterState('open')}
                                className={`px-3 py-1 rounded-full text-sm font-medium ${filterState === 'open' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`}
                            >
                                Aperte
                            </button>
                            <button
                                onClick={() => setFilterState('closed')}
                                className={`px-3 py-1 rounded-full text-sm font-medium ${filterState === 'closed' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`}
                            >
                                Chiuse
                            </button>
                            <button
                                onClick={() => setFilterState('all')}
                                className={`px-3 py-1 rounded-full text-sm font-medium ${filterState === 'all' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`}
                            >
                                Tutte
                            </button>
                        </div>
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Cerca issues..."
                                className="ul-input pl-10 pr-4 py-2 w-64"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                            <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                        </div>
                    </div>

                    <div className="space-y-4">
                        {loading ? (
                            <div className="flex justify-center py-12">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                            </div>
                        ) : filteredIssues.length > 0 ? (
                            filteredIssues.map(issue => (
                                <div key={issue.id} className="ul-surface p-5 hover:border-primary/50 transition-colors">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                <span className={`w-2 h-2 rounded-full ${issue.state === 'open' ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                                                <span className="text-xs font-mono text-muted-foreground">#{issue.number}</span>
                                                <h3 className="font-semibold text-lg leading-tight">{issue.title}</h3>
                                            </div>
                                            <div className="flex flex-wrap gap-2 mt-2">
                                                {issue.labels.map(label => (
                                                    <span
                                                        key={label.name}
                                                        className="text-[10px] px-2 py-0.5 rounded-full font-bold border"
                                                        style={{
                                                            backgroundColor: `#${label.color}20`,
                                                            color: `#${label.color}`,
                                                            borderColor: `#${label.color}40`
                                                        }}
                                                    >
                                                        {label.name}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                        {isWeb && (
                                            <button
                                                onClick={() => handleUpdateStatus(issue.number, issue.state === 'open' ? 'closed' : 'open')}
                                                className="ul-button ul-button-ghost py-1 px-3 text-xs"
                                            >
                                                {issue.state === 'open' ? 'Chiudi' : 'Riapri'}
                                            </button>
                                        )}
                                    </div>
                                    <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                                        <div className="flex items-center gap-4">
                                            <div className="flex items-center gap-1">
                                                <img src={issue.user.avatar_url} className="w-4 h-4 rounded-full" alt={issue.user.login} />
                                                <span>{issue.user.login}</span>
                                            </div>
                                            <span>{new Date(issue.created_at).toLocaleDateString()}</span>
                                        </div>
                                        <a href={issue.html_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1">
                                            Vedi su GitHub
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
                                        </a>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="ul-surface py-12 text-center text-muted-foreground">
                                {search ? 'Nessuna issue trovata per questa ricerca.' : 'Nessuna issue presente.'}
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* Token Configuration Modal */}
            {isTokenModalOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
                    <div className="ul-surface w-full max-w-md flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
                        <header className="p-6 border-b border-border flex items-center justify-between">
                            <h2 className="text-xl font-semibold">Configura GitHub Token</h2>
                            <button onClick={() => setIsTokenModalOpen(false)} className="text-muted-foreground hover:text-foreground">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                            </button>
                        </header>
                        <div className="p-6 space-y-4">
                            <p className="text-sm text-muted-foreground">
                                Inserisci un <strong>Personal Access Token (fine-grained)</strong>. Il token rimarrà salvato solo nel tuo browser.
                            </p>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">GitHub PAT</label>
                                <input
                                    type="password"
                                    value={tempToken}
                                    onChange={(e) => setTempToken(e.target.value)}
                                    placeholder="github_pat_..."
                                    className="ul-input"
                                />
                            </div>
                            {testResult && (
                                <div className={`p-3 rounded-lg text-xs flex items-center gap-2 ${testResult.ok ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                                    {testResult.ok ? (
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                                    ) : (
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                                    )}
                                    {testResult.message}
                                </div>
                            )}
                            <button
                                onClick={handleTestToken}
                                disabled={isTesting || !tempToken}
                                className="w-full ul-button ul-button-ghost text-xs"
                            >
                                {isTesting ? 'Verifica in corso...' : 'Test Token'}
                            </button>
                        </div>
                        <footer className="p-6 border-t border-border flex justify-end gap-3 bg-accent/30">
                            <button onClick={() => setIsTokenModalOpen(false)} className="ul-button ul-button-ghost">Annulla</button>
                            <button
                                onClick={handleSaveToken}
                                disabled={!tempToken}
                                className="ul-button ul-button-primary"
                            >
                                Salva Token
                            </button>
                        </footer>
                    </div>
                </div>
            )}

            {/* Create Issue Modal */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
                    <div className="ul-surface w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-300">
                        <header className="p-6 border-b border-border flex items-center justify-between">
                            <h2 className="text-xl font-semibold">Crea Nuova Issue</h2>
                            <button onClick={() => setIsCreateModalOpen(false)} className="text-muted-foreground hover:text-foreground">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                            </button>
                        </header>

                        <form onSubmit={handleCreateIssue} className="p-6 overflow-y-auto space-y-4 flex-1">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Titolo</label>
                                <input
                                    required
                                    type="text"
                                    value={newTitle}
                                    onChange={(e) => setNewTitle(e.target.value)}
                                    placeholder="Cosa non funziona?"
                                    className="ul-input"
                                />
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <label className="text-sm font-medium">Descrizione (Markdown)</label>
                                    <div className="flex items-center gap-2">
                                        {isWeb && (
                                            <div className="flex items-center gap-1">
                                                <input
                                                    type="file"
                                                    id="image-upload"
                                                    className="hidden"
                                                    accept="image/*"
                                                    onChange={handleImageUpload}
                                                />
                                                <label
                                                    htmlFor="image-upload"
                                                    className="flex items-center gap-1 px-2 py-1 text-xs rounded-lg border border-border hover:bg-accent cursor-pointer"
                                                    title="Carica immagine"
                                                >
                                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                                                    Img
                                                </label>
                                            </div>
                                        )}
                                        <div className="flex rounded-lg overflow-hidden border border-border">
                                            <button
                                                type="button"
                                                onClick={() => setIsPreview(false)}
                                                className={`px-3 py-1 text-xs ${!isPreview ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50'}`}
                                            >
                                                Write
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setIsPreview(true)}
                                                className={`px-3 py-1 text-xs ${isPreview ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50'}`}
                                            >
                                                Preview
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {isPreview ? (
                                    <div
                                        className="ul-surface p-4 min-h-[200px] text-sm overflow-y-auto max-h-[300px]"
                                        dangerouslySetInnerHTML={{ __html: markdownToHtml(newBody) || '<span class="text-muted-foreground">Nulla da visualizzare</span>' }}
                                    />
                                ) : (
                                    <textarea
                                        required
                                        value={newBody}
                                        onChange={(e) => setNewBody(e.target.value)}
                                        placeholder="Descrivi il problema o la richiesta..."
                                        className="ul-input h-[200px] rounded-[20px] resize-none font-mono text-sm"
                                    />
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Severità</label>
                                    <select
                                        value={severity}
                                        onChange={(e) => setSeverity(e.target.value)}
                                        className="ul-input"
                                    >
                                        <option value="none">Nessuna</option>
                                        <option value="low">Low (Minor)</option>
                                        <option value="medium">Medium (Important)</option>
                                        <option value="high">High (Critical)</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Labels</label>
                                    <div className="flex flex-wrap gap-1">
                                        {labels.slice(0, 10).map(label => (
                                            <button
                                                key={label.name}
                                                type="button"
                                                onClick={() => {
                                                    if (selectedLabels.includes(label.name)) {
                                                        setSelectedLabels(selectedLabels.filter(l => l !== label.name));
                                                    } else {
                                                        setSelectedLabels([...selectedLabels, label.name]);
                                                    }
                                                }}
                                                className={`text-[10px] px-2 py-0.5 rounded-full border transition-all ${selectedLabels.includes(label.name)
                                                    ? 'ring-2 ring-primary ring-offset-1 scale-105'
                                                    : 'opacity-70 hover:opacity-100'
                                                    }`}
                                                style={{
                                                    backgroundColor: `#${label.color}20`,
                                                    color: `#${label.color}`,
                                                    borderColor: `#${label.color}40`
                                                }}
                                            >
                                                {label.name}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </form>

                        <footer className="p-6 border-t border-border flex justify-end gap-3 bg-accent/20">
                            <button
                                type="button"
                                onClick={() => setIsCreateModalOpen(false)}
                                className="ul-button ul-button-ghost"
                            >
                                Annulla
                            </button>
                            <button
                                onClick={handleCreateIssue}
                                disabled={loading || !newTitle || !newBody}
                                className="ul-button ul-button-primary"
                            >
                                {loading ? 'Invio in corso...' : 'Crea Issue'}
                            </button>
                        </footer>
                    </div>
                </div>
            )}
        </div>
    );
};

export default IssuesPage;
