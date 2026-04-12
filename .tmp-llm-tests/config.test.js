"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const config_1 = require("./config");
const originalEnv = { ...process.env };
const tests = [];
function applyValidEnv() {
    process.env.GROQ_API_KEY = 'test-groq-key';
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = 'test-gemini-key';
    process.env.PRIMARY_LLM_PROVIDER = 'groq';
    process.env.FALLBACK_LLM_PROVIDER = 'gemini';
    process.env.ENABLE_LLM_FALLBACK = 'true';
    delete process.env.LLM_MODEL_MAPPING;
}
function assertConfigurationError(callback, pattern) {
    try {
        callback();
    }
    catch (error) {
        strict_1.default.ok(error instanceof config_1.ConfigurationError);
        if (pattern) {
            strict_1.default.match(error.message, pattern);
        }
        return error;
    }
    throw new Error('Expected ConfigurationError to be thrown');
}
function resetEnv() {
    process.env = { ...originalEnv };
}
function test(name, run) {
    tests.push({ name, run });
}
test('loads a valid configuration from environment variables', () => {
    applyValidEnv();
    const config = config_1.ProviderConfig.load();
    strict_1.default.equal(config.getPrimaryProvider(), 'groq');
    strict_1.default.equal(config.getFallbackProvider(), 'gemini');
    strict_1.default.equal(config.isFallbackEnabled(), true);
});
test('uses the default model mapping when LLM_MODEL_MAPPING is not provided', () => {
    applyValidEnv();
    const config = config_1.ProviderConfig.load();
    strict_1.default.deepEqual(config.getModelForFeature('generate'), {
        provider: 'groq',
        model: 'llama-3.3-70b-versatile',
    });
});
test('parses a custom model mapping from the environment', () => {
    applyValidEnv();
    process.env.LLM_MODEL_MAPPING = JSON.stringify({
        generate: {
            provider: 'gemini',
            model: 'gemini-2.5-flash',
            priority: 'high',
        },
    });
    const config = config_1.ProviderConfig.load();
    strict_1.default.deepEqual(config.getModelForFeature('generate'), {
        provider: 'gemini',
        model: 'gemini-2.5-flash',
    });
});
test('merges partial custom model mapping with defaults for untouched features', () => {
    applyValidEnv();
    process.env.LLM_MODEL_MAPPING = JSON.stringify({
        generate: {
            provider: 'gemini',
            model: 'gemini-2.5-flash',
            priority: 'high',
        },
    });
    const config = config_1.ProviderConfig.load();
    strict_1.default.deepEqual(config.getModelForFeature('generate'), {
        provider: 'gemini',
        model: 'gemini-2.5-flash',
    });
    strict_1.default.deepEqual(config.getModelForFeature('rewrite'), {
        provider: 'groq',
        model: 'llama-3.1-8b-instant',
    });
});
test('parses forceProvider from custom model mapping', () => {
    applyValidEnv();
    process.env.LLM_MODEL_MAPPING = JSON.stringify({
        rewrite: {
            provider: 'gemini',
            model: 'gemini-2.5-flash',
            priority: 'low',
            forceProvider: true,
        },
    });
    const config = config_1.ProviderConfig.load();
    const mapping = config.getModelMapping();
    strict_1.default.equal(mapping.rewrite.forceProvider, true);
});
test('supports disabling fallback', () => {
    applyValidEnv();
    process.env.ENABLE_LLM_FALLBACK = 'false';
    const config = config_1.ProviderConfig.load();
    strict_1.default.equal(config.isFallbackEnabled(), false);
});
test('throws a descriptive error when required env vars are missing', () => {
    applyValidEnv();
    delete process.env.GROQ_API_KEY;
    delete process.env.PRIMARY_LLM_PROVIDER;
    const error = assertConfigurationError(config_1.ProviderConfig.load, /Remediation steps/);
    strict_1.default.deepEqual(error.missingKeys, ['GROQ_API_KEY', 'PRIMARY_LLM_PROVIDER']);
});
test('throws a descriptive error when provider names are invalid', () => {
    applyValidEnv();
    process.env.PRIMARY_LLM_PROVIDER = 'invalid-provider';
    process.env.FALLBACK_LLM_PROVIDER = 'also-invalid';
    const error = assertConfigurationError(config_1.ProviderConfig.load, /Invalid environment variables/);
    strict_1.default.ok(error.invalidKeys?.some((key) => key.includes('PRIMARY_LLM_PROVIDER')));
    strict_1.default.ok(error.invalidKeys?.some((key) => key.includes('FALLBACK_LLM_PROVIDER')));
});
test('throws a configuration error for malformed model mapping JSON', () => {
    applyValidEnv();
    process.env.LLM_MODEL_MAPPING = 'invalid-json';
    assertConfigurationError(config_1.ProviderConfig.load, /LLM_MODEL_MAPPING/);
});
test('throws a configuration error for invalid model mapping structure', () => {
    applyValidEnv();
    process.env.LLM_MODEL_MAPPING = JSON.stringify({
        generate: { provider: 'invalid', model: 'test', priority: 'high' },
    });
    assertConfigurationError(config_1.ProviderConfig.load, /LLM_MODEL_MAPPING/);
});
test('returns provider credentials and provider model defaults', () => {
    applyValidEnv();
    const config = config_1.ProviderConfig.load();
    const credentials = config.getCredentials();
    const modelConfig = config.getModelConfig();
    strict_1.default.equal(credentials.groq.apiKey, 'test-groq-key');
    strict_1.default.equal(credentials.groq.baseURL, 'https://api.groq.com/openai/v1');
    strict_1.default.equal(credentials.gemini.apiKey, 'test-gemini-key');
    strict_1.default.equal(modelConfig.groq.large, 'llama-3.3-70b-versatile');
    strict_1.default.equal(modelConfig.groq.small, 'llama-3.1-8b-instant');
    strict_1.default.equal(modelConfig.gemini.default, 'gemini-2.5-flash');
});
test('returns the expected default model mapping for all 7 features', () => {
    applyValidEnv();
    const config = config_1.ProviderConfig.load();
    strict_1.default.deepEqual(config.getModelForFeature('generate'), {
        provider: 'groq',
        model: 'llama-3.3-70b-versatile',
    });
    strict_1.default.deepEqual(config.getModelForFeature('chat'), {
        provider: 'groq',
        model: 'llama-3.3-70b-versatile',
    });
    strict_1.default.deepEqual(config.getModelForFeature('flashcards'), {
        provider: 'groq',
        model: 'llama-3.1-8b-instant',
    });
    strict_1.default.deepEqual(config.getModelForFeature('quiz'), {
        provider: 'groq',
        model: 'llama-3.1-8b-instant',
    });
    strict_1.default.deepEqual(config.getModelForFeature('mindmap'), {
        provider: 'groq',
        model: 'llama-3.3-70b-versatile',
    });
    strict_1.default.deepEqual(config.getModelForFeature('rewrite'), {
        provider: 'groq',
        model: 'llama-3.1-8b-instant',
    });
    strict_1.default.deepEqual(config.getModelForFeature('generate-audio-notes'), {
        provider: 'groq',
        model: 'llama-3.3-70b-versatile',
    });
});
test('returns the expected priorities and feature enablement flags', () => {
    applyValidEnv();
    const config = config_1.ProviderConfig.load();
    strict_1.default.equal(config.getPriorityForFeature('generate'), 'high');
    strict_1.default.equal(config.getPriorityForFeature('flashcards'), 'medium');
    strict_1.default.equal(config.getPriorityForFeature('rewrite'), 'low');
    strict_1.default.equal(config.getPriorityForFeature('unknown-feature'), 'medium');
    strict_1.default.equal(config.isFeatureEnabled('generate', 'groq'), true);
    strict_1.default.equal(config.isFeatureEnabled('generate', 'gemini'), false);
    strict_1.default.equal(config.isFeatureEnabled('unknown-feature', 'groq'), false);
});
test('returns a sensible default model for unknown features', () => {
    applyValidEnv();
    const config = config_1.ProviderConfig.load();
    strict_1.default.deepEqual(config.getModelForFeature('unknown-feature'), {
        provider: 'groq',
        model: 'llama-3.3-70b-versatile',
    });
});
test('exposes the configured feature list and model mapping', () => {
    applyValidEnv();
    const config = config_1.ProviderConfig.load();
    const features = config.getConfiguredFeatures();
    const mapping = config.getModelMapping();
    strict_1.default.equal(features.length, 7);
    strict_1.default.deepEqual(features.sort(), [
        'chat',
        'flashcards',
        'generate',
        'generate-audio-notes',
        'mindmap',
        'quiz',
        'rewrite',
    ]);
    strict_1.default.ok('generate' in mapping);
    strict_1.default.ok('chat' in mapping);
    strict_1.default.ok('flashcards' in mapping);
    strict_1.default.ok('quiz' in mapping);
    strict_1.default.ok('mindmap' in mapping);
    strict_1.default.ok('rewrite' in mapping);
    strict_1.default.ok('generate-audio-notes' in mapping);
});
// ── Rollback Mechanism Tests ────────────────────────────────────────────────
test('migration is enabled by default when LLM_MIGRATION_ENABLED is not set', () => {
    applyValidEnv();
    delete process.env.LLM_MIGRATION_ENABLED;
    const config = config_1.ProviderConfig.load();
    strict_1.default.equal(config.isMigrationEnabled(), true);
});
test('migration is enabled when LLM_MIGRATION_ENABLED is true', () => {
    applyValidEnv();
    process.env.LLM_MIGRATION_ENABLED = 'true';
    const config = config_1.ProviderConfig.load();
    strict_1.default.equal(config.isMigrationEnabled(), true);
});
test('migration is disabled when LLM_MIGRATION_ENABLED is false', () => {
    applyValidEnv();
    process.env.LLM_MIGRATION_ENABLED = 'false';
    const config = config_1.ProviderConfig.load();
    strict_1.default.equal(config.isMigrationEnabled(), false);
});
test('returns undefined when no endpoint override is configured', () => {
    applyValidEnv();
    delete process.env.LLM_ENDPOINT_OVERRIDES;
    const config = config_1.ProviderConfig.load();
    strict_1.default.equal(config.getEndpointOverride('chat'), undefined);
    strict_1.default.equal(config.getEndpointOverride('generate'), undefined);
});
test('parses endpoint overrides from LLM_ENDPOINT_OVERRIDES', () => {
    applyValidEnv();
    process.env.LLM_ENDPOINT_OVERRIDES = JSON.stringify({
        chat: 'gemini',
        generate: 'gemini',
    });
    const config = config_1.ProviderConfig.load();
    strict_1.default.equal(config.getEndpointOverride('chat'), 'gemini');
    strict_1.default.equal(config.getEndpointOverride('generate'), 'gemini');
    strict_1.default.equal(config.getEndpointOverride('flashcards'), undefined);
});
test('throws configuration error for malformed LLM_ENDPOINT_OVERRIDES JSON', () => {
    applyValidEnv();
    process.env.LLM_ENDPOINT_OVERRIDES = 'invalid-json';
    assertConfigurationError(config_1.ProviderConfig.load, /LLM_ENDPOINT_OVERRIDES/);
});
test('throws configuration error for invalid provider in LLM_ENDPOINT_OVERRIDES', () => {
    applyValidEnv();
    process.env.LLM_ENDPOINT_OVERRIDES = JSON.stringify({
        chat: 'invalid-provider',
    });
    const error = assertConfigurationError(config_1.ProviderConfig.load, /Invalid environment variables/);
    strict_1.default.ok(error.invalidKeys?.some((key) => key.includes('LLM_ENDPOINT_OVERRIDES.chat')));
});
test('allows mixed valid providers in LLM_ENDPOINT_OVERRIDES', () => {
    applyValidEnv();
    process.env.LLM_ENDPOINT_OVERRIDES = JSON.stringify({
        chat: 'gemini',
        generate: 'groq',
        flashcards: 'gemini',
    });
    const config = config_1.ProviderConfig.load();
    strict_1.default.equal(config.getEndpointOverride('chat'), 'gemini');
    strict_1.default.equal(config.getEndpointOverride('generate'), 'groq');
    strict_1.default.equal(config.getEndpointOverride('flashcards'), 'gemini');
});
let passed = 0;
for (const { name, run } of tests) {
    try {
        process.env = { ...originalEnv };
        run();
        passed += 1;
        console.log(`PASS ${name}`);
    }
    catch (error) {
        console.error(`FAIL ${name}`);
        console.error(error);
        resetEnv();
        process.exitCode = 1;
        break;
    }
    resetEnv();
}
if (!process.exitCode) {
    console.log(`All ${passed} ProviderConfig tests passed.`);
}
