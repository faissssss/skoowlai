# LLM Provider Configuration Module

This module provides configuration management for LLM providers in the application.

## Overview

The `ProviderConfig` class manages:
- Environment variable loading and validation
- Provider credentials (Groq Cloud, Gemini API)
- Model mappings for all 7 application endpoints
- Configuration error handling with descriptive messages

## Requirements Validated

- **Requirement 1.5**: LLM Provider Abstraction Layer - Model mapping configuration
- **Requirement 5.1**: Llama 3.3 70B for note generation endpoints
- **Requirement 5.2**: Llama 3.3 70B for chat endpoints
- **Requirement 5.3**: Llama 3.1 8B for flashcard generation endpoints
- **Requirement 5.4**: Llama 3.1 8B for quiz generation endpoints
- **Requirement 5.5**: Llama 3.3 70B for mindmap generation endpoints
- **Requirement 5.6**: Llama 3.1 8B for rewrite endpoints
- **Requirement 5.7**: Model mapping configurable via environment variables
- **Requirement 10.7**: Configuration error handling at startup

## Usage

### Loading Configuration

```typescript
import { ProviderConfig } from '@/lib/llm/config';

// Load configuration from environment variables
const config = ProviderConfig.load();
```

### Getting Provider Credentials

```typescript
const credentials = config.getCredentials();

// Access Groq credentials
console.log(credentials.groq.apiKey);
console.log(credentials.groq.baseURL);

// Access Gemini credentials
console.log(credentials.gemini.apiKey);
```

### Getting Model for a Feature

```typescript
// Get model configuration for a specific endpoint
const generateModel = config.getModelForFeature('generate');
console.log(generateModel.provider); // 'groq'
console.log(generateModel.model);    // 'llama-3.3-70b-versatile'

// Get priority for a feature
const priority = config.getPriorityForFeature('generate');
console.log(priority); // 'high'
```

### Checking Feature Enablement

```typescript
// Check if a feature is enabled for a specific provider
const isEnabled = config.isFeatureEnabled('generate', 'groq');
console.log(isEnabled); // true
```

### Getting Provider Settings

```typescript
// Get primary and fallback providers
console.log(config.getPrimaryProvider());   // 'groq'
console.log(config.getFallbackProvider());  // 'gemini'
console.log(config.isFallbackEnabled());    // true
```

## Environment Variables

### Required Variables

The following environment variables must be set:

- `GROQ_API_KEY`: API key for Groq Cloud
- `GOOGLE_GENERATIVE_AI_API_KEY`: API key for Google Gemini
- `PRIMARY_LLM_PROVIDER`: Primary provider name (`groq` or `gemini`)
- `FALLBACK_LLM_PROVIDER`: Fallback provider name (`groq` or `gemini`)
- `ENABLE_LLM_FALLBACK`: Enable fallback (`true` or `false`)

### Optional Variables

- `LLM_MODEL_MAPPING`: JSON string with custom model mappings (uses defaults if not provided)

### Example .env Configuration

```env
GROQ_API_KEY=gsk_...
GOOGLE_GENERATIVE_AI_API_KEY=AIza...
PRIMARY_LLM_PROVIDER=groq
FALLBACK_LLM_PROVIDER=gemini
ENABLE_LLM_FALLBACK=true
LLM_MODEL_MAPPING={"generate":{"provider":"groq","model":"llama-3.3-70b-versatile","priority":"high"},...}
```

## Default Model Mappings

The module provides default model mappings for all 7 endpoints:

| Endpoint | Provider | Model | Priority |
|----------|----------|-------|----------|
| generate | groq | llama-3.3-70b-versatile | high |
| chat | groq | llama-3.3-70b-versatile | high |
| flashcards | groq | llama-3.1-8b-instant | medium |
| quiz | groq | llama-3.1-8b-instant | medium |
| mindmap | groq | llama-3.3-70b-versatile | medium |
| rewrite | groq | llama-3.1-8b-instant | low |
| generate-audio-notes | groq | llama-3.3-70b-versatile | high |

## Error Handling

The module throws `ConfigurationError` when:
- Required environment variables are missing
- Environment variables have invalid values
- Model mapping JSON is malformed
- Model mapping structure is invalid

### Error Properties

```typescript
class ConfigurationError extends Error {
  missingKeys?: string[];  // List of missing environment variables
  invalidKeys?: string[];  // List of invalid environment variables
}
```

### Example Error Message

```
Missing required environment variables: GROQ_API_KEY, PRIMARY_LLM_PROVIDER

Remediation steps:
1. Ensure all required environment variables are set in your .env file
2. Verify that provider names are either "groq" or "gemini"
3. Verify that ENABLE_LLM_FALLBACK is either "true" or "false"
4. Restart the application after updating environment variables
```

## Testing

### Validation Scripts

Two validation scripts are provided:

1. **Basic Validation**: `scripts/validate-llm-config.ts`
   - Tests configuration loading
   - Verifies all 7 endpoint mappings
   - Validates credentials and model configuration

2. **Error Handling Validation**: `scripts/validate-llm-config-errors.ts`
   - Tests missing environment variables
   - Tests invalid environment variables
   - Validates error messages and remediation steps

### Running Tests

```bash
# Run basic validation
npx dotenv-cli -e .env -- npx tsx scripts/validate-llm-config.ts

# Run error handling validation
npx dotenv-cli -e .env -- npx tsx scripts/validate-llm-config-errors.ts
```

## API Reference

### ProviderConfig Class

#### Static Methods

- `static load(): ProviderConfig` - Load configuration from environment variables

#### Instance Methods

- `getCredentials(): ProviderCredentials` - Get provider API keys and configuration
- `getModelConfig(): ProviderModelConfig` - Get model names for each provider
- `getModelForFeature(feature: string): { provider: string; model: string }` - Get model for a feature
- `getPriorityForFeature(feature: string): Priority` - Get priority for a feature
- `isFeatureEnabled(feature: string, provider: string): boolean` - Check if feature is enabled for provider
- `getPrimaryProvider(): Provider` - Get primary provider name
- `getFallbackProvider(): Provider` - Get fallback provider name
- `isFallbackEnabled(): boolean` - Check if fallback is enabled
- `getModelMapping(): ModelMapping` - Get complete model mapping
- `getConfiguredFeatures(): string[]` - Get list of configured features

### Types

```typescript
type Provider = 'groq' | 'gemini';
type Priority = 'high' | 'medium' | 'low';
type Feature = 'generate' | 'chat' | 'flashcards' | 'quiz' | 'mindmap' | 'rewrite' | 'generate-audio-notes';

interface FeatureModelConfig {
  provider: Provider;
  model: string;
  priority: Priority;
}

interface ModelMapping {
  [feature: string]: FeatureModelConfig;
}

interface ProviderCredentials {
  groq: {
    apiKey: string;
    baseURL: string;
  };
  gemini: {
    apiKey: string;
  };
}

interface ProviderModelConfig {
  groq: {
    large: string;
    small: string;
  };
  gemini: {
    default: string;
  };
}
```

## Design Document Reference

For complete architecture details, see:
- `.kiro/specs/llm-provider-migration/design.md` - Section 2: Provider Config
- `.kiro/specs/llm-provider-migration/requirements.md` - Requirements 1.5, 5.1-5.7, 10.1-10.7
