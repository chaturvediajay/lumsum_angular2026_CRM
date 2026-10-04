import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { DashboardLayout } from '../shared/dashboard-layout/dashboard-layout';
import { AiService } from '../service/ai.service';
import { ChatMessage, QuickPrompt } from '../interface/ai.model';

@Component({
  selector: 'app-ai-assistant',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, DashboardLayout],
  templateUrl: './ai-assistant.html',
  styleUrl: './ai-assistant.scss',
})
export class AiAssistant implements OnInit, OnDestroy {
  @ViewChild('chatScrollContainer') chatScrollContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('messageInput') messageInput!: ElementRef<HTMLInputElement | HTMLTextAreaElement>;

  messages: ChatMessage[] = [];
  inputText = '';
  isLoading = false;

  // Voice & Speech state
  isListening = false;
  isSpeaking = false;
  autoSpeak = false;
  interimTranscript = '';
  speechError: string | null = null;
  speechSupported = false;
  synthesisSupported = false;

  // Configuration & prompts
  activeProvider = 'Lumsum Enterprise NLP Engine';
  currentModel = 'lumsum-assistant';
  quickPrompts: QuickPrompt[] = [];

  copiedMessageId: string | null = null;

  private subscriptions: Subscription[] = [];

  constructor(
    private aiService: AiService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.speechSupported = this.aiService.isSpeechRecognitionSupported();
    this.synthesisSupported = this.aiService.isSpeechSynthesisSupported();
    this.autoSpeak = this.aiService.isAutoSpeakEnabled();

    // 1. Subscribe to speech recognition status
    this.subscriptions.push(
      this.aiService.isListening$.subscribe((listening) => {
        this.isListening = listening;
        if (!listening && this.interimTranscript.trim()) {
          // Auto-send when user finishes voice input
          const voiceText = this.interimTranscript.trim();
          this.interimTranscript = '';
          this.sendMessage(voiceText, true);
        }
      })
    );

    // 2. Subscribe to speech recognition live transcript
    this.subscriptions.push(
      this.aiService.transcript$.subscribe((text) => {
        if (text) {
          this.interimTranscript = text;
          this.inputText = text;
        }
      })
    );

    // 3. Subscribe to speech errors
    this.subscriptions.push(
      this.aiService.speechError$.subscribe((err) => {
        this.speechError = err;
        if (err) {
          setTimeout(() => (this.speechError = null), 6000);
        }
      })
    );

    // 4. Subscribe to TTS speaking status
    this.subscriptions.push(
      this.aiService.isSpeaking$.subscribe((speaking) => {
        this.isSpeaking = speaking;
        if (!speaking) {
          this.messages.forEach((m) => (m.speaking = false));
        }
      })
    );

    // 5. Fetch AI config and quick prompts
    this.loadAiConfig();
    this.loadQuickPrompts();

    // Initial greeting
    this.addWelcomeMessage();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
    this.aiService.stopListening();
    this.aiService.stopSpeaking();
  }

  private loadAiConfig(): void {
    this.aiService.getConfig().subscribe((cfg) => {
      if (cfg) {
        this.activeProvider = cfg.activeProvider || this.activeProvider;
        this.currentModel = cfg.currentModel || this.currentModel;
      }
    });
  }

  private loadQuickPrompts(): void {
    this.aiService.getQuickPrompts().subscribe((prompts) => {
      if (prompts && prompts.length > 0) {
        this.quickPrompts = prompts;
      } else {
        // Fallback default quick prompts
        this.quickPrompts = [
          { title: '🛡️ Session Security', prompt: 'How does multi-device session tracking and client IP capture work?', category: 'Security' },
          { title: '👥 User Management', prompt: 'How do I manage user accounts and access roles in Lumsum?', category: 'Administration' },
          { title: '🌐 Network Telemetry', prompt: 'How does client IP detection via ipify and WebRTC work?', category: 'Telemetry' },
          { title: '⚡ Dual-Token System', prompt: 'Explain access and refresh token lifecycle and idle timeout.', category: 'Architecture' },
          { title: '📊 System Status', prompt: 'What is the health and security status of this system?', category: 'System' },
        ];
      }
    });
  }

  private addWelcomeMessage(): void {
    if (this.messages.length === 0) {
      this.messages.push({
        id: 'msg-welcome',
        role: 'assistant',
        content:
          "👋 **Welcome to your Lumsum AI Voice & Chat Assistant!**\n\n" +
          "I am connected to your enterprise platform with **real-time voice recognition and speech synthesis**:\n\n" +
          "- 🎙️ **Voice Commands:** Tap the microphone and say *\"Show sessions\"*, *\"Show users\"*, or *\"System status\"*\n" +
          "- 🛡️ **Session Telemetry:** Ask about device fingerprints, IP detection, or session revocation.\n" +
          "- 👥 **Administration:** Learn about role-based access control and user directory.\n" +
          "- ⚡ **Security Architecture:** Understand dual-token lifecycle and 5-minute inactivity watchdog.\n\n" +
          "Tap any prompt chip below or speak into the microphone to begin!",
        timestamp: Date.now(),
        suggestedFollowUps: [
          'Show active sessions',
          'How does session tracking work?',
          'What is the system status?',
        ],
      });
    }
  }

