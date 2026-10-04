import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AiService } from './ai.service';
import { environment } from '@environments/environment';

if (typeof (globalThis as any).localStorage === 'undefined') {
  let store: Record<string, string> = {};
  (globalThis as any).localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = String(v); },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { store = {}; },
    get length() { return Object.keys(store).length; },
    key: (i: number) => Object.keys(store)[i] ?? null,
  };
}

describe('AiService', () => {
  let service: AiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [AiService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('sendMessage should POST to /v1/ai/chat and return response', () => {
    const mockResponse = {
      reply: 'Pipeline is $450,000',
      model: 'lumsum-assistant',
      status: 'SUCCESS',
      timestamp: Date.now(),
    };

    service.sendMessage('What is our pipeline?').subscribe((res) => {
      expect(res.reply).toBe('Pipeline is $450,000');
      expect(res.status).toBe('SUCCESS');
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/v1/ai/chat`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body.message).toBe('What is our pipeline?');
    req.flush(mockResponse);
  });

  it('sendVoiceCommand should POST to /v1/ai/voice/command', () => {
    const mockResponse = {
      originalTranscript: 'show leads',
      interpretedIntent: 'NAVIGATE',
      spokenResponse: 'Opening leads',
      displayResponse: 'Navigating to leads',
      navigationTarget: '/leads',
      timestamp: Date.now(),
    };

    service.sendVoiceCommand('show leads', 'home').subscribe((res) => {
      expect(res.navigationTarget).toBe('/leads');
      expect(res.interpretedIntent).toBe('NAVIGATE');
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/v1/ai/voice/command`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body.transcript).toBe('show leads');
    req.flush(mockResponse);
  });

  it('getConfig should GET /v1/ai/config and return capabilities', () => {
    const mockConfig = {
      enabled: true,
      activeProvider: 'Lumsum Enterprise NLP Engine',
      currentModel: 'lumsum-assistant',
      voiceRecognitionSupported: true,
      voiceSynthesisSupported: true,
      quickPrompts: [],
      voiceCommands: [],
    };

    service.getConfig().subscribe((cfg) => {
      expect(cfg.enabled).toBe(true);
      expect(cfg.activeProvider).toBe('Lumsum Enterprise NLP Engine');
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/v1/ai/config`);
    expect(req.request.method).toBe('GET');
    req.flush(mockConfig);
  });

  it('getQuickPrompts should GET /v1/ai/quick-prompts', () => {
    const mockPrompts = [
      { title: 'Pipeline', prompt: 'Show pipeline', category: 'Analytics' },
    ];

    service.getQuickPrompts().subscribe((prompts) => {
      expect(prompts.length).toBe(1);
      expect(prompts[0].title).toBe('Pipeline');
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/v1/ai/quick-prompts`);
    expect(req.request.method).toBe('GET');
    req.flush(mockPrompts);
  });

  it('cleanForSpeech should remove markdown formatting, code blocks, and bullet points', () => {
    const markdown = '### 📈 Pipeline Summary\n- **Total:** `$500k`\n- Review [here](https://lumsumpro.com)';
    const cleaned = service.cleanForSpeech(markdown);

    expect(cleaned).not.toContain('###');
    expect(cleaned).not.toContain('**');
    expect(cleaned).not.toContain('`');
    expect(cleaned).toContain('Pipeline Summary');
    expect(cleaned).toContain('Total:');
    expect(cleaned).toContain('here');
  });

  it('cleanForSpeech should return empty string for null or empty input', () => {
    expect(service.cleanForSpeech('')).toBe('');
    expect(service.cleanForSpeech(null as any)).toBe('');
  });

  it('autoSpeak preference should persist to localStorage', () => {
    service.setAutoSpeak(true);
    expect(service.isAutoSpeakEnabled()).toBe(true);
    expect(localStorage.getItem('lumsum_ai_auto_speak')).toBe('true');

    service.setAutoSpeak(false);
    expect(service.isAutoSpeakEnabled()).toBe(false);
    expect(localStorage.getItem('lumsum_ai_auto_speak')).toBe('false');
  });

  it('stopSpeaking and stopListening should not throw when called safely', () => {
    expect(() => service.stopSpeaking()).not.toThrow();
    expect(() => service.stopListening()).not.toThrow();
  });
});
