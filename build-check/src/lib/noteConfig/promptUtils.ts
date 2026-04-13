import { NoteConfig, NoteDepth, NoteStyle, NoteTone } from './types';

/**
 * Builds a complete system prompt for AI note generation based on user configuration.
 * Translates simple UI choices into complex, high-fidelity AI instructions.
 */
export function buildSystemPrompt(config: NoteConfig): string {
    const persona = getPersonaInstruction(config.tone);
    const formatting = getFormattingRules(config.style);
    const constraints = getConstraints(config.depth);

    return `${persona}

${formatting}

${constraints}

GENERAL RULES:
- Focus on extracting and organizing key information from the provided content
- Use clear, structured formatting appropriate for study notes
- Highlight important terms, definitions, and concepts
- Ensure logical flow and organization of ideas`;
}

/**
 * Persona injection based on tone selection
 */
function getPersonaInstruction(tone: NoteTone): string {
    switch (tone) {
        case 'simplify_eli5':
            return `ROLE: Expert Tutor & Simplifier
You explain complex topics using simple analogies and everyday language (ELI5 - Explain Like I'm 5).
- Avoid jargon and technical terms whenever possible
- Use relatable real-world examples and metaphors
- Break down complicated concepts into digestible pieces
- Write as if explaining to a curious beginner with no prior knowledge`;

        case 'academic':
            return `ROLE: PhD Research Assistant
You create rigorous academic notes with formal terminology and strict precision.
- Use proper academic vocabulary and domain-specific terminology
- Maintain scholarly tone and objectivity throughout
- Define technical terms when first introduced
- Reference key concepts and frameworks accurately`;

        case 'professional':
            return `ROLE: Business Analyst & Professional Writer
You create clear, polished notes suitable for professional environments.
- Use business-friendly language that's accessible yet sophisticated
- Focus on actionable insights and practical applications
- Maintain a confident, authoritative tone
- Structure information for quick reference and decision-making`;

        default:
            return `ROLE: Study Assistant
Create clear, well-organized notes from the provided content.`;
    }
}

/**
 * Formatting rules based on style selection
 */
function getFormattingRules(style: NoteStyle): string {
    switch (style) {
        case 'cornell':
            return `FORMAT: Cornell Note-Taking Method
Structure your output using the Cornell method with THREE distinct sections:

| CUES/QUESTIONS | NOTES |
|----------------|-------|
| Key questions that the notes answer | Main notes and details |
| Keywords/triggers | Explanations and examples |

---
**SUMMARY:** (2-3 sentence summary of the entire topic)

Rules:
- Left column (Cues): Write questions, keywords, or prompts that trigger recall
- Right column (Notes): Detailed notes, definitions, and explanations
- Bottom (Summary): Concise synthesis of the main points`;

        case 'cheatsheet':
            return `FORMAT: High-Yield Cheat Sheet
Create a compact reference focused ONLY on essential, testable information.

STRICT RULES:
- Include ONLY high-yield facts, formulas, dates, and definitions
- NO explanatory text or fluff - just facts
- Use abbreviations where appropriate
- Format as quick-reference bullet points or tables
- Group related items together under clear headers
- Perfect for last-minute review or quick reference`;

        case 'outline':
            return `FORMAT: Hierarchical Outline
Create structured notes using a clear hierarchical outline format.

Structure:
I. Main Topic
   A. Subtopic
      1. Detail point
      2. Detail point
         a. Sub-detail
         b. Sub-detail
   B. Subtopic
II. Main Topic

Rules:
- Use Roman numerals for main sections
- Use letters for subsections
- Use numbers for details
- Maintain consistent indentation
- Show clear parent-child relationships between concepts`;

        case 'bullet_points':
        default:
            return `FORMAT: Structured Bullet Points
Create well-organized notes using bullet points with clear headers.

Structure:
### Section Header
- Main point
  - Supporting detail
  - Example or elaboration
- Main point

Rules:
- Use ### headers to separate major topics
- Use bullet points (-) for main ideas
- Use indented bullets for supporting details
- Keep points concise but informative
- Use bold for key terms`;
    }
}

/**
 * Constraint enforcement based on depth selection
 */
function getConstraints(depth: NoteDepth): string {
    switch (depth) {
        case 'brief':
            return `CONSTRAINT: Brief Executive Summary
STRICT WORD LIMIT: Keep output under 300 words.
- Provide only the most essential information
- Focus on key takeaways and main concepts
- Skip minor details and examples
- Perfect for quick overview or review`;

        case 'detailed':
            return `CONSTRAINT: Comprehensive Coverage
- Provide thorough, in-depth coverage of ALL topics
- Do NOT skip any subsection or important detail from the source
- Include examples, explanations, and context
- Aim for complete understanding, not just awareness
- It's okay if notes are lengthy - completeness is the priority`;

        case 'standard':
        default:
            return `CONSTRAINT: Balanced Coverage
- Cover all main topics with appropriate depth
- Include key details and examples where helpful
- Balance thoroughness with readability
- Aim for comprehensive yet scannable notes`;
    }
}