  // =========================================================================
  // CHAT ACTIONS
  // =========================================================================

  sendMessage(textToSend?: string, isVoice = false): void {
    const text = (textToSend || this.inputText).trim();
    if (!text || this.isLoading) return;

    // 1. Push user message
    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: Date.now(),
      voiceInput: isVoice,
    };
    this.messages.push(userMsg);
    this.inputText = '';
    this.interimTranscript = '';
    this.isLoading = true;
    this.scrollToBottom();

    // 2. Call AI service
    this.aiService.sendMessage(text, this.messages, 'platform', isVoice).subscribe({
      next: (response) => {
        this.isLoading = false;
        const aiMsg: ChatMessage = {
          id: `ai-${Date.now()}`,
          role: 'assistant',
          content: response.reply,
          timestamp: response.timestamp || Date.now(),
          action: response.action,
          actionData: response.actionData,
          suggestedFollowUps: response.suggestedFollowUps,
        };
        this.messages.push(aiMsg);
        this.scrollToBottom();

        // If auto-speak enabled, read out the response
        if (this.autoSpeak && this.synthesisSupported) {
          this.speakMessage(aiMsg);
        }

        // If voice command returned navigation action, handle it if requested
        if (isVoice && response.action === 'NAVIGATE' && response.actionData && response.actionData['target']) {
          const target = response.actionData['target'];
          setTimeout(() => {
            this.handleNavigationAction(target);
          }, 2000);
        }
      },
      error: (err) => {
        this.isLoading = false;
        this.messages.push({
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: '⚠️ I encountered an issue processing your request. Please try again or check backend server connectivity.',
          timestamp: Date.now(),
        });
        this.scrollToBottom();
      },
    });
  }

  onEnterPress(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  selectQuickPrompt(promptText: string): void {
    this.inputText = promptText;
    this.sendMessage(promptText, false);
  }

  // =========================================================================
  // VOICE RECOGNITION (STT) & SYNTHESIS (TTS)
  // =========================================================================

  toggleMicrophone(): void {
    if (!this.speechSupported) {
      this.speechError = 'Microphone speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari.';
      return;
    }
    this.aiService.toggleListening();
  }

  toggleAutoSpeak(): void {
    this.autoSpeak = !this.autoSpeak;
    this.aiService.setAutoSpeak(this.autoSpeak);
  }

  speakMessage(msg: ChatMessage): void {
    if (!this.synthesisSupported) return;

    if (msg.speaking) {
      this.aiService.stopSpeaking();
      msg.speaking = false;
      return;
    }

    this.messages.forEach((m) => (m.speaking = false));
    msg.speaking = true;

    this.aiService.speakText(msg.content, () => {
      msg.speaking = false;
    });
  }

  stopSpeaking(): void {
    this.aiService.stopSpeaking();
    this.messages.forEach((m) => (m.speaking = false));
  }

  // =========================================================================
  // UTILITIES & NAVIGATION
  // =========================================================================

  handleNavigationAction(targetRoute: string): void {
    if (targetRoute) {
      this.router.navigate([targetRoute]);
    }
  }

  copyMessage(msg: ChatMessage): void {
    if (!msg?.content) return;
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(msg.content).then(() => {
        this.copiedMessageId = msg.id;
        setTimeout(() => {
          if (this.copiedMessageId === msg.id) {
            this.copiedMessageId = null;
          }
        }, 2000);
      });
    }
  }

  clearChat(): void {
    this.aiService.stopSpeaking();
    this.messages = [];
    this.addWelcomeMessage();
  }

  exportChat(): void {
    const exportData = {
      exportDate: new Date().toISOString(),
      provider: this.activeProvider,
      model: this.currentModel,
      conversation: this.messages.map((m) => ({
        role: m.role,
        content: m.content,
        timestamp: new Date(m.timestamp).toLocaleString(),
        voiceInput: !!m.voiceInput,
      })),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lumsum-ai-chat-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  private scrollToBottom(): void {
    setTimeout(() => {
      if (this.chatScrollContainer?.nativeElement) {
        const el = this.chatScrollContainer.nativeElement;
        el.scrollTop = el.scrollHeight;
      }
    }, 100);
  }
}
