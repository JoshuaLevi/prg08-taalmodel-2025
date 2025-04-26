'use client';

import type React from 'react';

import { useToast } from '@/hooks/use-toast';
import { useRef, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Paperclip, ArrowUp, Loader2, Activity } from 'lucide-react';
import { ExamplePrompts } from '@/components/example-prompts';
import { ChatMessage } from '@/components/chat-message';
import { FilePreview } from '@/components/file-preview';
import { client } from '@/lib/langgraph-client';
import {
  AgentState,
  documentType,
  PDFDocument,
  RetrieveDocumentsNodeUpdates,
} from '@/types/graphTypes';
import { Card } from '@/components/ui/card';
import { Header } from '@/components/header';

export default function Home() {
  const { toast } = useToast(); // Add this hook
  const [messages, setMessages] = useState<
    Array<{
      role: 'user' | 'assistant';
      content: string;
      sources?: PDFDocument[];
    }>
  >([]);
  const [input, setInput] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null); // Track the AbortController
  const messagesEndRef = useRef<HTMLDivElement>(null); // Add this ref
  const lastRetrievedDocsRef = useRef<PDFDocument[]>([]); // useRef to store the last retrieved documents

  useEffect(() => {
    // Create a thread when the component mounts
    const initThread = async () => {
      // Skip if we already have a thread
      if (threadId) return;

      try {
        const thread = await client.createThread();

        setThreadId(thread.thread_id);
      } catch (error) {
        console.error('Error creating thread:', error);
        toast({
          title: 'Fout',
          description:
            'Fout bij het aanmaken van de thread. Controleer of de LANGGRAPH_API_URL correct is ingesteld. ' +
            error,
          variant: 'destructive',
        });
      }
    };
    initThread();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !threadId || isLoading) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const userMessage = input.trim();
    setMessages((prev) => [
      ...prev,
      { role: 'user', content: userMessage, sources: undefined }, // Clear sources for new user message
      { role: 'assistant', content: '', sources: undefined }, // Clear sources for new assistant message
    ]);
    setInput('');
    setIsLoading(true);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    lastRetrievedDocsRef.current = []; // Clear the last retrieved documents

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage,
          threadId,
        }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No reader available');

      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunkStr = decoder.decode(value);
        const lines = chunkStr.split('\n').filter(Boolean);

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;

          const sseString = line.slice('data: '.length);
          let sseEvent: any;
          try {
            sseEvent = JSON.parse(sseString);
          } catch (err) {
            console.error('Error parsing SSE line:', err, line);
            continue;
          }

          const { event, data } = sseEvent;

          if (event === 'messages/partial') {
            if (Array.isArray(data)) {
              const lastObj = data[data.length - 1];
              if (lastObj?.type === 'ai') {
                const partialContent = lastObj.content ?? '';

                // Only display if content is a string message
                if (
                  typeof partialContent === 'string' &&
                  !partialContent.startsWith('{')
                ) {
                  setMessages((prev) => {
                    const newArr = [...prev];
                    if (
                      newArr.length > 0 &&
                      newArr[newArr.length - 1].role === 'assistant'
                    ) {
                      newArr[newArr.length - 1].content = partialContent;
                      newArr[newArr.length - 1].sources =
                        lastRetrievedDocsRef.current;
                    }

                    return newArr;
                  });
                }
              }
            }
          } else if (event === 'updates' && data) {
            if (
              data &&
              typeof data === 'object' &&
              'retrieveDocuments' in data &&
              data.retrieveDocuments &&
              Array.isArray(data.retrieveDocuments.documents)
            ) {
              const retrievedDocs = (data as RetrieveDocumentsNodeUpdates)
                .retrieveDocuments.documents as PDFDocument[];

              // // Handle documents here
              lastRetrievedDocsRef.current = retrievedDocs;
              console.log('Retrieved documents:', retrievedDocs);
            } else {
              // Clear the last retrieved documents if it's a direct answer
              lastRetrievedDocsRef.current = [];
            }
          } else {
            console.log('Unknown SSE event:', event, data);
          }
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: 'Fout',
        description:
          'Kon bericht niet verzenden. Probeer het opnieuw.\n' +
          (error instanceof Error ? error.message : 'Onbekende fout'),
        variant: 'destructive',
      });
      setMessages((prev) => {
        const newArr = [...prev];
        newArr[newArr.length - 1].content =
          'Sorry, er was een fout bij het verwerken van je bericht.';
        return newArr;
      });
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0) return;

    const nonPdfFiles = selectedFiles.filter(
      (file) => file.type !== 'application/pdf',
    );
    if (nonPdfFiles.length > 0) {
      toast({
        title: 'Ongeldig bestandstype',
        description: 'Upload alleen PDF-bestanden a.u.b.',
        variant: 'destructive',
      });
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      selectedFiles.forEach((file) => {
        formData.append('files', file);
      });

      const response = await fetch('/api/ingest', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to upload files');
      }

      setFiles((prev) => [...prev, ...selectedFiles]);
      toast({
        title: 'Succes',
        description: `${selectedFiles.length} bestand${selectedFiles.length > 1 ? 'en' : ''} succesvol geüpload`,
        variant: 'default',
      });
    } catch (error) {
      console.error('Error uploading files:', error);
      toast({
        title: 'Upload mislukt',
        description:
          'Kon bestanden niet uploaden. Probeer het opnieuw.\n' +
          (error instanceof Error ? error.message : 'Onbekende fout'),
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveFile = (fileToRemove: File) => {
    setFiles(files.filter((file) => file !== fileToRemove));
    toast({
      title: 'Bestand verwijderd',
      description: `${fileToRemove.name} is verwijderd`,
      variant: 'default',
    });
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <Header />
      <main className="flex-1 overflow-y-auto flex flex-col items-center p-4 md:p-6 max-w-5xl mx-auto w-full">
        {messages.length === 0 ? (
          <>
            <div className="flex-1 flex items-center justify-center w-full">
              <Card className="p-6 max-w-lg w-full border-border/80 shadow-sm">
                <div className="flex flex-col items-center text-center gap-4">
                  <Activity className="w-12 h-12 text-primary" />
                  <p className="font-medium text-foreground/90">
                    Welkom bij HyroCoach! Upload een PDF (zoals een Hyrox schema) en stel vragen voor persoonlijk trainingsadvies.
                  </p>
                </div>
              </Card>
            </div>
            <ExamplePrompts onPromptSelect={setInput} />
          </>
        ) : (
          <div className="w-full space-y-4">
            {messages.map((message, i) => (
              <ChatMessage key={i} message={message} />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </main>
      <footer className="sticky bottom-0 left-0 w-full bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-t">
        <div className="container mx-auto px-4 py-3">
          {/* Render file previews */}
          {files.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {files.map((file, index) => (
                <FilePreview
                  key={index}
                  file={file}
                  onRemove={() => handleRemoveFile(file)}
                />
              ))}
            </div>
          )}
          <form onSubmit={handleSubmit} className="flex items-center gap-2">
            {/* File Upload Button */}
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9 rounded-full border-foreground/50 text-foreground/80 hover:bg-secondary/10 hover:text-secondary-foreground focus-visible:ring-ring focus-visible:ring-offset-1 transition-colors duration-150 flex-shrink-0"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              title="PDF document uploaden"
            >
              {isUploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Paperclip className="h-4 w-4" />
              )}
            </Button>
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept=".pdf"
              multiple
              onChange={handleFileUpload}
              disabled={isUploading}
            />
            {/* Chat Input Field */}
            <Input
              type="text"
              placeholder="Vraag aan HyroCoach..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="flex-1 px-4 py-2 bg-background border border-input rounded-full focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-0"
              disabled={isLoading || isUploading}
            />
            {/* Send Button */}
            <Button
              type="submit"
              variant="default"
              size="icon"
              className="h-9 w-9 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/80 focus-visible:ring-ring focus-visible:ring-offset-1"
              disabled={!input.trim() || isLoading || isUploading}
              title="Bericht verzenden"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowUp className="h-4 w-4" />
              )}
            </Button>
          </form>
          {/* Optional: Add attribution or links here if needed */}
          {/* <p className="text-center text-xs text-muted-foreground mt-2">Powered by LangChain</p> */}
        </div>
      </footer>
    </div>
  );
}
