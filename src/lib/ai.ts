/**
 * FORGE AI Service — Anthropic Claude API client
 * Handles streaming responses for promoted block commands.
 */

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-20250514';

export type AiCommand = 'probe' | 'east' | 'connect';

export interface AiStreamCallbacks {
  onToken: (text: string) => void;
  onComplete: (fullText: string) => void;
  onError: (error: string) => void;
}

/**
 * Get the stored API key from localStorage.
 * This is safe for a local desktop app — no browser exposure.
 */
export function getApiKey(): string | null {
  return localStorage.getItem('forge_anthropic_key');
}

export function setApiKey(key: string): void {
  localStorage.setItem('forge_anthropic_key', key);
}

export function hasApiKey(): boolean {
  const key = getApiKey();
  return !!key && key.startsWith('sk-ant-');
}

/**
 * Run an AI command against a promoted block's content.
 * Streams the response token by token.
 */
export async function runAiCommand(
  command: AiCommand,
  blockContent: string,
  blockType: string,
  systemPrompt: string,
  callbacks: AiStreamCallbacks,
  abortSignal?: AbortSignal
): Promise<void> {
  const apiKey = getApiKey();
  if (!apiKey) {
    callbacks.onError('No API key configured. Open Settings (gear icon) to add your Anthropic key.');
    return;
  }

  const userMessage = buildUserMessage(command, blockContent, blockType);

  try {
    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2048,
        stream: true,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      }),
      signal: abortSignal,
    });

    if (!response.ok) {
      const errBody = await response.text();
      let errMsg = `API error ${response.status}`;
      try {
        const parsed = JSON.parse(errBody);
        errMsg = parsed?.error?.message || errMsg;
      } catch {}
      callbacks.onError(errMsg);
      return;
    }

    // Stream the response
    const reader = response.body?.getReader();
    if (!reader) {
      callbacks.onError('No response stream available');
      return;
    }

    const decoder = new TextDecoder();
    let fullText = '';
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      
      // Parse SSE events
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();
          if (data === '[DONE]') continue;

          try {
            const event = JSON.parse(data);
            
            if (event.type === 'content_block_delta' && event.delta?.text) {
              const token = event.delta.text;
              fullText += token;
              callbacks.onToken(token);
            }
          } catch {
            // Skip malformed events
          }
        }
      }
    }

    callbacks.onComplete(fullText);
  } catch (err: any) {
    if (err.name === 'AbortError') {
      callbacks.onComplete(fullText || '(aborted)');
    } else {
      callbacks.onError(err.message || 'Unknown error');
    }
  }
}

function buildUserMessage(command: AiCommand, content: string, blockType: string): string {
  const prefix = `[Block type: ${blockType.toUpperCase()}]\n\n`;
  
  switch (command) {
    case 'probe':
      return `${prefix}Analyze this block for structural integrity:\n\n${content}`;
    case 'east':
      return `${prefix}Steelman the strongest objection to this block:\n\n${content}`;
    case 'connect':
      return `${prefix}Find unexpected structural connections from this block to other domains:\n\n${content}`;
  }
}
