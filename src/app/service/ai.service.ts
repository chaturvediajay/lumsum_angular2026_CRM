import { Injectable, NgZone } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, catchError, map, of, throwError } from 'rxjs';
import { environment } from '@environments/environment';
import {
  AiConfig,
  ChatMessage,
  ChatRequest,
  ChatResponse,
  QuickPrompt,
  VoiceCommandRequest,
  VoiceCommandResponse,
} from '../interface/ai.model';

// Declare SpeechRecognition interfaces for browsers
declare var webkitSpeechRecognition: any;
declare var SpeechRecognition: any;

@Injectable({
  providedIn: 'root',
})
export class AiService {
  private apiUrl = `${environment.apiUrl}/v1/ai`;

  // Speech Recognition state
  private recognitionInstance: any = null;
  private isListeningSubject = new BehaviorSubject<boolean>(false);
  public isListening$ = this.isListeningSubject.asObservable();

  private transcriptSubject = new BehaviorSubject<string>('');
  public transcript$ = this.transcriptSubject.asObservable();

  private speechErrorSubject = new BehaviorSubject<string | null>(null);
  public speechError$ = this.speechErrorSubject.asObservable();

  // Speech Synthesis state
  private isSpeakingSubject = new BehaviorSubject<boolean>(false);
  public isSpeaking$ = this.isSpeakingSubject.asObservable();

  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private autoSpeak = false;

  constructor(
    private http: HttpClient,
    private ngZone: NgZone
  ) {
    this.initSpeechRecognition();
    this.loadAutoSpeakPreference();
  }

  // =========================================================================
  // HTTP BACKEND API INTEGRATION
  // =========================================================================

  /**
   * Send a chat message (text or voice-transcribed) to the AI backend.
   */
  sendMessage(
    message: string,
    history: ChatMessage[] = [],
    context = 'general',
    voiceInput = false,
    model?: string
  ): Observable<ChatResponse> {
    const payload: ChatRequest = {
      message,
      history: history.slice(-6).map((h) => ({
        role: h.role,
        content: h.content,
        timestamp: h.timestamp,
        voiceInput: h.voiceInput,
      })),
      context,
      voiceInput,
      model,
    };

    return this.http.post<ChatResponse>(`${this.apiUrl}/chat`, payload).pipe(
      catchError((err) => {
        console.error('AI chat request failed:', err);
        return throwError(() => err);
      })
    );
  }

  /**
   * Send a voice command to the AI backend for intent classification and navigation.
   */
  sendVoiceCommand(transcript: string, pageContext?: string): Observable<VoiceCommandResponse> {
    const payload: VoiceCommandRequest = {
      transcript,
      pageContext,
    };

    return this.http.post<VoiceCommandResponse>(`${this.apiUrl}/voice/command`, payload).pipe(
      catchError((err) => {
        console.error('AI voice command request failed:', err);
        return throwError(() => err);
      })
    );
  }

  /**
   * Fetch AI service configuration and capabilities.
   */
  getConfig(): Observable<AiConfig> {
    return this.http.get<AiConfig>(`${this.apiUrl}/config`).pipe(
      catchError((err) => {
        console.warn('Failed to load AI config, using local defaults:', err);
        return of({
          enabled: true,
          activeProvider: 'Lumsum Enterprise NLP Engine',
          currentModel: 'lumsum-assistant',
          voiceRecognitionSupported: this.isSpeechRecognitionSupported(),
          voiceSynthesisSupported: this.isSpeechSynthesisSupported(),
          quickPrompts: [],
          voiceCommands: [],
        });
      })
    );
  }

  /**
   * Fetch quick prompts for interactive chips.
   */
  getQuickPrompts(): Observable<QuickPrompt[]> {
    return this.http.get<QuickPrompt[]>(`${this.apiUrl}/quick-prompts`).pipe(
      catchError(() => of([]))
    );
  }

  // =========================================================================
  // SPEECH RECOGNITION (STT - Web Speech API)
  // =========================================================================

  public isSpeechRecognitionSupported(): boolean {
    if (typeof window === 'undefined') return false;
    return !!(
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    );
  }

  private initSpeechRecognition(): void {
    if (!this.isSpeechRecognitionSupported()) return;

    try {
      const SpeechRec =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      this.recognitionInstance = new SpeechRec();
      this.recognitionInstance.continuous = false;
      this.recognitionInstance.interimResults = true;
      this.recognitionInstance.lang = 'en-US';

      this.recognitionInstance.onstart = () => {
        this.ngZone.run(() => {
          this.isListeningSubject.next(true);
          this.speechErrorSubject.next(null);
        });
      };

      this.recognitionInstance.onresult = (event: any) => {
        this.ngZone.run(() => {
          let interim = '';
          let finalTranscript = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript;
            } else {
              interim += event.results[i][0].transcript;
            }
          }
          const text = finalTranscript || interim;
          if (text) {
            this.transcriptSubject.next(text);
          }
        });
      };

      this.recognitionInstance.onerror = (event: any) => {
        this.ngZone.run(() => {
          const errMsg = event?.error || 'Speech recognition error';
          this.speechErrorSubject.next(errMsg);
          this.isListeningSubject.next(false);
        });
      };

