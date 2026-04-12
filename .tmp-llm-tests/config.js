"use strict";
/**
 * Provider Configuration Module
 *
 * Manages LLM provider configuration including:
 * - Environment variable loading and validation
 * - Provider credentials management
 * - Model mappings for all endpoints
 * - Configuration error handling
 *
 * Validates: Requirements 1.5, 5.1-5.7, 10.7
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProviderConfig = exports.ConfigurationError = void 0;
const zod_1 = require("zod");
/**
 * Configuration error with descriptive messages
 */
class ConfigurationError extends Error {
    constructor(message, missingKeys, invalidKeys) {
        super(message);
        this.missingKeys = missingKeys;
        this.invalidKeys = invalidKeys;
        this.name = 'ConfigurationError';
    }
}
exports.ConfigurationError = ConfigurationError;
/**
 * Default model mapping for all 7 endpoints
 * Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7
 */
const DEFAULT_MODEL_MAPPING = {
    // High priority: Note generation - uses Llama 3.3 70B for quality
    generate: {
        provider: 'groq',
        model: 'llama-3.3-70b-versatile',
        priority: 'high',
    },
    // High priority: Chat - uses Llama 3.3 70B for conversational quality
    chat: {
        provider: 'groq',
        model: 'llama-3.3-70b-versatile',
        priority: 'high',
    },
    // Medium priority: Flashcards - uses Llama 3.1 8B for cost efficiency
    flashcards: {
        provider: 'groq',
        model: 'llama-3.1-8b-instant',
        priority: 'medium',
    },
    // Medium priority: Quiz - uses Llama 3.1 8B for cost efficiency
    quiz: {
        provider: 'groq',
        model: 'llama-3.1-8b-instant',
        priority: 'medium',
    },
    // Medium priority: Mindmap - uses Llama 3.3 70B for complex reasoning
    mindmap: {
        provider: 'groq',
        model: 'llama-3.3-70b-versatile',
        priority: 'medium',
    },
    // Low priority: Rewrite - uses Llama 3.1 8B for simple transformations
    rewrite: {
        provider: 'groq',
        model: 'llama-3.1-8b-instant',
        priority: 'low',
    },
    // High priority: Audio notes - uses Llama 3.3 70B for quality
    'generate-audio-notes': {
        provider: 'groq',
        model: 'llama-3.3-70b-versatile',
        priority: 'high',
    },
};
/**
 * Zod schema for validating model mapping structure
 */
const FeatureModelConfigSchema = zod_1.z.object({
    provider: zod_1.z.enum(['groq', 'gemini']),
    model: zod_1.z.string().min(1),
    priority: zod_1.z.enum(['high', 'medium', 'low']),
    forceProvider: zod_1.z.boolean().optional(),
});
const ModelMappingSchema = zod_1.z.record(zod_1.z.string(), FeatureModelConfigSchema);
/**
 * Provider Configuration Class
 *
 * Manages provider-specific configuration and credentials.
 * Validates: Requirements 1.5, 10.1-10.7
 */
