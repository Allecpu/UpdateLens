/**
 * Export service for CSV, Excel, and PDF formats
 * Converts activities to different file formats
 */

import type { CssActivity } from '../../models/Css';

export type ExportFormat = 'csv' | 'excel' | 'pdf' | 'json';

export interface ExportOptions {
  filename?: string;
  includeColumns?: string[];
  dateFormat?: string;
  encoding?: 'utf-8' | 'iso-8859-1';
}

/**
 * CSV Exporter
 */
class CSVExporter {
  static export(activities: CssActivity[], options: ExportOptions = {}): string {
    const { includeColumns } = options;

    // Define columns
    const defaultColumns = [
      'customerName',
      'issue',
      'issueStatus',
      'listStatus',
      'details',
      'cssOwner',
      'blBu',
      'eosOwners',
      'customerOwners',
      'cssAction',
      'notes',
      'customerPriority',
      'cssPriority',
      'dueDate',
      'lastUpdate',
      'rating',
      'itemType'
    ];

    const columns = includeColumns?.filter((c) => defaultColumns.includes(c)) || defaultColumns;

    // Header
    const header = columns.join(',');

    // Rows
    const rows = activities.map((activity) =>
      columns
        .map((col) => {
          const value = (activity as any)[col];
          if (value == null) return '';

          // Escape quotes and wrap in quotes if contains comma/quote/newline
          const stringValue = String(value);
          if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
            return `"${stringValue.replace(/"/g, '""')}"`;
          }
          return stringValue;
        })
        .join(',')
    );

    const csv = [header, ...rows].join('\n');
    return csv;
  }

  static download(activities: CssActivity[], filename: string = 'export.csv', options: ExportOptions = {}) {
    const csv = this.export(activities, options);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
  }
}

/**
 * JSON Exporter
 */
class JSONExporter {
  static export(activities: CssActivity[], options: ExportOptions = {}): string {
    const { includeColumns } = options;

    let data = activities;
    if (includeColumns) {
      data = activities.map((activity) => {
        const filtered: any = {};
        for (const col of includeColumns) {
          if (col in activity) {
            filtered[col] = (activity as any)[col];
          }
        }
        return filtered;
      });
    }

    return JSON.stringify(data, null, 2);
  }

  static download(activities: CssActivity[], filename: string = 'export.json', options: ExportOptions = {}) {
    const json = this.export(activities, options);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
  }
}

/**
 * Excel Exporter (requires external library like xlsx)
 * For now, we'll create a basic implementation using CSV-like format with tabs
 */
class ExcelExporter {
  static export(activities: CssActivity[], options: ExportOptions = {}): string {
    // Use tab-separated values which Excel can open
    const { includeColumns } = options;

    const defaultColumns = [
      'customerName',
      'issue',
      'issueStatus',
      'listStatus',
      'details',
      'cssOwner',
      'blBu',
      'eosOwners',
      'customerOwners',
      'cssAction',
      'notes',
      'customerPriority',
      'cssPriority',
      'dueDate',
      'lastUpdate',
      'rating',
      'itemType'
    ];

    const columns = includeColumns?.filter((c) => defaultColumns.includes(c)) || defaultColumns;

    // Header
    const header = columns.join('\t');

    // Rows
    const rows = activities.map((activity) =>
      columns
        .map((col) => {
          const value = (activity as any)[col];
          return value == null ? '' : String(value);
        })
        .join('\t')
    );

    const tsv = [header, ...rows].join('\n');
    return tsv;
  }

