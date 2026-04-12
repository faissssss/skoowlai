"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const fast_check_1 = __importDefault(require("fast-check"));
const router_1 = require("./router");
const tests = [];
function test(name, run) {
    tests.push({ name, run });
}
test('Property 33: API keys are redacted from logs', async () => {
    await fast_check_1.default.assert(fast_check_1.default.asyncProperty(fast_check_1.default.base64String({ minLength: 32, maxLength: 64 }), fast_check_1.default.string({ minLength: 10, maxLength: 50 }), async (apiKey, context) => {
        const logMessage = `${context} API_KEY=${apiKey} ${context}`;
        const sanitized = (0, router_1.sanitizeLogData)(logMessage);
        // API key should be redacted
        strict_1.default.equal(sanitized.includes(apiKey), false, `API key ${apiKey} was not redacted`);
        strict_1.default.equal(sanitized.includes('[REDACTED_API_KEY]'), true);
    }), { numRuns: 50 });
});
test('redacts OpenAI-style API keys', () => {
    const log = 'Using API key sk-1234567890abcdefghij for request';
    const sanitized = (0, router_1.sanitizeLogData)(log);
    strict_1.default.equal(sanitized.includes('sk-1234567890abcdefghij'), false);
    strict_1.default.equal(sanitized.includes('[REDACTED_API_KEY]'), true);
});
test('redacts Google API keys', () => {
    const log = 'Google API key: AIzaSyD1234567890abcdefghijklmnopqrs';
    const sanitized = (0, router_1.sanitizeLogData)(log);
    strict_1.default.equal(sanitized.includes('AIzaSyD1234567890abcdefghijklmnopqrs'), false);
    strict_1.default.equal(sanitized.includes('[REDACTED_API_KEY]'), true);
});
test('redacts email addresses', () => {
    const log = 'User email: user@example.com sent request';
    const sanitized = (0, router_1.sanitizeLogData)(log);
    strict_1.default.equal(sanitized.includes('user@example.com'), false);
    strict_1.default.equal(sanitized.includes('[REDACTED_EMAIL]'), true);
});
test('redacts phone numbers', () => {
    const log = 'Contact: 555-123-4567 or +1-555-123-4567';
    const sanitized = (0, router_1.sanitizeLogData)(log);
    strict_1.default.equal(sanitized.includes('555-123-4567'), false);
    strict_1.default.equal(sanitized.includes('[REDACTED_PHONE]'), true);
});
test('redacts credit card numbers', () => {
    const log = 'Payment with card 4532-1234-5678-9010';
    const sanitized = (0, router_1.sanitizeLogData)(log);
    strict_1.default.equal(sanitized.includes('4532-1234-5678-9010'), false);
    strict_1.default.equal(sanitized.includes('[REDACTED_CC]'), true);
});
test('redacts SSN', () => {
    const log = 'SSN: 123-45-6789 for verification';
    const sanitized = (0, router_1.sanitizeLogData)(log);
    strict_1.default.equal(sanitized.includes('123-45-6789'), false);
    strict_1.default.equal(sanitized.includes('[REDACTED_SSN]'), true);
});
test('redacts bearer tokens', () => {
    const log = 'Authorization: Bearer abc123def456ghi789';
    const sanitized = (0, router_1.sanitizeLogData)(log);
    strict_1.default.equal(sanitized.includes('abc123def456ghi789'), false);
    strict_1.default.equal(sanitized.includes('Bearer [REDACTED_TOKEN]'), true);
});
test('preserves non-sensitive data', () => {
    const log = 'Request completed in 150ms with status 200';
    const sanitized = (0, router_1.sanitizeLogData)(log);
    strict_1.default.equal(sanitized, log);
});
test('handles multiple sensitive items in one log', () => {
    const log = 'User user@example.com with API key sk-abc123def456ghi789jkl012 called from 555-123-4567';
    const sanitized = (0, router_1.sanitizeLogData)(log);
    strict_1.default.equal(sanitized.includes('user@example.com'), false);
    strict_1.default.equal(sanitized.includes('sk-abc123def456ghi789jkl012'), false);
    strict_1.default.equal(sanitized.includes('555-123-4567'), false);
    strict_1.default.equal(sanitized.includes('[REDACTED_EMAIL]'), true);
    strict_1.default.equal(sanitized.includes('[REDACTED_API_KEY]'), true);
    strict_1.default.equal(sanitized.includes('[REDACTED_PHONE]'), true);
});
let passed = 0;
async function main() {
    for (const { name, run } of tests) {
        try {
            await run();
            passed += 1;
            console.log(`PASS ${name}`);
        }
        catch (error) {
            console.error(`FAIL ${name}`);
            console.error(error);
            process.exitCode = 1;
            break;
        }
    }
    if (!process.exitCode) {
        console.log(`All ${passed} sanitization tests passed.`);
    }
}
void main();
