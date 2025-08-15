
'use client';

import { useEffect, useState, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { batchChatAction } from '@/app/actions';
import type { Batch } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { MessageSquare, AlertTriangle, Send, User, Bot } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { ScrollArea } from './ui/scroll-area';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';

interface BatchChatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  batchId: string | undefined | null;
  batchNumber: string | undefined | null;
}

interface ChatMsg {
    id: string;
    role: 'user' | 'bot';
    text: string;
}

export function BatchChatDialog({
  open,
  onOpenChange,
  batchId,
  batchNumber,
}: BatchChatDialogProps) {
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const { toast } = useToast();
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && batchNumber) {
        setMessages([
            { id: 'welcome', role: 'bot', text: `Hi! I'm your AI assistant for batch #${batchNumber}. Ask me anything about this batch.` }
        ]);
    }
  }, [open, batchNumber]);

  useEffect(() => {
    // Scroll to bottom when new messages are added
    if (scrollAreaRef.current) {
        scrollAreaRef.current.scrollTo({ top: scrollAreaRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages]);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !batchId) return;

    const userMessage: ChatMsg = { id: crypto.randomUUID(), role: 'user', text: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    const result = await batchChatAction(batchId, input);

    if (result.success && result.data) {
        const botMessage: ChatMsg = { id: crypto.randomUUID(), role: 'bot', text: result.data.response };
        setMessages(prev => [...prev, botMessage]);
    } else {
        toast({
            variant: "destructive",
            title: "AI Chat Error",
            description: result.error,
        });
        const errorMessage: ChatMsg = { id: crypto.randomUUID(), role: 'bot', text: "Sorry, I couldn't get a response. Please try again." };
        setMessages(prev => [...prev, errorMessage]);
    }
    setLoading(false);
  }

  const handleOpenChange = (isOpen: boolean) => {
    onOpenChange(isOpen);
    if (!isOpen) {
        setMessages([]);
        setInput('');
        setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg flex flex-col h-[70vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-headline text-2xl">
            <MessageSquare className="text-primary" />
            Chat about Batch #{batchNumber}
          </DialogTitle>
          <DialogDescription>
            Ask questions to get AI-powered insights on this batch.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="flex-1 pr-4 -mr-4" ref={scrollAreaRef}>
            <div className="space-y-4 py-4">
                {messages.map(m => (
                    <div key={m.id} className={cn(
                        "flex items-start gap-3",
                        m.role === 'user' ? 'justify-end' : 'justify-start'
                    )}>
                        {m.role === 'bot' && (
                            <Avatar className="w-8 h-8 border-2 border-primary">
                                <AvatarFallback><Bot /></AvatarFallback>
                            </Avatar>
                        )}
                        <div className={cn(
                            "p-3 rounded-lg max-w-sm",
                            m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'
                        )}>
                            <p className="text-sm">{m.text}</p>
                        </div>
                         {m.role === 'user' && (
                            <Avatar className="w-8 h-8">
                                <AvatarFallback><User /></AvatarFallback>
                            </Avatar>
                        )}
                    </div>
                ))}
                {loading && (
                    <div className="flex items-start gap-3 justify-start">
                         <Avatar className="w-8 h-8 border-2 border-primary">
                            <AvatarFallback><Bot /></AvatarFallback>
                        </Avatar>
                        <div className="p-3 rounded-lg bg-muted">
                            <Skeleton className="w-20 h-5" />
                        </div>
                    </div>
                )}
            </div>
        </ScrollArea>
        <form onSubmit={handleSubmit} className="flex gap-2 pt-4 border-t">
            <Input 
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Ask a question about this batch..."
                disabled={loading}
            />
            <Button type="submit" disabled={loading || !input.trim()}>
                <Send />
            </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
