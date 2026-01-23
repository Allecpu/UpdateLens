import { useEffect, useMemo, useState } from 'react';
import { useGitHubStore } from '../store/useGitHubStore';
import { GitHubIssuesClient, type GitHubIssue, type GitHubLabel } from '../../services/GitHubService';
import { getAttachments, saveAttachments, removeAttachment as removeStoredAttachment, clearAttachments } from '../../utils/attachmentStorage';

const isFileProtocol = typeof window !== 'undefined' && window.location.protocol === 'file:';
const MAX_ATTACHMENT_SIZE_BYTES = 1 * 1024 * 1024;

const encodePathSegments = (path: string) => path.split('/').map((segment) => encodeURIComponent(segment)).join('/');

const normalizeGitHubContentUrl = (url: string, fallbackOwner: string, fallbackRepo: string) => {
    try {
        const parsed = new URL(url);
        if (parsed.hostname !== 'api.github.com') return url;

        const match = parsed.pathname.match(/^\/repos\/([^/]+)\/([^/]+)\/contents\/(.+)$/);
        if (!match) return url;

        const owner = match[1] || fallbackOwner;
        const repo = match[2] || fallbackRepo;
        const contentPath = match[3];
        const ref = parsed.searchParams.get('ref') || 'main';
        const decodedPath = decodeURIComponent(contentPath);

        return `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${encodePathSegments(decodedPath)}`;
    } catch {
        return url;
    }
};

// Basic Markdown to HTML helper
const markdownToHtml = (md: string, owner: string, repo: string) => {
    if (!md) return '';
    let html = md
        // Basic escaping
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        // Images: ![alt](url)
        .replace(/!\[(.*?)\]\((.*?)\)/gim, (_match, alt, url) => {
            const normalizedUrl = normalizeGitHubContentUrl(url, owner, repo);
            return `<img src="${normalizedUrl}" alt="${alt}" style="max-width: 100%; height: auto; border-radius: 8px; margin: 12px 0; border: 1px solid var(--border);" />`;
        })
        // Links: [text](url)
        .replace(/\[(.*?)\]\((.*?)\)/gim, '<a href="$2" class="text-primary hover:underline" target="_blank" rel="noopener noreferrer">$1</a>')
        // Typography
        .replace(/^### (.*$)/gim, '<h3 class="text-lg font-bold mt-4 mb-2">$1</h3>')
        .replace(/^## (.*$)/gim, '<h2 class="text-xl font-bold mt-5 mb-3">$1</h2>')
        .replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold mt-6 mb-4">$1</h1>')
        .replace(/^\* (.*$)/gim, '<ul class="list-disc ml-5 mb-2"><li>$1</li></ul>')
        .replace(/^- (.*$)/gim, '<ul class="list-disc ml-5 mb-2"><li>$1</li></ul>')
        .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
        .replace(/\*(.*)\*/gim, '<em>$1</em>')
        .replace(/\n/gim, '<br />');

    html = html.replace(/<\/ul><ul class="list-disc ml-5 mb-2">/gim, '');
    return html;
};

const mimeExtensionMap: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/svg+xml': 'svg',
};

const getFileExtension = (file: File) => {
    const fromMime = mimeExtensionMap[file.type];
    if (fromMime) return fromMime;
    const nameParts = file.name.split('.');
    if (nameParts.length > 1) {
        return nameParts[nameParts.length - 1].toLowerCase();
    }
    return 'bin';
};

const sha256Hex = async (buffer: ArrayBuffer) => {
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    return Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
};

const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    return btoa(binary);
};

const buildDeterministicName = (index: number, hash: string, ext: string) => {
    const safeExt = ext.replace(/[^a-z0-9]/gi, '') || 'bin';
    const hashShort = hash.slice(0, 12);
    return `img-${String(index + 1).padStart(2, '0')}-${hashShort}.${safeExt}`;
};

