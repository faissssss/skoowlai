export interface BudgetedContent {
  content: string;
  originalEstimatedTokens: number;
  trimmedEstimatedTokens: number;
  wasTrimmed: boolean;
}

const CHARS_PER_TOKEN = 4;
const TRUNCATION_NOTICE = '\n\n[Content trimmed to fit model limits.]';

export function estimateTextTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

function normalizeContent(content: string): string {
  return content
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function budgetContent(
  content: string,
  maxSourceTokens: number,
): BudgetedContent {
  const normalized = normalizeContent(content);
  const originalEstimatedTokens = estimateTextTokens(normalized);

  if (!normalized) {
    return {
      content: '',
      originalEstimatedTokens,
      trimmedEstimatedTokens: 0,
      wasTrimmed: false,
    };
  }

  const maxChars = maxSourceTokens * CHARS_PER_TOKEN;
  if (normalized.length <= maxChars) {
    return {
      content: normalized,
      originalEstimatedTokens,
      trimmedEstimatedTokens: originalEstimatedTokens,
      wasTrimmed: false,
    };
  }

  const allowedChars = Math.max(0, maxChars - TRUNCATION_NOTICE.length);
  const paragraphs = normalized.split(/\n{2,}/);
  const keptParagraphs: string[] = [];
  let currentLength = 0;

  for (const paragraph of paragraphs) {
    const nextLength =
      currentLength + paragraph.length + (keptParagraphs.length > 0 ? 2 : 0);

    if (nextLength > allowedChars) {
      break;
    }

    keptParagraphs.push(paragraph);
    currentLength = nextLength;
  }

  let trimmed = keptParagraphs.join('\n\n');

  if (!trimmed) {
    trimmed = normalized.slice(0, allowedChars).trimEnd();
  }

  const finalContent = `${trimmed}${TRUNCATION_NOTICE}`;

  return {
    content: finalContent,
    originalEstimatedTokens,
    trimmedEstimatedTokens: estimateTextTokens(finalContent),
    wasTrimmed: true,
  };
}