class ProviderConfig {
    /**
     * Private constructor - use ProviderConfig.load() to create instances
     */
    constructor(credentials, modelMapping, primaryProvider, fallbackProvider, fallbackEnabled, contentSizeRoutingEnabled, contentSizeThreshold, migrationEnabled, endpointOverrides) {
        this.credentials = credentials;
        this.modelMapping = modelMapping;
        this.primaryProvider = primaryProvider;
        this.fallbackProvider = fallbackProvider;
        this.fallbackEnabled = fallbackEnabled;
        this.contentSizeRoutingEnabled = contentSizeRoutingEnabled;
        this.contentSizeThreshold = contentSizeThreshold;
        this.migrationEnabled = migrationEnabled;
        this.endpointOverrides = endpointOverrides;
    }
    /**
     * Load configuration from environment variables
     * Validates: Requirements 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7
     *
     * @throws {ConfigurationError} When required environment variables are missing or invalid
     * @returns {ProviderConfig} Validated configuration instance
     */
    static load() {
        const missingKeys = [];
        const invalidKeys = [];
        // Load and validate Groq API key (Requirement 10.3)
        const groqApiKey = process.env.GROQ_API_KEY;
        if (!groqApiKey || groqApiKey.trim() === '') {
            missingKeys.push('GROQ_API_KEY');
        }
        // Load and validate Gemini API key (Requirement 10.4)
        const geminiApiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
        if (!geminiApiKey || geminiApiKey.trim() === '') {
            missingKeys.push('GOOGLE_GENERATIVE_AI_API_KEY');
        }
        // Load and validate primary provider (Requirement 10.1)
        const primaryProvider = process.env.PRIMARY_LLM_PROVIDER;
        if (!primaryProvider) {
            missingKeys.push('PRIMARY_LLM_PROVIDER');
        }
        else if (primaryProvider !== 'groq' && primaryProvider !== 'gemini') {
            invalidKeys.push('PRIMARY_LLM_PROVIDER (must be "groq" or "gemini")');
        }
        // Load and validate fallback provider (Requirement 10.2)
        const fallbackProvider = process.env.FALLBACK_LLM_PROVIDER;
        if (!fallbackProvider) {
            missingKeys.push('FALLBACK_LLM_PROVIDER');
        }
        else if (fallbackProvider !== 'groq' && fallbackProvider !== 'gemini') {
            invalidKeys.push('FALLBACK_LLM_PROVIDER (must be "groq" or "gemini")');
        }
        // Load and validate fallback enable flag (Requirement 10.5)
        const fallbackEnabledStr = process.env.ENABLE_LLM_FALLBACK;
        if (!fallbackEnabledStr) {
            missingKeys.push('ENABLE_LLM_FALLBACK');
        }
        const fallbackEnabled = fallbackEnabledStr === 'true';
        // Load content size routing configuration (Requirement 23.8)
        const contentSizeRoutingEnabledStr = process.env.ENABLE_CONTENT_SIZE_ROUTING;
        const contentSizeRoutingEnabled = contentSizeRoutingEnabledStr !== 'false'; // Default: true
        const contentSizeThresholdStr = process.env.CONTENT_SIZE_THRESHOLD_TOKENS;
        const contentSizeThreshold = contentSizeThresholdStr
            ? parseInt(contentSizeThresholdStr, 10)
            : 6000; // Default: 6000 tokens
        if (contentSizeThresholdStr && isNaN(contentSizeThreshold)) {
            invalidKeys.push('CONTENT_SIZE_THRESHOLD_TOKENS (must be a valid number)');
        }
        // Load rollback configuration (Requirements 12.1, 12.3, 12.6, 12.7)
        const migrationEnabledStr = process.env.LLM_MIGRATION_ENABLED;
        const migrationEnabled = migrationEnabledStr !== 'false'; // Default: true
        // Load per-endpoint overrides (Requirement 12.1)
        let endpointOverrides = {};
        const endpointOverridesStr = process.env.LLM_ENDPOINT_OVERRIDES;
        if (endpointOverridesStr) {
            try {
                const parsed = JSON.parse(endpointOverridesStr);
                // Validate that all values are valid providers
                for (const [feature, provider] of Object.entries(parsed)) {
                    if (provider !== 'groq' && provider !== 'gemini') {
                        invalidKeys.push(`LLM_ENDPOINT_OVERRIDES.${feature} (must be "groq" or "gemini")`);
                    }
                }
                endpointOverrides = parsed;
            }
            catch (error) {
                throw new ConfigurationError(`Invalid LLM_ENDPOINT_OVERRIDES format: ${error instanceof Error ? error.message : 'Unknown error'}\n\n` +
                    'Remediation steps:\n' +
                    '1. Ensure LLM_ENDPOINT_OVERRIDES is valid JSON\n' +
                    '2. Verify each feature maps to either "groq" or "gemini"\n' +
                    '3. Example format: {"chat":"gemini","generate":"gemini"}', undefined, ['LLM_ENDPOINT_OVERRIDES']);
            }
        }
        // Throw configuration error if any required variables are missing (Requirement 10.7)
        if (missingKeys.length > 0 || invalidKeys.length > 0) {
            const errorParts = [];
            if (missingKeys.length > 0) {
                errorParts.push(`Missing required environment variables: ${missingKeys.join(', ')}`);
            }
            if (invalidKeys.length > 0) {
                errorParts.push(`Invalid environment variables: ${invalidKeys.join(', ')}`);
            }
            errorParts.push('\nRemediation steps:');
            errorParts.push('1. Ensure all required environment variables are set in your .env file');
            errorParts.push('2. Verify that provider names are either "groq" or "gemini"');
            errorParts.push('3. Verify that ENABLE_LLM_FALLBACK is either "true" or "false"');
            errorParts.push('4. Restart the application after updating environment variables');
            throw new ConfigurationError(errorParts.join('\n'), missingKeys.length > 0 ? missingKeys : undefined, invalidKeys.length > 0 ? invalidKeys : undefined);
        }
        // Build credentials object
        const credentials = {
            groq: {
                apiKey: groqApiKey,
                baseURL: 'https://api.groq.com/openai/v1',
            },
            gemini: {
                apiKey: geminiApiKey,
            },
        };
        // Load and validate model mapping (Requirement 10.6)
        let modelMapping;
        const modelMappingStr = process.env.LLM_MODEL_MAPPING;
        if (modelMappingStr) {
            try {
                const parsed = JSON.parse(modelMappingStr);
                const validated = ModelMappingSchema.parse(parsed);
                modelMapping = {
                    ...DEFAULT_MODEL_MAPPING,
                    ...validated,
                };
            }
            catch (error) {
                throw new ConfigurationError(`Invalid LLM_MODEL_MAPPING format: ${error instanceof Error ? error.message : 'Unknown error'}\n\n` +
                    'Remediation steps:\n' +
                    '1. Ensure LLM_MODEL_MAPPING is valid JSON\n' +
                    '2. Verify each feature has provider, model, and priority fields\n' +
                    '3. Verify provider is either "groq" or "gemini"\n' +
                    '4. Verify priority is "high", "medium", or "low"\n' +
                    '5. Example format: {"generate":{"provider":"groq","model":"llama-3.3-70b-versatile","priority":"high"}}', undefined, ['LLM_MODEL_MAPPING']);
            }
        }
        else {
            // Use default mapping if not provided
            modelMapping = DEFAULT_MODEL_MAPPING;
        }
        return new ProviderConfig(credentials, modelMapping, primaryProvider, fallbackProvider, fallbackEnabled, contentSizeRoutingEnabled, contentSizeThreshold, migrationEnabled, endpointOverrides);
    }
    /**
     * Get provider credentials
     * @returns {ProviderCredentials} Provider API keys and configuration
     */
    getCredentials() {
        return this.credentials;
    }
    /**
     * Get model configuration for all providers
     * @returns {ProviderModelConfig} Model names for each provider
     */
    getModelConfig() {
        return {
            groq: {
                large: 'llama-3.3-70b-versatile',
                small: 'llama-3.1-8b-instant',
            },
            gemini: {
                default: 'gemini-2.5-flash',
            },
        };
    }
    /**
     * Get model configuration for a specific feature
     * Validates: Requirements 1.5, 5.1-5.7
     *
     * @param {string} feature - Feature name (e.g., 'generate', 'chat')
     * @returns {{ provider: string; model: string }} Provider and model for the feature
     */
    getModelForFeature(feature) {
        const config = this.modelMapping[feature];
        if (!config) {
            // Return primary provider with default model if feature not found
            const modelConfig = this.getModelConfig();
            return {
                provider: this.primaryProvider,
                model: this.primaryProvider === 'groq'
                    ? modelConfig.groq.large
                    : modelConfig.gemini.default,
            };
        }
        return {
            provider: config.provider,
            model: config.model,
        };
    }
    /**
     * Get priority for a specific feature
     *
     * @param {string} feature - Feature name
     * @returns {Priority} Priority level for the feature
     */
    getPriorityForFeature(feature) {
        const config = this.modelMapping[feature];
        return config?.priority ?? 'medium';
    }
    /**
     * Check if a feature is enabled for a specific provider
     *
     * @param {string} feature - Feature name
     * @param {string} provider - Provider name
     * @returns {boolean} True if feature is configured for the provider
     */
    isFeatureEnabled(feature, provider) {
        const config = this.modelMapping[feature];
        return config?.provider === provider;
    }
    /**
     * Get primary provider
     * @returns {Provider} Primary provider name
     */
    getPrimaryProvider() {
        return this.primaryProvider;
    }
    /**
     * Get fallback provider
     * @returns {Provider} Fallback provider name
     */
    getFallbackProvider() {
        return this.fallbackProvider;
    }
    /**
     * Check if fallback is enabled
     * @returns {boolean} True if fallback is enabled
     */
    isFallbackEnabled() {
        return this.fallbackEnabled;
    }
    /**
     * Get complete model mapping
     * @returns {ModelMapping} All feature-to-model mappings
     */
    getModelMapping() {
        return { ...this.modelMapping };
    }
    /**
     * Get all configured features
     * @returns {string[]} List of feature names
     */
    getConfiguredFeatures() {
        return Object.keys(this.modelMapping);
    }
    /**
     * Check if content size routing is enabled
     * @returns {boolean} True if content size routing is enabled
     */
    isContentSizeRoutingEnabled() {
        return this.contentSizeRoutingEnabled;
    }
    /**
     * Get content size threshold in tokens
     * @returns {number} Token threshold for content size routing
     */
    getContentSizeThreshold() {
        return this.contentSizeThreshold;
    }
    /**
     * Check if LLM migration is enabled
     * When false, all endpoints should bypass the router and use Gemini directly
     * @returns {boolean} True if migration is enabled
     */
    isMigrationEnabled() {
        return this.migrationEnabled;
    }
    /**
     * Get provider override for a specific endpoint/feature
     * Returns the override provider if configured, otherwise undefined
     * @param {string} feature - Feature name (e.g., 'chat', 'generate')
     * @returns {Provider | undefined} Override provider or undefined
     */
    getEndpointOverride(feature) {
        return this.endpointOverrides[feature];
    }
}
exports.ProviderConfig = ProviderConfig;
