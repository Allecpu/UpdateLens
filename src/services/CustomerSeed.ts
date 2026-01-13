import type { Customer, CustomerIndexEntry } from '../models/Customer';
import type { ProductsConfig, RulesConfig } from '../models/Config';
import customersIndex from '../data/customer/customers.index.json';

type CustomerSeedItem = {
  id: string;
  displayName: string;
  ownerCss?: string;
};

type CustomerSeedPayload = {
  version: string;
  items: CustomerSeedItem[];
};

export const loadSeedOwnerMap = (): Record<string, string> => {
  const payload = customersIndex as CustomerSeedPayload;
  const map: Record<string, string> = {};
  payload.items.forEach((item) => {
    if (item.ownerCss) {
      map[item.id] = item.ownerCss;
    }
  });
  return map;
};

export const loadSeedCustomers = (
  productsConfig: ProductsConfig,
  rulesConfig: RulesConfig
): { index: CustomerIndexEntry[]; customers: Record<string, Customer> } => {
  const payload = customersIndex as CustomerSeedPayload;
  const selectedProducts = productsConfig.items.map((item) => item.label);

  const index: CustomerIndexEntry[] = [];
  const customers: Record<string, Customer> = {};

  payload.items.forEach((item) => {
    const customer: Customer = {
      id: item.id,
      name: item.displayName,
      ownerCss: item.ownerCss ?? '',
      isActive: true,
      selectedProducts,
      overrides: {
        sources: rulesConfig.defaults.sources,
        statuses: rulesConfig.defaults.statuses,
        horizonMonths: rulesConfig.defaults.horizonMonths,
        historyMonths: rulesConfig.defaults.historyMonths
      },
      commsLog: []
    };
    index.push({
      id: item.id,
      name: item.displayName,
      ownerCss: item.ownerCss ?? '',
      isActive: true
    });
    customers[item.id] = customer;
  });

  return { index, customers };
};
