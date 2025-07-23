import Text "mo:base/Text";
import Array "mo:base/Array";
import Nat "mo:base/Nat";

actor TranslationService {
    
    // ========== TYPE DEFINITIONS ==========
    public type Model = {
        #Llama3_1_8B;
    };

    public type Role = {
        #user;
        #system_;
        #assistant;
    };

    public type ChatMessage = {
        role : Role;
        content : Text;
    };

    type Request = {
        model : Text;
        messages : [ChatMessage];
    };

    // ========== LLM CANISTER INTEGRATION ==========
    // Direct integration with LLM canister for translation services
    let llmCanister = actor ("w36hm-eqaaa-aaaal-qr76a-cai") : actor {
        v0_chat : (Request) -> async Text;
    };

    // ========== LANGUAGE MAPPING ==========
    // Maps language codes to human-readable language names
    // TODO: This mapping will be expanded periodically to support more languages
    private func getLanguageName(code : Text) : Text {
        switch (code) {
            case ("id-ID") { "Indonesian" };
            case ("en-US" or "en-GB") { "English" };
            case ("ja-JP") { "Japanese" };
            case ("ko-KR") { "Korean" };
            case ("zh-CN") { "Chinese" };
            case ("zh-TW" or "zh-HK") { "Chinese Traditional" };
            case ("es-ES") { "Spanish" };
            case ("fr-FR") { "French" };
            case ("de-DE") { "German" };
            case ("pt-BR") { "Portuguese" };
            case ("ru-RU") { "Russian" };
            case ("ar-SA") { "Arabic" };
            case ("hi-IN") { "Hindi" };
            case ("th-TH") { "Thai" };
            case ("vi-VN") { "Vietnamese" };
            case ("tr-TR") { "Turkish" };
            case (_) { "English" }; // Default fallback to English
        };
    };

    // ========== SUPPORTED LANGUAGES ==========
    // List of currently supported language codes
    // NOTE: This list will be expanded gradually to include more language variants
    private let supportedLanguages : [Text] = [
        "en-US", "en-GB", "id-ID", "ja-JP", "ko-KR", "zh-CN", "zh-TW",
        "es-ES", "fr-FR", "de-DE", "pt-BR", "ru-RU", "ar-SA", "hi-IN",
        "th-TH", "vi-VN", "tr-TR"
    ];

    // ========== VALIDATION FUNCTIONS ==========
    // Checks if the provided language code is supported
    private func isLanguageSupported(langCode : Text) : Bool {
        for (lang in supportedLanguages.vals()) {
            if (lang == langCode) {
                return true;
            };
        };
        false
    };

    // ========== CORE TRANSLATION FUNCTIONS ==========
    
    // Main translation function with comprehensive validation
    // Matches frontend translation service logic
    public func translate(text : Text, targetLanguage : Text) : async {#Ok : Text; #Err : Text} {
        // Validate target language support
        if (not isLanguageSupported(targetLanguage)) {
            return #Err("Unsupported language code: " # targetLanguage);
        };

        // Validate input text constraints
        if (Text.size(text) == 0) {
            return #Err("Text cannot be empty");
        };

        if (Text.size(text) > 2000) {
            return #Err("Text too long (max 2000 characters)");
        };

        let targetLanguageName = getLanguageName(targetLanguage);
        
        // Optimized prompt format for accurate translation
        let prompt = "Translate the following text accurately to " # targetLanguageName # " Only return the translated text without any explanations or additional formatting: " # text;

        try {
            let request : Request = {
                model = "llama3.1:8b";
                messages = [{
                    role = #user;
                    content = prompt;
                }];
            };

            let translatedText = await llmCanister.v0_chat(request);
            #Ok(translatedText)
        } catch (_) {
            #Err("Translation failed. Please try again.")
        }
    };

    // Batch translation for multiple texts in a single request
    public func batchTranslate(texts : [Text], targetLanguage : Text) : async {#Ok : [Text]; #Err : Text} {
        // Validate batch size constraints
        if (texts.size() == 0) {
            return #Err("No texts provided");
        };

        if (texts.size() > 10) {
            return #Err("Too many texts (max 10)");
        };

        // Validate target language
        if (not isLanguageSupported(targetLanguage)) {
            return #Err("Unsupported language code: " # targetLanguage);
        };

        let targetLanguageName = getLanguageName(targetLanguage);
        
        // Combine texts with numbering for batch processing
        var combinedText = "";
        var index = 1;
        for (text in texts.vals()) {
            combinedText := combinedText # Nat.toText(index) # ". " # text # "\n";
            index += 1;
        };

        let prompt = "Translate to " # targetLanguageName # ":\n" # combinedText;

        try {
            let request : Request = {
                model = "llama3.1:8b";
                messages = [{
                    role = #user;
                    content = prompt;
                }];
            };

            let result = await llmCanister.v0_chat(request);
            
            // Parse numbered results from batch translation
            let lines = Text.split(result, #char '\n');
            var translations : [Text] = [];
            
            for (line in lines) {
                let trimmed = Text.trim(line, #char ' ');
                if (Text.size(trimmed) > 2) {
                    // Remove numbering patterns from results
                    var cleanedLine = trimmed;
                    
                    // Handle numbered list format (1., 2., 3., etc.)
                    let patterns = ["1. ", "2. ", "3. ", "4. ", "5. ", "6. ", "7. ", "8. ", "9. ", "10. "];
                    for (pattern in patterns.vals()) {
                        if (Text.startsWith(trimmed, #text pattern)) {
                            cleanedLine := Text.trimStart(trimmed, #text pattern);
                        };
                    };
                    
                    if (Text.size(cleanedLine) > 0) {
                        translations := Array.append(translations, [cleanedLine]);
                    };
                };
            };
            
            #Ok(translations)
        } catch (_) {
            #Err("Batch translation failed")
        }
    };

    // Language detection service
    public func detectLanguage(text : Text) : async {#Ok : Text; #Err : Text} {
        // Validate input for language detection
        if (Text.size(text) == 0) {
            return #Err("Input text cannot be empty");
        };

        if (Text.size(text) > 500) {
            return #Err("Text too long for detection (max 500 characters)");
        };

        // Simple prompt for language identification
        let prompt = "What language is this? Answer with just the language name: " # text;

        try {
            let request : Request = {
                model = "llama3.1:8b";
                messages = [{
                    role = #user;
                    content = prompt;
                }];
            };

            let detectedLang = await llmCanister.v0_chat(request);
            #Ok(Text.trim(detectedLang, #char ' '))
        } catch (_) {
            #Err("Language detection failed")
        }
    };

    // ========== UTILITY FUNCTIONS ==========
    
    // Returns list of all supported language codes
    public query func getSupportedLanguages() : async [Text] {
        supportedLanguages
    };

    // Checks if a specific language code is supported
    public query func checkLanguageSupport(langCode : Text) : async Bool {
        isLanguageSupported(langCode)
    };

    // Returns service information and statistics
    public query func getServiceInfo() : async {
        version : Text;
        totalSupportedLanguages : Nat;
        maxTextLength : Nat;
        maxBatchSize : Nat;
    } {
        {
            version = "1.0.0";
            totalSupportedLanguages = supportedLanguages.size();
            maxTextLength = 2000;
            maxBatchSize = 10;
        }
    };
};