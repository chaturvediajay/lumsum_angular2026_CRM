export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  voiceInput?: boolean;
  action?: string;
  actionData?: Record<string, any>;
  suggestedFollowUps?: string[];
  speaking?: boolean;
}

export interface ChatRequest {
  message: string;
  history?: Array<{
    role: string;
    content: string;
    timestamp?: number;
    voiceInput?: boolean;
  }>;
  context?: string;
  voiceInput?: boolean;
  model?: string;
}

export interface ChatResponse {
  reply: string;
  model: string;
  status: string;
  action?: string;
  actionData?: Record<string, any>;
  suggestedFollowUps?: string[];
  timestamp: number;
  tokensUsed?: number;
}

export interface VoiceCommandRequest {
  transcript: string;
  audioData?: string;
  pageContext?: string;
}

export interface VoiceCommandResponse {
  originalTranscript: string;
  interpretedIntent: string;
  spokenResponse: string;
  displayResponse: string;
  navigationTarget?: string;
  suggestedAction?: string;
  payload?: Record<string, any>;
  timestamp: number;
}

export interface QuickPrompt {
  title: string;
  prompt: string;
  category: string;
}

export interface AiConfig {
  enabled: boolean;
  activeProvider: string;
  currentModel: string;
  voiceRecognitionSupported: boolean;
  voiceSynthesisSupported: boolean;
  quickPrompts: QuickPrompt[];
  voiceCommands: QuickPrompt[];
}
