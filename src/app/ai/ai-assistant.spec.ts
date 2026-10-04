import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { AiAssistant } from './ai-assistant';
import { AiService } from '../service/ai.service';
import { UserService } from '../service/user-service';

describe('AiAssistant', () => {
  let component: AiAssistant;
  let fixture: ComponentFixture<AiAssistant>;
  let aiServiceMock: any;
  let router: Router;

  beforeEach(async () => {
    aiServiceMock = {
      isSpeechRecognitionSupported: vi.fn().mockReturnValue(true),
      isSpeechSynthesisSupported: vi.fn().mockReturnValue(true),
      isAutoSpeakEnabled: vi.fn().mockReturnValue(false),
      setAutoSpeak: vi.fn(),
      isListening$: of(false),
      transcript$: of(''),
      speechError$: of(null),
      isSpeaking$: of(false),
      getConfig: vi.fn().mockReturnValue(
        of({
          enabled: true,
          activeProvider: 'Lumsum Enterprise NLP Engine',
          currentModel: 'lumsum-assistant',
          quickPrompts: [],
          voiceCommands: [],
        })
      ),
      getQuickPrompts: vi.fn().mockReturnValue(of([])),
      sendMessage: vi.fn().mockReturnValue(
        of({
          reply: 'Session security is active.',
          model: 'lumsum-assistant',
          status: 'SUCCESS',
          action: 'NAVIGATE',
          actionData: { target: '/sessions' },
          timestamp: Date.now(),
        })
      ),
      startListening: vi.fn(),
      stopListening: vi.fn(),
      toggleListening: vi.fn(),
      speakText: vi.fn(),
      stopSpeaking: vi.fn(),
    };

    const userServiceMock = {
      getCurrentUserProfile: vi.fn().mockReturnValue({ username: 'Admin', email: 'admin@lumsum.com', roles: ['ROLE_ADMIN'] }),
      clearSession: vi.fn(),
      getDeviceId: vi.fn().mockReturnValue('dev_id_1'),
      getDeviceName: vi.fn().mockReturnValue('Chrome on Mac'),
      getClientNetwork: vi.fn().mockReturnValue('wifi'),
      getClientTimezone: vi.fn().mockReturnValue('UTC'),
      getClientLocale: vi.fn().mockReturnValue('en-US'),
      getClientResolution: vi.fn().mockReturnValue('1920x1080'),
      getClientCores: vi.fn().mockReturnValue('8'),
      getClientPublicIp: vi.fn().mockReturnValue('1.1.1.1'),
      getClientPrivateIp: vi.fn().mockReturnValue('192.168.1.10'),
    };

    await TestBed.configureTestingModule({
      imports: [AiAssistant],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AiService, useValue: aiServiceMock },
        { provide: UserService, useValue: userServiceMock },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate');

    fixture = TestBed.createComponent(AiAssistant);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize with welcome message', () => {
    expect(component.messages.length).toBeGreaterThan(0);
    expect(component.messages[0].role).toBe('assistant');
    expect(component.messages[0].content).toContain('Welcome');
  });

  it('sendMessage should send user message and append AI response', () => {
    component.inputText = 'What is our pipeline value?';
    component.sendMessage();

    expect(component.messages.length).toBe(3); // welcome + user + assistant
    expect(component.messages[1].role).toBe('user');
    expect(component.messages[1].content).toBe('What is our pipeline value?');
    expect(component.messages[2].role).toBe('assistant');
    expect(component.messages[2].content).toContain('Session security');
    expect(aiServiceMock.sendMessage).toHaveBeenCalled();
  });

  it('toggleMicrophone should call aiService.toggleListening', () => {
    component.toggleMicrophone();
    expect(aiServiceMock.toggleListening).toHaveBeenCalled();
  });

  it('toggleAutoSpeak should toggle setting and update aiService', () => {
    expect(component.autoSpeak).toBe(false);
    component.toggleAutoSpeak();
    expect(component.autoSpeak).toBe(true);
    expect(aiServiceMock.setAutoSpeak).toHaveBeenCalledWith(true);
  });

  it('selectQuickPrompt should populate and send prompt', () => {
    component.selectQuickPrompt('Show active sessions');
    expect(aiServiceMock.sendMessage).toHaveBeenCalled();
  });

  it('handleNavigationAction should route to target path', () => {
    component.handleNavigationAction('/sessions');
    expect(router.navigate).toHaveBeenCalledWith(['/sessions']);
  });

  it('clearChat should reset conversation to welcome message', () => {
    component.inputText = 'Test message';
    component.sendMessage();
    expect(component.messages.length).toBe(3);

    component.clearChat();
    expect(component.messages.length).toBe(1);
    expect(component.messages[0].id).toBe('msg-welcome');
  });
});
