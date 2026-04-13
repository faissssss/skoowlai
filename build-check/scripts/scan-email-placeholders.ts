/**
 * Email Template Placeholder Scanner
 * 
 * This script scans email templates for leaked placeholder text
 * (e.g., {FIRST_NAME}, {{name}}, etc.) that should never reach customers.
 * 
 * Run: npx ts-node scripts/scan-email-placeholders.ts
 * Or: npm run test:email-placeholders
 */

import * as fs from 'fs';
import * as path from 'path';

// Patterns that indicate leaked placeholders
const PLACEHOLDER_PATTERNS = [
    /\{\{?\s*[A-Z_]+\s*\}?\}/g,           // {FIRST_NAME} or {{FIRST_NAME}}
    /\{\{\s*\w+\s*\}\}/g,                  // {{name}} or {{ email }}
    /\$\{\s*\w+\s*\}/g,                    // ${name} template literals that escaped
    /\[\s*[A-Z_]+\s*\]/g,                  // [FIRST_NAME] bracket style
    /%\w+%/g,                              // %FIRST_NAME% percent style
];

// Known safe patterns (not placeholders)
const SAFE_PATTERNS = [
    /\$\{\s*COLORS\.\w+\s*\}/,             // Template literal for COLORS object
    /\$\{\s*year\s*\}/,                    // Dynamic year
    /\$\{\s*userName\s*\}/,                // Variables with fallbacks
    /\$\{\s*planName\s*\}/,
    /\$\{\s*price\s*\}/,
    /\$\{\s*today\s*\}/,
    /\$\{\s*nextBilling\s*\}/,
    /\$\{\s*subscriptionId\s*\}/,
    /\$\{\s*email\s*\}/,
    /\$\{\s*savings\s*\}/,
    /\$\{\s*interval\s*\}/,
    /\$\{\s*daysRemaining\s*\}/,
    /\$\{\s*endDateFormatted\s*\}/,
    /\$\{\s*nextDateFormatted\s*\}/,
    /\$\{\s*failureReason\s*\}/,
];

interface ScanResult {
    file: string;
    line: number;
    match: string;
    context: string;
}

function isSafePattern(match: string): boolean {
    return SAFE_PATTERNS.some(pattern => pattern.test(match));
}

function scanFile(filePath: string): ScanResult[] {
    const results: ScanResult[] = [];
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    lines.forEach((line, index) => {
        PLACEHOLDER_PATTERNS.forEach(pattern => {
            const matches = line.match(pattern);
            if (matches) {
                matches.forEach(match => {
                    // Skip safe patterns
                    if (isSafePattern(match)) return;

                    // Skip if it's clearly a code variable reference
                    if (match.startsWith('${') && !match.includes(' ')) return;

                    results.push({
                        file: filePath,
                        line: index + 1,
                        match,
                        context: line.trim().substring(0, 100),
                    });
                });
            }
        });
    });

    return results;
}

function main() {
    const emailTemplatesPath = path.join(__dirname, '../src/lib/emailTemplates.ts');

    console.log('🔍 Scanning email templates for placeholder leaks...\n');

    if (!fs.existsSync(emailTemplatesPath)) {
        console.error(`❌ File not found: ${emailTemplatesPath}`);
        process.exit(1);
    }

    const results = scanFile(emailTemplatesPath);

    if (results.length === 0) {
        console.log('✅ No placeholder leaks detected!\n');
        console.log('All email templates are safe to send.');
        process.exit(0);
    } else {
        console.log(`❌ Found ${results.length} potential placeholder leak(s):\n`);
        results.forEach(result => {
            console.log(`  📍 ${result.file}:${result.line}`);
            console.log(`     Match: "${result.match}"`);
            console.log(`     Context: ${result.context}`);
            console.log('');
        });
        console.log('⚠️  Please fix these placeholders before deploying.');
        process.exit(1);
    }
}

main();
