import { useState, useCallback } from 'react';
import { translationService } from '../services/translationService';

interface UseTranslationReturn {
    translate: (text: string, targetLanguage: string) => Promise<string>;
    batchTranslate: (texts: string[], targetLanguage: string) => Promise<string[]>;
    detectLanguage: (text: string) => Promise<string>;
    isLoading: boolean;
    error: string | null;
    supportedLanguages: string[];
}

export const useTranslation = (): UseTranslationReturn => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const translate = useCallback(async (text: string, targetLanguage: string): Promise<string> => {
        setIsLoading(true);
        setError(null);

        try {
            const result = await translationService.translate(text, targetLanguage);
            
            if (result.success) {
                return result.translation;
            } else {
                throw new Error(result.error);
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Translation failed';
            setError(errorMessage);
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, []);

    const batchTranslate = useCallback(async (texts: string[], targetLanguage: string): Promise<string[]> => {
        setIsLoading(true);
        setError(null);

        try {
            const result = await translationService.batchTranslate(texts, targetLanguage);
            
            if (result.success) {
                return result.translations;
            } else {
                throw new Error(result.error);
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Batch translation failed';
            setError(errorMessage);
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, []);

    const detectLanguage = useCallback(async (text: string): Promise<string> => {
        setIsLoading(true);
        setError(null);

        try {
            const result = await translationService.detectLanguage(text);
            
            if (result.success) {
                return result.language;
            } else {
                throw new Error(result.error);
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Language detection failed';
            setError(errorMessage);
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, []);

    return {
        translate,
        batchTranslate,
        detectLanguage,
        isLoading,
        error,
        supportedLanguages: translationService.getSupportedLanguages(),
    };
};