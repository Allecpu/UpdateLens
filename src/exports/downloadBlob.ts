/**
 * Download di un Blob nel browser.
 *
 * Estratto da `downloadMarkdown` (src/services/ExportService.ts) per poter
 * scaricare anche contenuti binari come il .pptx generato da pptxgenjs.
 */
export const downloadBlob = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};