interface Attachment {
    id: string;
    file: File;
    preview: string;
    name: string;
}

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
    const [attachments, setAttachments] = useState<Attachment[]>([]);
    const [uploadProgress, setUploadProgress] = useState<string | null>(null);

    // Initial load of attachments from IndexedDB
    useEffect(() => {
        const loadSaved = async () => {
            try {
                const saved = await getAttachments();
                if (saved.length > 0) {
                    const loaded = saved.map(s => ({
                        id: s.id,
                        file: s.file,
                        preview: URL.createObjectURL(s.file),
                        name: s.file.name
                    }));
                    setAttachments(loaded);
                }
            } catch (err) {
                console.error('Failed to load saved attachments', err);
            }
        };
        loadSaved();
    }, []);

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
                const res = await fetch('/api/github/health');
                if (res.ok) {
                    const data = await res.json();
                    if (data.mode === 'web' && data.ok) {
                        setIsWeb(true);
                        return;
                    }
                }
                setIsWeb(false);
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
        setError(null);
        try {
            const uploadedImages: { name: string; url: string }[] = [];

            const finalLabels = [...selectedLabels];
            if (severity !== 'none') {
                const severityLabel = `severity:${severity}`;
                if (!finalLabels.includes(severityLabel)) {
                    finalLabels.push(severityLabel);
                }
            }

            setUploadProgress('Creazione issue...');
            const createdIssue = await client.createIssue({
                title: newTitle,
                body: newBody,
                labels: finalLabels,
                state: 'open'
            });

            const uploadErrors: string[] = [];
            if (attachments.length > 0) {
                setUploadProgress(`Upload immagini 0/${attachments.length}...`);

                for (let i = 0; i < attachments.length; i++) {
                    const att = attachments[i];
                    setUploadProgress(`Upload immagine ${i + 1}/${attachments.length}: ${att.name}...`);

                    if (att.file.size > MAX_ATTACHMENT_SIZE_BYTES) {
                        uploadErrors.push(`${att.name} supera 1MB e non può essere caricato via GitHub Contents API.`);
                        continue;
                    }

                    const buffer = await att.file.arrayBuffer();
                    const hash = await sha256Hex(buffer);
                    const ext = getFileExtension(att.file);
                    const fileName = buildDeterministicName(i, hash, ext);
                    const path = `docs/issues/${createdIssue.number}/${fileName}`;
                    const base64Content = arrayBufferToBase64(buffer);

                    try {
                        const result = await client.uploadFile(
                            path,
                            base64Content,
                            `Upload issue attachment ${createdIssue.number}/${fileName}`
                        );
                        uploadedImages.push({ name: att.file.name, url: result.download_url });
                    } catch (err) {
                        const message = err instanceof Error ? err.message : String(err);
                        if (/resource not accessible by personal access token/i.test(message)) {
                            uploadErrors.push(`Upload fallito per ${att.name}: token senza permessi Contents (RW) sul repo.`);
                        } else {
                            console.error(`Failed to upload ${att.file.name}`, err);
                            uploadErrors.push(`Upload fallito per ${att.name}.`);
                        }
                    }
                }
            }

            if (uploadedImages.length > 0) {
                const imageMarkdown = uploadedImages
                    .map(img => `![${img.name}](${img.url})`)
                    .join('\n');
                const updatedBody = `${createdIssue.body ?? newBody}\n\n---\n### Immagini di supporto\n${imageMarkdown}`;

                try {
                    setUploadProgress('Aggiornamento issue...');
                    await client.updateIssue(createdIssue.number, { body: updatedBody, state: 'open' });
                } catch (err) {
                    console.error('Failed to update issue body', err);
                    setError('Issue creata, ma non è stato possibile aggiornare il body con le immagini.');
                }
            }

            if (uploadErrors.length > 0) {
                setError(`Issue creata, ma alcune immagini non sono state caricate: ${uploadErrors.join(' ')}`);
            }

            // Cleanup
            await clearAttachments();
            setIsCreateModalOpen(false);
            setNewTitle('');
            setNewBody('');
            setSelectedLabels([]);
            setSeverity('low');
            setAttachments([]);
            setUploadProgress(null);
            fetchIssues();

        } catch (err) {
            console.error('Error in issue creation flow:', err);
            setError(err instanceof Error ? err.message : 'Errore nella creazione della issue');
        } finally {
            setLoading(false);
        }
    };

    const handleAddAttachments = (files: FileList | File[]) => {
        const fileArray = Array.from(files);
        const newAtts: Attachment[] = [];

        // Limit to 5 images total
        const remainingSpace = 5 - attachments.length;
        const filesToProcess = fileArray.slice(0, remainingSpace);

        filesToProcess.forEach(file => {
            if (file.type.startsWith('image/') && file.size <= MAX_ATTACHMENT_SIZE_BYTES) {
                const id = Math.random().toString(36).substr(2, 9);
                newAtts.push({
                    id,
                    file,
                    preview: URL.createObjectURL(file),
                    name: file.name
                });
            }
        });

        if (newAtts.length > 0) {
            const nextAtts = [...attachments, ...newAtts];
            setAttachments(nextAtts);
            saveAttachments(newAtts);
        }

        if (fileArray.length > remainingSpace) {
            alert('Massimo 5 immagini consentite.');
        }
        if (fileArray.some(file => file.size > MAX_ATTACHMENT_SIZE_BYTES)) {
            alert('Alcune immagini superano 1MB e non possono essere caricate via GitHub Contents API.');
        }
    };

    const handlePaste = (e: React.ClipboardEvent) => {
        const items = e.clipboardData.items;
        const files: File[] = [];
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                const blob = items[i].getAsFile();
                if (blob) files.push(blob);
            }
        }
        if (files.length > 0) {
            handleAddAttachments(files);
        }
    };

    const handleRemoveAttachment = (id: string) => {
        setAttachments(prev => {
            const att = prev.find(a => a.id === id);
            if (att) URL.revokeObjectURL(att.preview);
            return prev.filter(a => a.id !== id);
        });
        removeStoredAttachment(id);
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
                            Per visualizzare e creare issue in modalità locale, devi configurare un GitHub Personal Access Token (PAT) con permessi <code className="bg-accent px-1 rounded">Issues RW</code>, <code className="bg-accent px-1 rounded">Contents RW</code> e <code className="bg-accent px-1 rounded">Metadata RO</code>.
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
                                className="ul-input text-center pl-10 pr-10 h-10 !py-0 w-64"
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
                                Inserisci un <strong>Personal Access Token (fine-grained)</strong>. Il token rimarrà salvato solo nel tuo browser e può essere usato anche in modalità web per l'upload immagini.
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
                    <div className="ul-surface w-full max-w-3xl max-h-[92vh] overflow-hidden flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-300">
                        <header className="p-6 border-b border-border flex items-center justify-between">
                            <h2 className="text-xl font-semibold">Crea Nuova Issue</h2>
                            <button onClick={() => setIsCreateModalOpen(false)} className="text-muted-foreground hover:text-foreground">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                            </button>
                        </header>

                        <form onSubmit={handleCreateIssue} className="p-6 overflow-y-auto space-y-6 flex-1">
                            {/* 1. Titolo */}
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

                            {/* 2. Descrizione */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <label className="text-sm font-medium">Descrizione (Markdown)</label>
                                    <div className="flex items-center gap-2">
                                        <div className="flex rounded-lg overflow-hidden border border-border">
                                            <button
                                                type="button"
                                                onClick={() => setIsPreview(false)}
                                                className={`px-3 py-1 text-xs font-medium transition-colors ${!isPreview ? 'bg-primary text-primary-foreground' : 'hover:bg-accent text-muted-foreground'}`}
                                            >
                                                Write
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setIsPreview(true)}
                                                className={`px-3 py-1 text-xs font-medium transition-colors ${isPreview ? 'bg-primary text-primary-foreground' : 'hover:bg-accent text-muted-foreground'}`}
                                            >
                                                Preview
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {isPreview ? (
                                    <div
                                        className="ul-textarea min-h-[220px] max-h-[400px] overflow-y-auto bg-accent/5"
                                        dangerouslySetInnerHTML={{ __html: markdownToHtml(newBody, owner, repo) || '<span class="text-muted-foreground italic">Nulla da visualizzare. Scrivi qualcosa nella tab "Write".</span>' }}
                                    />
                                ) : (
                                    <textarea
                                        required
                                        value={newBody}
                                        onChange={(e) => setNewBody(e.target.value)}
                                        onPaste={handlePaste}
                                        placeholder={"Descrivi il problema, includendo:\n• cosa stavi facendo\n• cosa ti aspettavi\n• cosa è successo\n\nPuoi incollare immagini direttamente qui!"}
                                        className="ul-textarea min-h-[220px] resize-y font-mono text-sm leading-relaxed"
                                    />
                                )}
                                <p className="text-[10px] text-muted-foreground">Supporta la sintassi Markdown (intestazioni, grassetto, elenchi).</p>
                            </div>

                            {/* 3. Allegati */}
                            <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-medium flex items-center gap-2">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"></path></svg>
                                    Immagini di supporto
                                </label>
                                {!isWeb && (
                                    <span className="ul-chip bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-[10px]">
                                        UPLOAD SU GITHUB
                                    </span>
                                )}
                            </div>

                                <div
                                    className="border-2 border-dashed rounded-xl p-6 transition-all border-border hover:border-primary/50 cursor-pointer bg-accent/5"
                                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                    onDrop={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        if (e.dataTransfer.files) handleAddAttachments(e.dataTransfer.files);
                                    }}
                                    onClick={() => {
                                        document.getElementById('attachment-input')?.click();
                                    }}
                                    onPaste={handlePaste}
                                >
                                    <div className="flex flex-col items-center justify-center text-center space-y-2">
                                        <input
                                            type="file"
                                            id="attachment-input"
                                            className="hidden"
                                            multiple
                                            accept="image/*"
                                            onChange={(e) => e.target.files && handleAddAttachments(e.target.files)}
                                        />
                                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                                        </div>
                                        <p className="text-sm">
                                            Trascina qui le immagini, incollale o <span className="text-primary font-semibold">clicca per sfogliare</span>
                                        </p>
                                        <p className="text-[10px] text-muted-foreground mt-1 max-w-xs">
                                            Verranno caricate su GitHub e inserite nell'issue alla creazione (max 1MB per immagine).
                                        </p>
                                    </div>
                                </div>

                                {attachments.length > 0 && (
                                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4">
                                        {attachments.map(att => (
                                            <div key={att.id} className="group relative rounded-lg border border-border overflow-hidden bg-accent/20 aspect-square">
                                                <img src={att.preview} alt={att.name} className="w-full h-full object-cover" />
                                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                    <button
                                                        type="button"
                                                        onClick={(e) => { e.stopPropagation(); handleRemoveAttachment(att.id); }}
                                                        className="p-1.5 bg-rose-500 text-white rounded-full hover:bg-rose-600 transition-transform hover:scale-110"
                                                        title="Rimuovi"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                                    </button>
                                                </div>
                                                <div className="absolute bottom-0 left-0 right-0 p-1 text-[9px] truncate bg-black/60 text-white backdrop-blur-[2px]">
                                                    {att.name}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* 4. Severity & Labels */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
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
                                    <div className="flex flex-wrap gap-1 border border-border rounded-xl p-3 bg-accent/5">
                                        {labels.length > 0 ? labels.slice(0, 15).map(label => (
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
                                                    ? 'ring-2 ring-primary ring-offset-2 scale-105'
                                                    : 'opacity-70 hover:opacity-100 hover:scale-105'
                                                    }`}
                                                style={{
                                                    backgroundColor: `#${label.color}20`,
                                                    color: `#${label.color}`,
                                                    borderColor: `#${label.color}40`
                                                }}
                                            >
                                                {label.name}
                                            </button>
                                        )) : <span className="text-xs text-muted-foreground italic">Nessuna label disponibile</span>}
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
                                className="ul-button ul-button-primary min-w-[140px]"
                            >
                                {loading ? (
                                    <span className="flex items-center gap-3">
                                        <div className="w-4 h-4 rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin"></div>
                                        <span className="text-xs font-medium">{uploadProgress || 'Creazione...'}</span>
                                    </span>
                                ) : 'Crea Issue'}
                            </button>
                        </footer>
                    </div>
                </div>
            )}
        </div>
    );
};

export default IssuesPage;
