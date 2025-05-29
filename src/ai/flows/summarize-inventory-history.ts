// SummarizeInventoryHistory.ts
'use server';

/**
 * @fileOverview A flow for summarizing inventory history using AI.
 *
 * - summarizeInventoryHistory - A function that handles the inventory history summarization process.
 * - SummarizeInventoryHistoryInput - The input type for the summarizeInventoryHistory function.
 * - SummarizeInventoryHistoryOutput - The return type for the summarizeInventoryHistory function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SummarizeInventoryHistoryInputSchema = z.object({
  inventoryHistory: z
    .string()
    .describe('The complete history of the inventory as a string.'),
  query: z
    .string()
    .describe(
      'The specific question or focus for the inventory history summary.'
    ),
});

export type SummarizeInventoryHistoryInput = z.infer<
  typeof SummarizeInventoryHistoryInputSchema
>;

const SummarizeInventoryHistoryOutputSchema = z.object({
  summary: z
    .string()
    .describe('A concise summary of the inventory history.'),
});

export type SummarizeInventoryHistoryOutput = z.infer<
  typeof SummarizeInventoryHistoryOutputSchema
>;

export async function summarizeInventoryHistory(
  input: SummarizeInventoryHistoryInput
): Promise<SummarizeInventoryHistoryOutput> {
  return summarizeInventoryHistoryFlow(input);
}

const summarizeInventoryHistoryPrompt = ai.definePrompt({
  name: 'summarizeInventoryHistoryPrompt',
  input: {schema: SummarizeInventoryHistoryInputSchema},
  output: {schema: SummarizeInventoryHistoryOutputSchema},
  prompt: `You are an AI assistant specializing in summarizing inventory history data to assist users in making gate pass decisions.

  Summarize the following inventory history, focusing on answering the user's query as specifically as possible. The summary should be concise and highlight key information relevant to the query.

  Inventory History: {{{inventoryHistory}}}
  Query: {{{query}}}

  Ensure the summary is easily understandable and actionable for making informed decisions about which items to include on the gate pass.
  `,
});

const summarizeInventoryHistoryFlow = ai.defineFlow(
  {
    name: 'summarizeInventoryHistoryFlow',
    inputSchema: SummarizeInventoryHistoryInputSchema,
    outputSchema: SummarizeInventoryHistoryOutputSchema,
  },
  async input => {
    const {output} = await summarizeInventoryHistoryPrompt(input);
    return output!;
  }
);
