'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { askIntelligenceAction } from '@/app/actions';
import { cn } from '@/lib/utils';

type Message = {
  role: 'assistant' | 'user';
  content: string;
};

export function IntelligenceDialog({ 
  trigger,
  disabled = false 
}: { 
  trigger?: React.ReactNode;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: "Hi! Ask me about stock, batches, or orders." }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const result = await askIntelligenceAction(userMessage);
      if (result.success && result.data) {
        setMessages(prev => [...prev, { role: 'assistant', content: result.data.response }]);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: "Sorry, an error occurred: " + (result.error || "Unknown error") }]);
      }
    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', content: "Something went wrong. Please try again." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" disabled={disabled}>
            <Sparkles className="mr-2 h-4 w-4" /> AI Assistant
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-[95vw] w-full sm:max-w-[450px] p-0 gap-0 max-h-[85vh] flex flex-col">
        <DialogHeader className="px-4 py-3 border-b bg-emerald-50/50 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="bg-emerald-600 p-1.5 rounded-md">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold text-emerald-900">AI Assistant</DialogTitle>
              <DialogDescription className="text-xs text-emerald-600 hidden sm:block">
                Ask about stock, batches, orders
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        
        <ScrollArea className="flex-1 min-h-0 px-3 py-3" ref={scrollRef}>
          <div className="space-y-3">
            {messages.map((m, i) => (
              <div key={i} className={cn("flex gap-2", m.role === 'user' ? "flex-row-reverse" : "flex-row")}>
                <div className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0",
                  m.role === 'assistant' ? "bg-emerald-100 text-emerald-700" : "bg-zinc-100 text-zinc-700"
                )}>
                  {m.role === 'assistant' ? <Bot className="w-3 h-3" /> : <User className="w-3 h-3" />}
                </div>
                <div className={cn(
                  "max-w-[85%] rounded-xl px-3 py-2 text-sm",
                  m.role === 'assistant' 
                    ? "bg-emerald-50 text-emerald-900 rounded-tl-sm" 
                    : "bg-zinc-900 text-white rounded-tr-sm"
                )}>
                  {m.content}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-2">
                <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-3 h-3" />
                </div>
                <div className="bg-emerald-50 text-emerald-700 rounded-xl rounded-tl-sm px-3 py-2 flex items-center gap-2">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span className="text-xs">Looking up...</span>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="p-3 border-t bg-zinc-50/50 flex-shrink-0">
          <form 
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
          >
            <Input
              placeholder="Ask a question..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isLoading}
              className="flex-1 h-9 text-sm"
            />
            <Button 
              type="submit" 
              size="icon" 
              disabled={isLoading || !input.trim()}
              className="bg-emerald-600 hover:bg-emerald-700 h-9 w-9"
            >
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