  static download(activities: CssActivity[], filename: string = 'export.xlsx', options: ExportOptions = {}) {
    const tsv = this.export(activities, options);
    // Excel can open TSV files
    const blob = new Blob([tsv], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
    link.click();
  }
}

/**
 * HTML Exporter (for print-friendly view)
 */
class HTMLExporter {
  static export(activities: CssActivity[], options: ExportOptions = {}): string {
    const { includeColumns } = options;

    const defaultColumns = [
      'customerName',
      'issue',
      'issueStatus',
      'listStatus',
      'details',
      'cssOwner',
      'cssAction',
      'notes',
      'rating'
    ];

    const columns = includeColumns?.filter((c) => defaultColumns.includes(c)) || defaultColumns;

    const columnLabels: Record<string, string> = {
      customerName: 'Cliente',
      issue: 'Issue',
      issueStatus: 'Status',
      listStatus: 'List Status',
      details: 'Dettagli',
      cssOwner: 'CSS Owner',
      cssAction: 'Azione',
      notes: 'Note',
      rating: 'Rating',
      blBu: 'BL/BU',
      eosOwners: 'EOS Owner',
      customerOwners: 'Customer Owner',
      customerPriority: 'Priorità Cliente',
      cssPriority: 'Priorità CSS',
      dueDate: 'Scadenza',
      lastUpdate: 'Ultimo Aggiornamento',
      itemType: 'Tipo'
    };

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Export Attività CSS</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
    th { background-color: #f5f5f5; font-weight: bold; }
    tr:nth-child(even) { background-color: #f9f9f9; }
    .rating { text-align: center; }
  </style>
</head>
<body>
  <h1>Export Attività CSS</h1>
  <p>Esportato il: ${new Date().toLocaleString()}</p>
  <table>
    <thead>
      <tr>
        ${columns.map((col) => `<th>${columnLabels[col] || col}</th>`).join('')}
      </tr>
    </thead>
    <tbody>
      ${activities
        .map(
          (activity) =>
            `<tr>
        ${columns
          .map((col) => {
            const value = (activity as any)[col] ?? '';
            return `<td>${String(value).replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>`;
          })
          .join('')}
      </tr>`
        )
        .join('')}
    </tbody>
  </table>
</body>
</html>
    `;

    return html;
  }

  static download(activities: CssActivity[], filename: string = 'export.html', options: ExportOptions = {}) {
    const html = this.export(activities, options);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
  }
}

/**
 * Main export service
 */
export const exportService = {
  /**
   * Export to specified format
   */
  export(format: ExportFormat, activities: CssActivity[], options: ExportOptions = {}): string {
    switch (format) {
      case 'csv':
        return CSVExporter.export(activities, options);
      case 'excel':
        return ExcelExporter.export(activities, options);
      case 'json':
        return JSONExporter.export(activities, options);
      case 'pdf':
      default:
        // For PDF, we'd need a library like pdfkit or jspdf
        // For now, return HTML which can be printed to PDF
        return HTMLExporter.export(activities, options);
    }
  },

  /**
   * Download file directly
   */
  download(format: ExportFormat, activities: CssActivity[], filename?: string, options: ExportOptions = {}) {
    const defaultFilenames: Record<ExportFormat, string> = {
      csv: `activities-${new Date().toISOString().split('T')[0]}.csv`,
      excel: `activities-${new Date().toISOString().split('T')[0]}.xlsx`,
      json: `activities-${new Date().toISOString().split('T')[0]}.json`,
      pdf: `activities-${new Date().toISOString().split('T')[0]}.html`
    };

    const finalFilename = filename || defaultFilenames[format];

    switch (format) {
      case 'csv':
        CSVExporter.download(activities, finalFilename, options);
        break;
      case 'excel':
        ExcelExporter.download(activities, finalFilename, options);
        break;
      case 'json':
        JSONExporter.download(activities, finalFilename, options);
        break;
      case 'pdf':
        HTMLExporter.download(activities, finalFilename, options);
        break;
    }
  },

  /**
   * Get column preview
   */
  getAvailableColumns(): Array<{ key: string; label: string }> {
    return [
      { key: 'customerName', label: 'Cliente' },
      { key: 'issue', label: 'Issue' },
      { key: 'issueStatus', label: 'Status' },
      { key: 'listStatus', label: 'List Status' },
      { key: 'details', label: 'Dettagli' },
      { key: 'cssOwner', label: 'CSS Owner' },
      { key: 'blBu', label: 'BL/BU' },
      { key: 'eosOwners', label: 'EOS Owner' },
      { key: 'customerOwners', label: 'Customer Owner' },
      { key: 'cssAction', label: 'Azione' },
      { key: 'notes', label: 'Note' },
      { key: 'customerPriority', label: 'Priorità Cliente' },
      { key: 'cssPriority', label: 'Priorità CSS' },
      { key: 'dueDate', label: 'Scadenza' },
      { key: 'lastUpdate', label: 'Ultimo Aggiornamento' },
      { key: 'rating', label: 'Rating' },
      { key: 'itemType', label: 'Tipo' }
    ];
  }
};
