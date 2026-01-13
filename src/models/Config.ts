import { z } from 'zod';
import { ReleaseSourceSchema, ReleaseStatusSchema } from './ReleaseItem';

export const ProductSchema = z.object({
  id: z.string(),
  label: z.string(),
  source: ReleaseSourceSchema,
  category: z.string().optional(),
  tags: z.array(z.string()).optional()
});

export const ProductsConfigSchema = z.object({
  version: z.number(),
  items: z.array(ProductSchema),
  categories: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional()
});

export const RulesConfigSchema = z.object({
  version: z.number(),
  defaults: z.object({
    sources: z.array(ReleaseSourceSchema),
    statuses: z.array(ReleaseStatusSchema),
    horizonMonths: z.number(),
    historyMonths: z.number()
  })
});

export type Product = z.infer<typeof ProductSchema>;
export type ProductsConfig = z.infer<typeof ProductsConfigSchema>;
export type RulesConfig = z.infer<typeof RulesConfigSchema>;
