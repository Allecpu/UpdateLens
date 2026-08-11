import { useEffect, useMemo, useState } from 'react';
import type { CssActivity, CssProposal } from '../../models/Css';
import { cssService } from '../../services/CssService';

const DEFAULT_ACTIVITY = {
  customerName: '',
  cssOwner: '',
  lastUpdate: '',
  blBu: '',
  issue: '',
  issueStatus: 'Action required',
  details: ''
};

const formatDate = (value?: string | null): string => {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('it-IT');
};

const CssPage = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activities, setActivities] = useState<CssActivity[]>([]);
  const [owners, setOwners] = useState<string[]>([]);
  const [statuses, setStatuses] = useState<string[]>([]);
  const [customers, setCustomers] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [ownerFilter, setOwnerFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [customerFilter, setCustomerFilter] = useState('');

  const [activityForm, setActivityForm] = useState(DEFAULT_ACTIVITY);
  const [savingActivity, setSavingActivity] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [uploading, setUploading] = useState(false);
  const [extractingId, setExtractingId] = useState<string | null>(null);
  const [documents, setDocuments] = useState<Array<{ documentId: string; filename: string; extractionStatus: string; uploadedAt: string; extractionError: string | null }>>([]);
  const [activeBatchId, setActiveBatchId] = useState<string | null>(null);
  const [proposals, setProposals] = useState<CssProposal[]>([]);
  const [approved, setApproved] = useState<Record<string, boolean>>({});
  const [validating, setValidating] = useState(false);
  const [validationSummary, setValidationSummary] = useState<string | null>(null);

  const refreshMeta = async () => {
    const meta = await cssService.getMeta();
    setOwners(meta.owners);
    setStatuses(meta.statuses);
    setCustomers(meta.customers);
  };

  const refreshActivities = async () => {
    const result = await cssService.listActivities({
      query: query.trim() || undefined,
      owner: ownerFilter || undefined,
      status: statusFilter || undefined,
      customer: customerFilter || undefined
    });
    setActivities(result.items);
  };

  const refreshDocuments = async () => {
    const result = await cssService.listDocuments();
    setDocuments(result.items);
  };

  useEffect(() => {
    let active = true;
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        await Promise.all([refreshMeta(), refreshActivities(), refreshDocuments()]);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Errore caricamento sezione CSS');
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

  const onApplyFilters = async () => {
    setError(null);
    try {
      await refreshActivities();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore applicazione filtri');
    }
  };

  const onResetFilters = async () => {
    setOwnerFilter('');
    setStatusFilter('');
    setCustomerFilter('');
    setQuery('');
    setError(null);
    try {
      const result = await cssService.listActivities();
      setActivities(result.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore reset filtri');
    }
  };

  const onEdit = (activity: CssActivity) => {
    setEditingId(activity.activityId);
    setActivityForm({
      customerName: activity.customerName,
      cssOwner: activity.cssOwner ?? '',
      lastUpdate: activity.lastUpdate ?? '',
      blBu: activity.blBu ?? '',
      issue: activity.issue,
      issueStatus: activity.issueStatus,
      details: activity.details ?? ''
    });
  };

  const resetForm = () => {
    setEditingId(null);
    setActivityForm(DEFAULT_ACTIVITY);
  };

  const onSaveActivity = async (event: React.FormEvent) => {
    event.preventDefault();
    setSavingActivity(true);
    setError(null);
    try {
      if (editingId) {
        await cssService.updateActivity(editingId, {
          ...activityForm,
          cssOwner: activityForm.cssOwner || null,
          blBu: activityForm.blBu || null,
          lastUpdate: activityForm.lastUpdate || null,
          details: activityForm.details || null
        });
      } else {
        await cssService.createActivity({
          ...activityForm,
          cssOwner: activityForm.cssOwner || null,
          blBu: activityForm.blBu || null,
          lastUpdate: activityForm.lastUpdate || null,
          details: activityForm.details || null
        });
      }
      resetForm();
      await Promise.all([refreshActivities(), refreshMeta()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore salvataggio attività');
    } finally {
      setSavingActivity(false);
    }
  };

  const onUploadDocument = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      await cssService.uploadDocument(file);
      await refreshDocuments();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore upload documento');
    } finally {
      setUploading(false);
    }
  };

  const onExtract = async (documentId: string) => {
    setExtractingId(documentId);
    setError(null);
    setValidationSummary(null);
    try {
      const result = await cssService.extractDocument(documentId);
      setActiveBatchId(result.batchId);
      setProposals(result.proposals);
      const decisions: Record<string, boolean> = {};
      result.proposals.forEach((proposal) => {
        decisions[proposal.proposalId] = true;
      });
      setApproved(decisions);
      await refreshDocuments();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore estrazione documento');
    } finally {
      setExtractingId(null);
    }
  };

  const onValidateBatch = async () => {
    if (!activeBatchId) return;
    setValidating(true);
    setError(null);
    setValidationSummary(null);
    try {
      const decisions = proposals.map((proposal) => ({
        proposalId: proposal.proposalId,
        decision: approved[proposal.proposalId] ? ('approved' as const) : ('rejected' as const)
      }));
      const result = await cssService.validateBatch(activeBatchId, {
        decisions
      });
      setValidationSummary(`Validazione completata: ${result.applied} applicate, ${result.rejected} scartate.`);
      await Promise.all([refreshActivities(), refreshMeta()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore validazione batch');
    } finally {
      setValidating(false);
    }
  };

  const extractedCount = useMemo(() => proposals.length, [proposals.length]);

  return (
    <div className="space-y-6">
      <section className="ul-surface p-5">
        <h1 className="text-2xl font-semibold">CSS - Attività Clienti</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Nuova area operativa centralizzata per attività clienti e import meeting report.
          La selezione utenti da Microsoft Graph su SharePoint resta fuori scope in questa fase.
        </p>
      </section>

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {validationSummary && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300">
          {validationSummary}
        </div>
      )}

      <section className="ul-surface p-5">
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Cliente</label>
            <select className="ul-input h-10 w-52" value={customerFilter} onChange={(event) => setCustomerFilter(event.target.value)}>
              <option value="">Tutti</option>
              {customers.map((customer) => (
                <option key={customer} value={customer}>{customer}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">CSS Owner</label>
            <select className="ul-input h-10 w-52" value={ownerFilter} onChange={(event) => setOwnerFilter(event.target.value)}>
              <option value="">Tutti</option>
              {owners.map((owner) => (
                <option key={owner} value={owner}>{owner}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Issue Status</label>
            <select className="ul-input h-10 w-48" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="">Tutti</option>
              {statuses.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </div>
          <div className="min-w-[240px] flex-1">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Ricerca</label>
            <input className="ul-input h-10" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cliente, issue, dettagli..." />
          </div>
          <button className="ul-button ul-button-primary h-10" onClick={() => void onApplyFilters()}>Applica</button>
          <button className="ul-button ul-button-ghost h-10" onClick={() => void onResetFilters()}>Reset</button>
        </div>

        <div className="overflow-auto rounded-xl border border-border">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Customer</th>
                <th className="px-3 py-2">Last Update</th>
                <th className="px-3 py-2">BLs/BUs</th>
                <th className="px-3 py-2">Issue</th>
                <th className="px-3 py-2">Issue Status</th>
                <th className="px-3 py-2">Details</th>
                <th className="px-3 py-2">CSS Owner</th>
                <th className="px-3 py-2">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {!isLoading && activities.length === 0 && (
                <tr><td className="px-3 py-4 text-muted-foreground" colSpan={8}>Nessuna attività presente.</td></tr>
              )}
              {activities.map((activity) => (
                <tr key={activity.activityId} className="border-t border-border/70 align-top">
                  <td className="px-3 py-2 font-medium">{activity.customerName}</td>
                  <td className="px-3 py-2">{formatDate(activity.lastUpdate)}</td>
                  <td className="px-3 py-2">{activity.blBu ?? '-'}</td>
                  <td className="px-3 py-2">{activity.issue}</td>
                  <td className="px-3 py-2">{activity.issueStatus}</td>
                  <td className="px-3 py-2">{activity.details ?? '-'}</td>
                  <td className="px-3 py-2">{activity.cssOwner ?? '-'}</td>
                  <td className="px-3 py-2">
                    <button className="text-primary hover:underline" onClick={() => onEdit(activity)}>Modifica</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <form className="ul-surface p-5" onSubmit={onSaveActivity}>
          <h2 className="text-lg font-semibold">{editingId ? 'Modifica attività' : 'Nuova attività'}</h2>
          <div className="mt-4 grid gap-3">
            <input className="ul-input" placeholder="Customer" value={activityForm.customerName} onChange={(event) => setActivityForm((prev) => ({ ...prev, customerName: event.target.value }))} required />
            <input className="ul-input" placeholder="Issue" value={activityForm.issue} onChange={(event) => setActivityForm((prev) => ({ ...prev, issue: event.target.value }))} required />
            <input className="ul-input" placeholder="Issue Status" value={activityForm.issueStatus} onChange={(event) => setActivityForm((prev) => ({ ...prev, issueStatus: event.target.value }))} required />
            <input className="ul-input" placeholder="CSS Owner" value={activityForm.cssOwner} onChange={(event) => setActivityForm((prev) => ({ ...prev, cssOwner: event.target.value }))} />
            <input className="ul-input" placeholder="BLs/BUs" value={activityForm.blBu} onChange={(event) => setActivityForm((prev) => ({ ...prev, blBu: event.target.value }))} />
            <input className="ul-input" type="date" placeholder="Last Update" value={activityForm.lastUpdate} onChange={(event) => setActivityForm((prev) => ({ ...prev, lastUpdate: event.target.value }))} />
            <textarea className="ul-textarea min-h-24" placeholder="Details" value={activityForm.details} onChange={(event) => setActivityForm((prev) => ({ ...prev, details: event.target.value }))} />
          </div>
          <div className="mt-4 flex gap-2">
            <button disabled={savingActivity} className="ul-button ul-button-primary" type="submit">
              {savingActivity ? 'Salvataggio...' : editingId ? 'Aggiorna' : 'Crea attività'}
            </button>
            {editingId && (
              <button className="ul-button ul-button-ghost" type="button" onClick={resetForm}>
                Annulla
              </button>
            )}
          </div>
        </form>

        <div className="ul-surface p-5">
          <h2 className="text-lg font-semibold">Import Meeting Report</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Carica DOCX, DOC o PDF. Il sistema propone aggiornamenti/nuove attività e richiede validazione finale.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <label className="ul-button ul-button-primary cursor-pointer">
              {uploading ? 'Upload...' : 'Carica documento'}
              <input type="file" className="hidden" accept=".docx,.doc,.pdf" onChange={onUploadDocument} disabled={uploading} />
            </label>
          </div>

          <div className="mt-4 space-y-2">
            {documents.length === 0 && <p className="text-sm text-muted-foreground">Nessun documento caricato.</p>}
            {documents.map((document) => (
              <div key={document.documentId} className="rounded-xl border border-border p-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-medium">{document.filename}</div>
                    <div className="text-xs text-muted-foreground">
                      Stato: {document.extractionStatus} • Caricato: {formatDate(document.uploadedAt)}
                    </div>
                    {document.extractionError && (
                      <div className="mt-1 text-xs text-destructive">{document.extractionError}</div>
                    )}
                  </div>
                  <button
                    className="ul-button ul-button-ghost"
                    onClick={() => void onExtract(document.documentId)}
                    disabled={extractingId === document.documentId}
                  >
                    {extractingId === document.documentId ? 'Analisi...' : 'Analizza'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="ul-surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Proposte da validare</h2>
          <div className="text-sm text-muted-foreground">
            Batch: {activeBatchId ?? '-'} • Proposte: {extractedCount}
          </div>
        </div>
        {proposals.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Nessuna proposta disponibile.</p>
        ) : (
          <>
            <div className="mt-3 space-y-2">
              {proposals.map((proposal) => (
                <div key={proposal.proposalId} className="rounded-xl border border-border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="font-medium">
                        [{proposal.actionType.toUpperCase()}] {proposal.payload.customerName} - {proposal.payload.issue}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Status proposto: {proposal.payload.issueStatus} • Confidence: {(proposal.confidence * 100).toFixed(0)}%
                      </div>
                      {proposal.payload.details && (
                        <p className="mt-1 text-sm text-muted-foreground">{proposal.payload.details}</p>
                      )}
                    </div>
                    <label className="inline-flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={approved[proposal.proposalId] ?? true}
                        onChange={(event) =>
                          setApproved((prev) => ({ ...prev, [proposal.proposalId]: event.target.checked }))
                        }
                      />
                      Applica
                    </label>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4">
              <button className="ul-button ul-button-primary" onClick={() => void onValidateBatch()} disabled={validating || !activeBatchId}>
                {validating ? 'Validazione...' : 'Conferma validazione'}
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
};

export default CssPage;
