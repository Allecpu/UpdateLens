/**
 * Export panel UI for downloading activities in multiple formats
 */

import { useState } from 'react';
import type { CssActivity } from '../../models/Css';
import { exportService, type ExportFormat, type ExportOptions } from '../services/exportService';
import { auditService } from '../services/auditService';

interface ExportPanelProps {
  activities: CssActivity[];
  filters?: Record<string, any>;
}

export function ExportPanel({ activities, filters }: ExportPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('csv');
  const [selectedColumns, setSelectedColumns] = useState<string[]>([
    'customerName',
    'issue',
    'issueStatus',
    'details',
    'cssOwner',
    'cssAction'
  ]);
  const [isExporting, setIsExporting] = useState(false);

  const availableColumns = exportService.getAvailableColumns();

  const handleColumnToggle = (columnKey: string) => {
    setSelectedColumns((prev) =>
      prev.includes(columnKey)
        ? prev.filter((c) => c !== columnKey)
        : [...prev, columnKey]
    );
  };

  const handleSelectAllColumns = () => {
    setSelectedColumns(availableColumns.map((c) => c.key));
  };

  const handleDeselectAll = () => {
    setSelectedColumns([]);
  };

  const handleExport = () => {
    setIsExporting(true);
    try {
      const filename = `activities-${new Date().toISOString().split('T')[0]}.${selectedFormat === 'excel' ? 'xlsx' : selectedFormat}`;
      const options: ExportOptions = {
        filename,
        includeColumns: selectedColumns
      };

      exportService.download(selectedFormat, activities, filename, options);

      // Log export to audit trail (only for csv and excel)
      if (selectedFormat === 'csv' || selectedFormat === 'excel') {
        auditService.logExport(selectedFormat, activities.length, 'current-user', filters);
      }
    } catch (error) {
      console.error('Export failed:', error);
      alert('Errore durante l\'esportazione');
    } finally {
      setIsExporting(false);
    }
  };

  const formatLabels: Record<ExportFormat, { label: string; description: string }> = {
    csv: {
      label: 'CSV',
      description: 'Comma-separated values, compatibile con Excel e fogli di calcolo'
    },
    excel: {
      label: 'Excel/TSV',
      description: 'Tab-separated values, aperto direttamente in Excel'
    },
    json: {
      label: 'JSON',
      description: 'Formato JSON strutturato, ideale per integrazioni'
    },
    pdf: {
      label: 'HTML/PDF',
      description: 'Tabella HTML stampabile come PDF'
    }
  };

  return (
    <div className="rounded-lg border border-border/60 bg-muted/10 p-4">
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-primary"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? '▼' : '▶'} 📥 Esporta Dati ({activities.length} record)
        </button>
      </div>

      {isExpanded && (
        <div className="space-y-4">
          {/* Format Selection */}
          <div>
            <label className="mb-2 block text-sm font-medium">Formato Esportazione</label>
            <div className="grid gap-2 sm:grid-cols-2">
              {(Object.keys(formatLabels) as ExportFormat[]).map((format) => (
                <label
                  key={format}
                  className="flex cursor-pointer items-start gap-3 rounded-lg border border-border/40 p-3 transition-colors hover:bg-muted/30"
                >
                  <input
                    type="radio"
                    name="format"
                    value={format}
                    checked={selectedFormat === format}
                    onChange={(e) => setSelectedFormat(e.target.value as ExportFormat)}
                    className="mt-1 h-4 w-4"
                  />
                  <div>
                    <div className="font-medium text-sm">{formatLabels[format].label}</div>
                    <div className="text-xs text-muted-foreground">{formatLabels[format].description}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Column Selection */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="block text-sm font-medium">Colonne da Esportare</label>
              <div className="flex gap-1">
                <button
                  type="button"
                  className="ul-button ul-button-ghost h-7 px-2 text-xs"
                  onClick={handleSelectAllColumns}
                >
                  Tutte
                </button>
                <button
                  type="button"
                  className="ul-button ul-button-ghost h-7 px-2 text-xs"
                  onClick={handleDeselectAll}
                >
                  Nessuna
                </button>
              </div>
            </div>

            <div className="grid gap-2 rounded-lg border border-border/40 bg-background/50 p-3 sm:grid-cols-2 md:grid-cols-3">
              {availableColumns.map((col) => (
                <label
                  key={col.key}
                  className="flex cursor-pointer items-center gap-2 text-sm hover:text-foreground"
                >
                  <input
                    type="checkbox"
                    checked={selectedColumns.includes(col.key)}
                    onChange={() => handleColumnToggle(col.key)}
                    className="h-4 w-4"
                  />
                  <span className="text-xs text-muted-foreground">{col.label}</span>
                </label>
              ))}
            </div>

            <div className="mt-2 text-xs text-muted-foreground">
              {selectedColumns.length} di {availableColumns.length} colonne selezionate
            </div>
          </div>

          {/* Export Info */}
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-900/20">
            <div className="text-xs text-blue-900 dark:text-blue-100">
              <strong>📊 Anteprima:</strong> Esporterai{' '}
              <strong>{activities.length} record</strong> con{' '}
              <strong>{selectedColumns.length} colonne</strong> in formato{' '}
              <strong>{formatLabels[selectedFormat].label}</strong>
            </div>
          </div>

          {/* Export Button */}
          <div className="flex gap-2">
            <button
              type="button"
              className="ul-button ul-button-primary h-9 flex-1 px-4 disabled:opacity-50"
              onClick={handleExport}
              disabled={isExporting || selectedColumns.length === 0 || activities.length === 0}
            >
              {isExporting ? 'Esportazione in corso...' : `📥 Esporta come ${formatLabels[selectedFormat].label}`}
            </button>
            <button
              type="button"
              className="ul-button ul-button-ghost h-9 px-4"
              onClick={() => setIsExpanded(false)}
            >
              Chiudi
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
