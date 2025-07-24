import { Actor, ActorSubclass, HttpAgent, Identity } from '@dfinity/agent';

// LLM Canister Interface
interface LLMCanister {
    v0_chat: (request: ChatRequest) => Promise<string>;
}

interface ChatRequest {
    model: string;
    messages: ChatMessage[];
}

interface ChatMessage {
    role: { user: null } | { system_: null } | { assistant: null };
    content: string;
}

class TranslationService {
    private agent: HttpAgent | null = null;
    private llmActor: ActorSubclass<LLMCanister> | null = null;
    private readonly LLM_CANISTER_ID = 'w36hm-eqaaa-aaaal-qr76a-cai';

    // IDL Factory untuk LLM Canister
    private llmIdlFactory = ({ IDL }: any) => {
        const ChatMessage = IDL.Record({
            'role': IDL.Variant({
                'user': IDL.Null,
                'system_': IDL.Null,
                'assistant': IDL.Null,
            }),
            'content': IDL.Text,
        });

        const Request = IDL.Record({
            'model': IDL.Text,
            'messages': IDL.Vec(ChatMessage),
        });

        return IDL.Service({
            'v0_chat': IDL.Func([Request], [IDL.Text], []),
        });
    };

    constructor() {
        this.init();
    }

    private async init(identity?: Identity): Promise<void> {
        try {
            const host = this.getHost();

            this.agent = new HttpAgent({
                host,
                identity,
            });

            // Fetch root key for local development
            if (this.isLocal()) {
                await this.agent.fetchRootKey();
            }

            // Create LLM Actor
            this.llmActor = Actor.createActor<LLMCanister>(this.llmIdlFactory, {
                agent: this.agent,
                canisterId: this.LLM_CANISTER_ID,
            });

            console.log('✅ Translation service initialized');
        } catch (error) {
            console.error('❌ Failed to initialize translation service:', error);
            throw new Error('Translation service initialization failed');
        }
    }

    private getHost(): string {
        const dfxNetwork = process.env.DFX_NETWORK;

        if (dfxNetwork === 'local') {
            return 'http://localhost:4943';
        } else if (dfxNetwork === 'ic' || dfxNetwork === 'playground') {
            return 'https://ic0.app';
        }

        // Fallback
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            return 'http://localhost:4943';
        }

        return 'https://ic0.app';
    }

    private isLocal(): boolean {
        const dfxNetwork = process.env.DFX_NETWORK;
        return dfxNetwork === 'local' || window.location.hostname === 'localhost';
    }

    // Language mapping
    private getLanguageName(code: string): string {
        const langMap: Record<string, string> = {
            'id-ID': 'Indonesian',
            'en-US': 'English',
            'en-GB': 'English',
            'ja-JP': 'Japanese',
            'ko-KR': 'Korean',
            'zh-CN': 'Chinese',
            'zh-TW': 'Chinese Traditional',
            'es-ES': 'Spanish',
            'fr-FR': 'French',
            'de-DE': 'German',
            'pt-BR': 'Portuguese',
            'ru-RU': 'Russian',
            'ar-SA': 'Arabic',
            'hi-IN': 'Hindi',
            'th-TH': 'Thai',
            'vi-VN': 'Vietnamese',
            'tr-TR': 'Turkish',
        };

        return langMap[code] || 'English';
    }

    // Supported languages
    getSupportedLanguages(): string[] {
        return [
            'en-US', 'en-GB', 'id-ID', 'ja-JP', 'ko-KR', 'zh-CN', 'zh-TW',
            'es-ES', 'fr-FR', 'de-DE', 'pt-BR', 'ru-RU', 'ar-SA', 'hi-IN',
            'th-TH', 'vi-VN', 'tr-TR'
        ];
    }

    // Main translation function
    async translate(text: string, targetLanguage: string): Promise<{ success: true; translation: string } | { success: false; error: string }> {
        try {
            if (!this.llmActor) {
                throw new Error('Translation service not initialized');
            }

            if (!text.trim()) {
                throw new Error('Text cannot be empty');
            }

            if (text.length > 2000) {
                throw new Error('Text too long (max 2000 characters)');
            }

            if (!this.getSupportedLanguages().includes(targetLanguage)) {
                throw new Error(`Unsupported language: ${targetLanguage}`);
            }

            const targetLanguageName = this.getLanguageName(targetLanguage);
            
            // Optimized prompt for speed
            // const prompt = `To ${targetLanguageName}: ${text}`;
            const prompt = `Translate the following text accurately to ${targetLanguageName} Only return the translated text without any explanations or additional formatting: ${text}`;

            const request: ChatRequest = {
                model: "llama3.1:8b",
                messages: [{
                    role: { user: null },
                    content: prompt
                }]
            };

            console.log('🔄 Translating...', { text, targetLanguage, prompt });

            const result = await this.llmActor.v0_chat(request);

            console.log('✅ Translation completed:', result);

            return {
                success: true,
                translation: result.trim()
            };

        } catch (error) {
            console.error('❌ Translation failed:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Translation failed'
            };
        }
    }

    // Batch translation
    async batchTranslate(texts: string[], targetLanguage: string): Promise<{ success: true; translations: string[] } | { success: false; error: string }> {
        try {
            if (!this.llmActor) {
                throw new Error('Translation service not initialized');
            }

            if (texts.length === 0) {
                throw new Error('No texts provided');
            }

            if (texts.length > 10) {
                throw new Error('Too many texts (max 10)');
            }

            const targetLanguageName = this.getLanguageName(targetLanguage);
            
            // Combine texts with numbering
            const combinedText = texts.map((text, index) => `${index + 1}. ${text}`).join('\n');
            const prompt = `Translate to ${targetLanguageName}:\n${combinedText}`;

            const request: ChatRequest = {
                model: "llama3.1:8b",
                messages: [{
                    role: { user: null },
                    content: prompt
                }]
            };

            const result = await this.llmActor.v0_chat(request);
            
            // Parse numbered results
            const lines = result.split('\n').filter(line => line.trim());
            const translations = lines.map(line => {
                // Remove numbering
                return line.replace(/^\d+\.\s*/, '').trim();
            }).filter(translation => translation.length > 0);

            return {
                success: true,
                translations
            };

        } catch (error) {
            console.error('❌ Batch translation failed:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Batch translation failed'
            };
        }
    }

    // Language detection
    async detectLanguage(text: string): Promise<{ success: true; language: string } | { success: false; error: string }> {
        try {
            if (!this.llmActor) {
                throw new Error('Translation service not initialized');
            }

            if (text.length > 500) {
                throw new Error('Text too long for detection (max 500 characters)');
            }

            const prompt = `What language is this? Answer with just the language name: ${text}`;

            const request: ChatRequest = {
                model: "llama3.1:8b",
                messages: [{
                    role: { user: null },
                    content: prompt
                }]
            };

            const result = await this.llmActor.v0_chat(request);

            return {
                success: true,
                language: result.trim()
            };

        } catch (error) {
            console.error('❌ Language detection failed:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Language detection failed'
            };
        }
    }
}

// Export singleton instance
export const translationService = new TranslationService();