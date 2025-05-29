'use client';

import { useState } from 'react';
import { summarizeInventoryHistory, type SummarizeInventoryHistoryInput } from '@/ai/flows/summarize-inventory-history';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Bot, Send } from 'lucide-react';

export default function InventoryHistorySummarizer() {
  const [inventoryHistory, setInventoryHistory] = useState<string>('');
  const [query, setQuery] = useState<string>('');
  const [summary, setSummary] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (!inventoryHistory.trim() || !query.trim()) {
      toast({
        title: 'Missing Information',
        description: 'Please provide both inventory history and a query.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    setSummary('');

    try {
      const input: SummarizeInventoryHistoryInput = { inventoryHistory, query };
      const result = await summarizeInventoryHistory(input);
      setSummary(result.summary);
      toast({
        title: 'Summary Generated',
        description: 'AI has summarized the inventory history.',
      });
    } catch (error) {
      console.error('Error summarizing inventory history:', error);
      toast({
        title: 'Error',
        description: 'Failed to generate summary. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="text-xl font-semibold flex items-center">
          <Bot className="mr-2 h-6 w-6 text-primary" />
          AI Inventory Insights
        </CardTitle>
        <CardDescription>
          Get AI-powered summaries of inventory history to help you decide what to include on the gate pass.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="inventoryHistory">Inventory History</Label>
          <Textarea
            id="inventoryHistory"
            value={inventoryHistory}
            onChange={e => setInventoryHistory(e.target.value)}
            placeholder="Paste or type inventory history here..."
            rows={6}
            disabled={isLoading}
          />
        </div>
        <div>
          <Label htmlFor="aiQuery">Your Question / Focus</Label>
          <Textarea
            id="aiQuery"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="e.g., 'What items were frequently moved out last month?', 'Any discrepancies for item X?'"
            rows={3}
            disabled={isLoading}
          />
        </div>
        <Button onClick={handleSubmit} disabled={isLoading || !inventoryHistory.trim() || !query.trim()} className="w-full">
          {isLoading ? (
            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          ) : (
            <Send className="mr-2 h-5 w-5" />
          )}
          {isLoading ? 'Generating Summary...' : 'Get AI Summary'}
        </Button>
        {summary && (
          <div className="mt-4 p-4 border rounded-lg bg-muted/50">
            <h4 className="font-semibold text-md mb-2">AI Summary:</h4>
            <p className="text-sm whitespace-pre-wrap">{summary}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
