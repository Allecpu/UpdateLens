import type { Request, Response } from 'express';
import { ChatQueryRequestSchema, ChatQueryResponseSchema } from './ChatSchemas.js';
import { runChatOrchestrator } from './ChatOrchestrator.js';

export const handleChatQuery = async (req: Request, res: Response) => {
  const parsed = ChatQueryRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Payload non valido',
      details: parsed.error.flatten()
    });
  }

  try {
    const result = await runChatOrchestrator(parsed.data);
    const response = ChatQueryResponseSchema.parse(result);
    return res.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Errore inatteso durante chat query';
    return res.status(500).json({ error: message });
  }
};
