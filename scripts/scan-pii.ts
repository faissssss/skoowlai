/**
 * PII Masking Scanner
 * 
 * Scans code for potential PII leaks like credit card numbers, SSNs, etc.
 * Run: npm run test:pii-scanner
 */

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

// PII patterns to detect
const PII_PATTERNS = [
    { name: 'Credit Card (16 digits)', pattern: /\b[0-9]{16}\b/g },
    { name: 'Credit Card (spaced)', pattern: /\b[0-9]{4}[\s-][0-9]{4}[\s-][0-9]{4}[\s-][0-9]{4}\b/g },
    { name: 'SSN', pattern: /\b[0-9]{3}-[0-9]{2}-[0-9]{4}\b/g },
    { name: 'Unmasked Card Variable', pattern: /cardNumber\s*[:=]\s*["'][0-9]{13,19}["']/gi },
    // Detects actual card numbers in template strings like ${4111111111111111}
    { name: 'Card Number in Template', pattern: /\$\{[0-9]{13,19}\}/g },
    
    // API Key patterns (SECURITY: Critical to detect)
    { name: 'Groq API Key', pattern: /gsk_[a-zA-Z0-9]{32,}/g },
    { name: 'Stripe Secret Key', pattern: /sk_(test|live)_[a-zA-Z0-9]{24,}/g },
    { name: 'Resend API Key', pattern: /re_[a-zA-Z0-9]{24,}/g },
    { name: 'Google API Key', pattern: /AIzaSy[a-zA-Z0-9_-]{33}/g },
    { name: 'Webhook Secret', pattern: /whsec_[a-zA-Z0-9]{32,}/g },
    { name: 'Generic API Key Pattern', pattern: /['"](sk|pk|api|key)_[a-zA-Z0-9]{20,}['"]/gi },
];

// Files/patterns to exclude
const EXCLUDE_PATTERNS = [
    /node_modules/,
    /\.git/,
    /\.next/,
    /dist/,
    /build/,
    /\.test\./,
    /\.spec\./,
    /scan-.*\.ts$/,  // Exclude scanner scripts themselves
    /\.env/,         // Exclude .env files (secrets belong here)
    /\.env\./,       // Exclude .env.local, .env.production, etc.
];

// Only scan these file types
const INCLUDE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.json'];

interface ScanResult {
    file: string;
    line: number;
    pattern: string;
    match: string;
    context: string;
}

function shouldScanFile(filePath: string): boolean {
    // Check exclusions
    if (EXCLUDE_PATTERNS.some(p => p.test(filePath))) {
        return false;
    }
    // Check extensions
    const ext = path.extname(filePath);
    return INCLUDE_EXTENSIONS.includes(ext);
}

function getAllFiles(dir: string, files: string[] = []): string[] {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (!EXCLUDE_PATTERNS.some(p => p.test(fullPath))) {
                getAllFiles(fullPath, files);
            }
        } else if (shouldScanFile(fullPath)) {
            files.push(fullPath);
        }
    }

    return files;
}

function scanFile(filePath: string): ScanResult[] {
    const results: ScanResult[] = [];
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    lines.forEach((line, index) => {
        // Skip comments and known safe patterns
        if (line.trim().startsWith('//') || line.trim().startsWith('*')) {
            return;
        }

        PII_PATTERNS.forEach(({ name, pattern }) => {
            // Reset regex lastIndex
            pattern.lastIndex = 0;
            const matches = line.match(pattern);

            if (matches) {
                matches.forEach(match => {
                    // Exclude test card numbers (4111, 4242, etc.)
                    if (/^4111|^4242|^5555|^3782/.test(match.replace(/[\s-]/g, ''))) {
                        return;
                    }

                    results.push({
                        file: filePath,
                        line: index + 1,
                        pattern: name,
                        match: match.substring(0, 20) + (match.length > 20 ? '...' : ''),
                        context: line.trim().substring(0, 80),
                    });
                });
            }
        });
    });

    return results;
}

function main() {
    const srcDir = path.join(__dirname, '../src');
    const scriptsDir = path.join(__dirname, '../scripts');

    console.log('🔍 Scanning for PII leaks and exposed API keys...\n');

    if (!fs.existsSync(srcDir)) {
        console.error(`❌ Directory not found: ${srcDir}`);
        process.exit(1);
    }

    const srcFiles = getAllFiles(srcDir);
    const scriptFiles = getAllFiles(scriptsDir);
    const files = [...srcFiles, ...scriptFiles];
    
    console.log(`Scanning ${files.length} files...\n`);

    let allResults: ScanResult[] = [];

    for (const file of files) {
        const results = scanFile(file);
        allResults = allResults.concat(results);
    }

    if (allResults.length === 0) {
        console.log('✅ No PII leaks or exposed API keys detected!\n');
        console.log('All source files are safe.');
        process.exit(0);
    } else {
        console.log(`❌ Found ${allResults.length} potential security issue(s):\n`);
        allResults.forEach(result => {
            console.log(`  📍 ${result.file}:${result.line}`);
            console.log(`     Type: ${result.pattern}`);
            console.log(`     Match: "${result.match}"`);
            console.log(`     Context: ${result.context}`);
            console.log('');
        });
        console.log('⚠️  CRITICAL: Review and remove any real secrets before committing!');
        console.log('⚠️  API keys should only be in .env files (which are gitignored).');
        process.exit(1);
    }
}

main();
