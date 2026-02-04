import { z } from 'zod';

const SourceSchema = z.enum(['Microsoft', 'EOS', 'Fabric', 'MICROSOFT 365']);

const FilterPatchSchema = z
  .object({
    products: z.array(z.string()).optional(),
    sources: z.array(SourceSchema).optional(),
    statuses: z.array(z.string()).optional(),
    categories: z.array(z.string()).optional(),
    waves: z.array(z.string()).optional(),
    availabilityTypes: z.array(z.string()).optional(),
    periodNewDays: z.number().int().nonnegative().optional(),
    releaseDateFrom: z.string().optional(),
    releaseDateTo: z.string().optional(),
    query: z.string().optional()
  })
  .partial();

export const ChatQueryRequestSchema = z.object({
  message: z.string().trim().min(1).max(500),
  searchScope: z.enum(['current', 'all']).default('all'),
  baseFilters: z.record(z.unknown()).optional(),
  chatContext: z.record(z.unknown()).optional(),
  preferAzure: z.boolean().optional().default(false),
  topK: z.number().int().positive().max(20).default(5)
});

export const ChatQueryResponseSchema = z.object({
  message: z.string(),
  items: z.array(z.record(z.unknown())),
  showPreview: z.boolean(),
  canApplyFilters: z.boolean(),
  filterPatch: FilterPatchSchema,
  engine: z.enum(['local', 'azure']),
  fallbackUsed: z.boolean(),
  traceId: z.string(),
  confidence: z.number().min(0).max(1).optional(),
  model: z.string().optional()
});

export type ChatQueryRequest = z.infer<typeof ChatQueryRequestSchema>;
export type ChatQueryResponse = z.infer<typeof ChatQueryResponseSchema>;
