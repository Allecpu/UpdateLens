export type CustomerOverride = {
  sources?: string[];
  statuses?: string[];
  horizonMonths?: number;
  historyMonths?: number;
};

export type CustomerCommsEntry = {
  date: string | null;
  text: string;
};

export type Customer = {
  id: string;
  name: string;
  ownerCss?: string;
  isActive?: boolean;
  selectedProducts: string[];
  overrides: CustomerOverride;
  commsLog: CustomerCommsEntry[];
};

export type CustomerIndexEntry = {
  id: string;
  name: string;
  ownerCss?: string;
  isActive?: boolean;
};