      this.recognitionInstance.onend = () => {
        this.ngZone.run(() => {
          this.isListeningSubject.next(false);
        });
      };
    } catch (e) {
      console.warn('Speech recognition init error:', e);
    }
  }

  /**
   * Start listening to the microphone for user speech.
   */
  startListening(): void {
    if (!this.isSpeechRecognitionSupported()) {
      this.speechErrorSubject.next('Speech recognition is not supported in this browser.');
      return;
    }
    if (!this.recognitionInstance) {
      this.initSpeechRecognition();
    }
    try {
      this.transcriptSubject.next('');
      this.recognitionInstance.start();
    } catch (e: any) {
      // If already started, restart
      console.debug('Speech recognition start note:', e);
    }
  }

  /**
   * Stop listening to microphone.
   */
  stopListening(): void {
    if (this.recognitionInstance && this.isListeningSubject.value) {
      try {
        this.recognitionInstance.stop();
      } catch (e) {
        console.debug('Speech recognition stop note:', e);
      }
      this.isListeningSubject.next(false);
    }
  }

  /**
   * Toggle speech recognition state.
   */
  toggleListening(): void {
    if (this.isListeningSubject.value) {
      this.stopListening();
    } else {
      this.startListening();
    }
  }

  // =========================================================================
  // SPEECH SYNTHESIS (TTS - Web Speech API)
  // =========================================================================

  public isSpeechSynthesisSupported(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  /**
   * Speak a text string aloud using the browser's speech synthesis engine.
   */
  speakText(text: string, onEnd?: () => void): void {
    if (!this.isSpeechSynthesisSupported() || !text || text.trim() === '') {
      if (onEnd) onEnd();
      return;
    }

    this.stopSpeaking();

    const cleanText = this.cleanForSpeech(text);
    if (!cleanText) {
      if (onEnd) onEnd();
      return;
    }

    try {
      this.currentUtterance = new SpeechSynthesisUtterance(cleanText);
      this.currentUtterance.rate = 1.0;
      this.currentUtterance.pitch = 1.0;
      this.currentUtterance.lang = 'en-US';

      // Pick natural sounding voice if available
      const voices = window.speechSynthesis.getVoices();
      const preferredVoice = voices.find(
        (v) => (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Samantha') || v.name.includes('Daniel')) && v.lang.startsWith('en')
      ) || voices.find((v) => v.lang.startsWith('en'));

      if (preferredVoice) {
        this.currentUtterance.voice = preferredVoice;
      }

      this.currentUtterance.onstart = () => {
        this.ngZone.run(() => {
          this.isSpeakingSubject.next(true);
        });
      };

      this.currentUtterance.onend = () => {
        this.ngZone.run(() => {
          this.isSpeakingSubject.next(false);
          this.currentUtterance = null;
          if (onEnd) onEnd();
        });
      };

      this.currentUtterance.onerror = (e) => {
        this.ngZone.run(() => {
          this.isSpeakingSubject.next(false);
          this.currentUtterance = null;
          if (onEnd) onEnd();
        });
      };

      window.speechSynthesis.speak(this.currentUtterance);
    } catch (e) {
      console.warn('Speech synthesis error:', e);
      this.isSpeakingSubject.next(false);
      if (onEnd) onEnd();
    }
  }

  /**
   * Stop speaking currently playing audio.
   */
  stopSpeaking(): void {
    if (this.isSpeechSynthesisSupported()) {
      try {
        window.speechSynthesis.cancel();
      } catch (e) {
        console.debug('Speech synthesis cancel note:', e);
      }
    }
    this.isSpeakingSubject.next(false);
    this.currentUtterance = null;
  }

  // =========================================================================
  // PREFERENCES & UTILITIES
  // =========================================================================

  public isAutoSpeakEnabled(): boolean {
    return this.autoSpeak;
  }

  public setAutoSpeak(enabled: boolean): void {
    this.autoSpeak = enabled;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('lumsum_ai_auto_speak', String(enabled));
    }
  }

  private loadAutoSpeakPreference(): void {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('lumsum_ai_auto_speak');
      if (saved !== null) {
        this.autoSpeak = saved === 'true';
      }
    }
  }

  /**
   * Strips markdown symbols, asterisks, bullet points, and code snippets
   * for a natural and pleasant audio reading experience.
   */
  public cleanForSpeech(markdown: string): string {
    if (!markdown) return '';
    let cleaned = markdown
      .replace(/```[\s\S]*?```/g, '') // Remove code blocks
      .replace(/`([^`]+)`/g, '$1') // Inline code
      .replace(/^#+\s+/gm, '') // Headers
      .replace(/\*\*([^*]+)\*\*/g, '$1') // Bold
      .replace(/\*([^*]+)\*/g, '$1') // Italics
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Links
      .replace(/^[-*+]\s+/gm, '') // Bullet points
      .replace(/^\d+\.\s+/gm, '') // Numbered lists
      .replace(/>\s+/gm, '') // Blockquotes
      .replace(/[\n\r]+/g, ' ') // Collapse newlines
      .trim();

    // Limit to reasonable audio length (~300 characters or first 2 sentences)
    if (cleaned.length > 320) {
      const periodIdx = cleaned.indexOf('.', 180);
      if (periodIdx > 0 && periodIdx < 360) {
        cleaned = cleaned.substring(0, periodIdx + 1);
      } else {
        cleaned = cleaned.substring(0, 300) + '...';
      }
    }
    return cleaned;
  }
}
