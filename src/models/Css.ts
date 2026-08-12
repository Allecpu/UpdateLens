export type CssActivity = {
  activityId: string;
  customerId: string;
  customerName: string;
  cssOwner: string | null;
  lastUpdate: string | null;
  blBu: string | null;
  issue: string;
  listStatus: string | null;
  issueStatus: string;
  details: string | null;
  eosOwners: string | null;
  customerOwners: string | null;
  cssAction: string | null;
  notes: string | null;
  customerPriority: string | null;
  cssPriority: string | null;
  dueDate: string | null;
  rating: number | null;
  itemType: string | null;
  sourceRef: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CssMeta = {
  owners: string[];
  statuses: string[];
  customers: string[];
};

export type CssCustomer = {
  customerId: string;
  name: string;
  aliases: string[];
  isActive: boolean;
  activityCount: number;
  createdAt: string;
  updatedAt: string;
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
