import { z } from 'zod';

export const completionNoteSchema = z.object({
  note: z.string().min(1, 'Completion note required'),
});

export type CompletionNoteInput = z.infer<typeof completionNoteSchema>;
