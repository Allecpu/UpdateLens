import { z } from 'zod';
import { LEARN_TYPES } from '../utils/learn';

export const ReleaseSourceSchema = z.enum(['Microsoft', 'EOS', 'Fabric', 'MICROSOFT 365']);
export const ReleaseStatusSchema = z.enum([
  'Planned',
  'Rolling out',
  'Try now',
  'Launched',
  'Unknown'
]);

export const ReleaseItemSchema = z.object({
  id: z.string(),
  productId: z.string(),
  releasePlanId: z.string().optional().nullable(),
  sourcePlanId: z.string().optional().nullable(),
  sourceAppName: z.string().optional().nullable(),
  source: ReleaseSourceSchema,
  product: z.string(),
  productName: z.string(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  wave: z.string().optional(),
  availabilityTypes: z.array(z.string()).optional(),
  enabledFor: z.string().optional(),
  geography: z.string().optional(),
  geographyCountries: z.array(z.string()).optional(),
  language: z.string().optional(),
  firstAvailableDate: z.string().optional(),
  lastUpdatedDate: z.string().optional(),
  title: z.string(),
  summary: z.string(),
  description: z.string(),
  status: ReleaseStatusSchema,
  availabilityDate: z.string(),
  availabilityDateFull: z.string().optional(),
  releaseDate: z.string(),
  tryNow: z.boolean(),
  minBcVersion: z.number().nullable(),
  sourceUrl: z.string().url().nullable().optional(),
  learnUrl: z.string().url().nullable().optional(),
  docsUrl: z.string().url().nullable().optional(),
  learnMeta: z
    .object({
      title: z.string(),
      type: z.enum(LEARN_TYPES),
      level: z.string().optional(),
      uid: z.string().optional(),
      productKey: z.string().optional(),
      score: z.number().optional()
    })
    .nullable()
    .optional(),
  url: z.string().url().nullable().optional()
});

export type ReleaseItem = z.infer<typeof ReleaseItemSchema>;
export type ReleaseSource = z.infer<typeof ReleaseSourceSchema>;
export type ReleaseStatus = z.infer<typeof ReleaseStatusSchema>;
