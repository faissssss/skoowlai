// Note generation configuration types

export type NoteDepth = 'brief' | 'standard' | 'detailed';
export type NoteStyle = 'bullet_points' | 'cornell' | 'cheatsheet' | 'outline';
export type NoteTone = 'academic' | 'simplify_eli5' | 'professional';

export interface NoteConfig {
    depth: NoteDepth;
    style: NoteStyle;
    tone: NoteTone;
}

export const DEFAULT_NOTE_CONFIG: NoteConfig = {
    depth: 'standard',
    style: 'bullet_points',
    tone: 'academic',
};

// UI display labels for each option
export const DEPTH_OPTIONS: { value: NoteDepth; label: string; description: string }[] = [
    { value: 'brief', label: 'Brief', description: 'Quick summary' },
    { value: 'standard', label: 'Standard', description: 'Balanced coverage' },
    { value: 'detailed', label: 'Detailed', description: 'Comprehensive' },
];

export const STYLE_OPTIONS: { value: NoteStyle; label: string; description: string }[] = [
    { value: 'bullet_points', label: 'Bullet Points', description: 'Easy to scan' },
    { value: 'cornell', label: 'Cornell Notes', description: 'Cues | Notes | Summary' },
    { value: 'cheatsheet', label: 'Cheat Sheet', description: 'Key facts only' },
    { value: 'outline', label: 'Outline', description: 'Hierarchical structure' },
];

export const TONE_OPTIONS: { value: NoteTone; label: string; description: string }[] = [
    { value: 'academic', label: 'Academic', description: 'Formal & precise' },
    { value: 'simplify_eli5', label: 'Simplified (ELI5)', description: 'Easy to understand' },
    { value: 'professional', label: 'Professional', description: 'Business-friendly' },
];
