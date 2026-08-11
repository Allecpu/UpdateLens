export type CssActivity = {
  activityId: string;
  customerId: string;
  customerName: string;
  cssOwner: string | null;
  lastUpdate: string | null;
  blBu: string | null;
  issue: string;
  issueStatus: string;
  details: string | null;
  sourceRef: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CssMeta = {
  owners: string[];
  statuses: string[];
  customers: string[];
};

export type CssDocument = {
  documentId: string;
  filename: string;
  mimeType: string | null;
  fileType: 'docx' | 'doc' | 'pdf';
  extractionStatus: 'pending' | 'processed' | 'failed';
  extractionError: string | null;
  uploadedAt: string;
  processedAt: string | null;
};

export type CssProposalPayload = {
  customerName: string;
  cssOwner?: string | null;
  blBu?: string | null;
  issue: string;
  issueStatus: string;
  details?: string | null;
  lastUpdate?: string | null;
};

export type CssProposal = {
  proposalId: string;
  batchId: string;
  actionType: 'create' | 'update';
  targetActivityId: string | null;
  payload: CssProposalPayload;
  confidence: number;
  decisionStatus: 'pending' | 'approved' | 'rejected';
  decisionNote: string | null;
  createdAt: string;
  updatedAt: string;
};
