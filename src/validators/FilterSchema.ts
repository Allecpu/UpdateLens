import { z } from 'zod';

export const FilterStateSchema = z.object({
    targetCustomerIds: z.array(z.string()),
    targetGroupIds: z.array(z.string()),
    targetCssOwners: z.array(z.string()),
    products: z.array(z.string()),
    sources: z.array(z.string()),
    statuses: z.array(z.string()),
    categories: z.array(z.string()),
    tags: z.array(z.string()),
    waves: z.array(z.string()),
    months: z.array(z.string()),
    availabilityTypes: z.array(z.string()),
    enabledFor: z.array(z.string()),
    geography: z.array(z.string()),
    language: z.array(z.string()),
    bcVersions: z.array(z.string()),
    periodNewDays: z.number(),
    periodChangedDays: z.number(),
    releaseInDays: z.number(),
    minBcVersionMin: z.number().nullable(),
    releaseDateFrom: z.string(),
    releaseDateTo: z.string(),
    sortOrder: z.enum(['newest', 'oldest']),
    query: z.string(),
    horizonMonths: z.number(),
    historyMonths: z.number()
});

export const ExportMetadataSchema = z.object({
    appVersion: z.string(),
    exportedAt: z.string(),
    schemaVersion: z.number()
});

export const FilterExportSchema = z.object({
    meta: ExportMetadataSchema,
    data: FilterStateSchema
});

export type FilterExport = z.infer<typeof FilterExportSchema>;
