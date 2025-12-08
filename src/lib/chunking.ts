/**
 * Text chunking utilities for processing long content
 * Splits text into manageable chunks and combines results
 */

const MAX_CHUNK_SIZE = 15000; // Characters per chunk
const OVERLAP_SIZE = 500; // Overlap between chunks for context

/**
 * Split long text into chunks at sentence/paragraph boundaries
 */
export function chunkText(text: string, maxSize: number = MAX_CHUNK_SIZE): string[] {
    if (text.length <= maxSize) {
        return [text];
    }

    const chunks: string[] = [];
    let currentPos = 0;

    while (currentPos < text.length) {
        let endPos = currentPos + maxSize;

        if (endPos >= text.length) {
            // Last chunk - take everything remaining
            chunks.push(text.slice(currentPos).trim());
            break;
        }

        // Look for a good break point (paragraph, sentence, or word boundary)
        const searchText = text.slice(currentPos, endPos);

        // Try to find paragraph break first
        let breakPos = searchText.lastIndexOf('\n\n');

        // If no paragraph, try sentence break
        if (breakPos < maxSize * 0.5) {
            const sentenceBreaks = ['. ', '! ', '? ', '.\n', '!\n', '?\n'];
            for (const sep of sentenceBreaks) {
                const pos = searchText.lastIndexOf(sep);
                if (pos > breakPos) breakPos = pos + sep.length - 1;
            }
        }

        // If still no good break, find word boundary
        if (breakPos < maxSize * 0.3) {
            breakPos = searchText.lastIndexOf(' ');
        }

        // Fallback to max size if no breaks found
        if (breakPos < maxSize * 0.2) {
            breakPos = maxSize;
        }

        chunks.push(text.slice(currentPos, currentPos + breakPos + 1).trim());

        // Move position with overlap for context continuity
        currentPos += breakPos + 1 - OVERLAP_SIZE;
        if (currentPos < 0) currentPos = 0;
    }

    return chunks.filter(chunk => chunk.length > 0);
}

/**
 * Combine notes from multiple chunks into unified notes
 */
export function combineNotes(noteChunks: string[]): string {
    if (noteChunks.length === 0) return '';
    if (noteChunks.length === 1) return noteChunks[0];

    // Extract the title from the first chunk (# heading)
    const firstChunk = noteChunks[0];
    const titleMatch = firstChunk.match(/^#\s+.+$/m);
    const title = titleMatch ? titleMatch[0] : '# Study Notes';

    // Remove title from first chunk to avoid duplication
    const firstContent = titleMatch
        ? firstChunk.replace(titleMatch[0], '').trim()
        : firstChunk;

    // Combine all content
    const allContent = [firstContent, ...noteChunks.slice(1)].join('\n\n---\n\n');

    // Remove duplicate headings (## headers that appear multiple times)
    const lines = allContent.split('\n');
    const seenHeadings = new Set<string>();
    const deduplicatedLines: string[] = [];

    for (const line of lines) {
        const headingMatch = line.match(/^##\s+(.+)$/);
        if (headingMatch) {
            const headingText = headingMatch[1].toLowerCase().trim();
            if (seenHeadings.has(headingText)) {
                // Skip duplicate heading but keep content
                continue;
            }
            seenHeadings.add(headingText);
        }
        deduplicatedLines.push(line);
    }

    return `${title}\n\n${deduplicatedLines.join('\n')}`.trim();
}

/**
 * Check if content needs chunking
 */
export function needsChunking(text: string): boolean {
    return text.length > MAX_CHUNK_SIZE;
}
