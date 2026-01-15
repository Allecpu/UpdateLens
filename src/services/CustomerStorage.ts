import type { Customer, CustomerIndexEntry } from '../models/Customer';
import type { FilterState } from '../models/Filters';

type FilterMode = 'inherit' | 'custom';

const INDEX_KEY = 'updatelens.customers.index';
const CUSTOMER_KEY_PREFIX = 'updatelens.customer.';

const readJson = <T,>(key: string): T | null => {
  const raw = localStorage.getItem(key);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

const writeJson = (key: string, value: unknown): void => {
  localStorage.setItem(key, JSON.stringify(value));
};

export const loadCustomerIndex = (): CustomerIndexEntry[] => {
  return readJson<CustomerIndexEntry[]>(INDEX_KEY) ?? [];
};

export const saveCustomerIndex = (entries: CustomerIndexEntry[]): void => {
  writeJson(INDEX_KEY, entries);
};

export const loadCustomer = (id: string): Customer | null => {
  return readJson<Customer>(`${CUSTOMER_KEY_PREFIX}${id}`);
};

export const saveCustomer = (customer: Customer): void => {
  writeJson(`${CUSTOMER_KEY_PREFIX}${customer.id}`, customer);
};

export const deleteCustomer = (id: string): void => {
  localStorage.removeItem(`${CUSTOMER_KEY_PREFIX}${id}`);
};

export const exportCustomers = (
  index: CustomerIndexEntry[],
  customers: Record<string, Customer>,
  customerFilters: Record<string, FilterState>,
  customerFilterMode: Record<string, FilterMode>
): string => {
  return JSON.stringify(
    {
      version: 1,
      index,
      customers,
      customerFilters,
      customerFilterMode
    },
    null,
    2
  );
};

export const importCustomers = (
  payload: string
): {
  index: CustomerIndexEntry[];
  customers: Record<string, Customer>;
  customerFilters: Record<string, FilterState>;
  customerFilterMode: Record<string, FilterMode>;
} => {
  const parsed = JSON.parse(payload) as {
    index?: CustomerIndexEntry[];
    customers?: Record<string, Customer>;
    customerFilters?: Record<string, FilterState>;
    customerFilterMode?: Record<string, FilterMode>;
  };
  return {
    index: parsed.index ?? [],
    customers: parsed.customers ?? {},
    customerFilters: parsed.customerFilters ?? {},
    customerFilterMode: parsed.customerFilterMode ?? {}
  };
};
