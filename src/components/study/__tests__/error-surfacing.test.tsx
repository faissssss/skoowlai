/**
 * Bug Condition Exploration Tests — Task 1
 *
 * These tests confirm the bug exists in FlashcardConfig, MindMapConfig, and QuizConfig.
 * The catch blocks in these components ignore error.message and use hardcoded strings instead.
 *
 * EXPECTED OUTCOME: Tests FAIL on unfixed code.
 * Failure confirms the bug: showError is called with a hardcoded string instead of error.message.
 *
 * Validates: Requirements 1.5, 1.6, 1.7
 *
 * Bug_Condition: isBugCondition(component, catchBlock) where
 *   catchBlock.displaysHardcodedString AND NOT catchBlock.uses(error.message)
 *   AND component IN [FlashcardConfig, MindMapConfig, QuizConfig]
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

// ── Shared mock for showError ────────────────────────────────────────────────
const mockShowError = vi.fn();

// ── Mock contexts and hooks ──────────────────────────────────────────────────
vi.mock('@/contexts/LoaderContext', () => ({
  useGlobalLoader: () => ({ startLoading: vi.fn(), stopLoading: vi.fn() }),
}));

vi.mock('@/components/ErrorModal', () => ({
  useErrorModal: () => ({ showError: mockShowError }),
}));

// ── Mock heavy UI dependencies ───────────────────────────────────────────────
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) =>
      React.createElement('div', props, children),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
}));

vi.mock('@/components/PricingModal', () => ({
  default: () => null,
}));

vi.mock('@/components/ui/choice-chip', () => ({
  ChoiceChipGroup: ({
    label,
    options,
    value,
    onChange,
    disabled,
  }: {
    label: string;
    options: Array<{ value: string; label: string }>;
    value: string;
    onChange: (v: string) => void;
    disabled?: boolean;
    centered?: boolean;
    onUpgradeRequired?: () => void;
  }) =>
    React.createElement(
      'div',
      { 'data-testid': `choice-chip-${label.toLowerCase().replace(/\s+/g, '-')}` },
      options.map((opt) =>
        React.createElement(
          'button',
          {
            key: opt.value,
            onClick: () => onChange(opt.value),
            disabled,
            'data-selected': value === opt.value,
          },
          opt.label
        )
      )
    ),
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) =>
    React.createElement('button', { onClick, disabled, ...props }, children),
}));

vi.mock('@/components/ui/input', () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) =>
    React.createElement('input', props),
}));

vi.mock('lucide-react', () => ({
  Loader2: () => null,
  Sparkles: () => null,
  MessageSquare: () => null,
  Wrench: () => null,
  X: () => null,
  Layers: () => null,
  Tag: () => null,
  Database: () => null,
  Shuffle: () => null,
  GalleryHorizontal: () => null,
  Network: () => null,
  Clock: () => null,
  CheckCircle2: () => null,
  HelpCircle: () => null,
  Pencil: () => null,
}));

// ── Import components under test ─────────────────────────────────────────────
import FlashcardConfig from '../FlashcardConfig';
import MindMapConfig from '../MindMapConfig';
import QuizConfig from '../QuizConfig';

// ── Helpers ──────────────────────────────────────────────────────────────────
function mockFetchThrows(message: string) {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error(message)));
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('Bug Condition Exploration — catch blocks ignore error.message', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  /**
   * FlashcardConfig: fetch throws Error('Content too long')
   * Expected (fixed): showError 2nd arg === 'Content too long'
   * Actual (buggy):   showError 2nd arg === 'Failed to generate flashcards. Please try again.'
   *
   * COUNTEREXAMPLE: showError called with hardcoded string instead of error.message
   */
  it('FlashcardConfig — showError 2nd arg should equal error.message, not hardcoded string', async () => {
    mockFetchThrows('Content too long');

    render(
      <FlashcardConfig
        deckId="test-deck-id"
        isOpen={true}
        onClose={vi.fn()}
        onGenerated={vi.fn()}
      />
    );

    const generateButton = screen.getByRole('button', { name: /generate flashcards/i });
    await userEvent.click(generateButton);

    expect(mockShowError).toHaveBeenCalled();
    const secondArg = mockShowError.mock.calls[0][1];
    // This assertion FAILS on unfixed code:
    // Actual: 'Failed to generate flashcards. Please try again.'
    // Expected: 'Content too long'
    expect(secondArg).toBe('Content too long');
  });

  /**
   * MindMapConfig: fetch throws Error('Invalid file type')
   * Expected (fixed): showError 2nd arg === 'Invalid file type'
   * Actual (buggy):   showError 2nd arg === 'Failed to generate mind map. Please try again.'
   *
   * COUNTEREXAMPLE: showError called with hardcoded string instead of error.message
   */
  it('MindMapConfig — showError 2nd arg should equal error.message, not hardcoded string', async () => {
    mockFetchThrows('Invalid file type');

    render(
      <MindMapConfig
        deckId="test-deck-id"
        isOpen={true}
        onClose={vi.fn()}
        onGenerated={vi.fn()}
      />
    );

    const generateButton = screen.getByRole('button', { name: /generate mind map/i });
    await userEvent.click(generateButton);

    expect(mockShowError).toHaveBeenCalled();
    const secondArg = mockShowError.mock.calls[0][1];
    // This assertion FAILS on unfixed code:
    // Actual: 'Failed to generate mind map. Please try again.'
    // Expected: 'Invalid file type'
    expect(secondArg).toBe('Invalid file type');
  });

  /**
   * QuizConfig: fetch throws Error('Service unavailable')
   * Expected (fixed): showError 2nd arg === 'Service unavailable'
   * Actual (buggy):   showError 2nd arg === 'Failed to generate quiz. Please try again.'
   *
   * COUNTEREXAMPLE: showError called with hardcoded string instead of error.message
   */
  it('QuizConfig — showError 2nd arg should equal error.message, not hardcoded string', async () => {
    mockFetchThrows('Service unavailable');

    render(
      <QuizConfig
        deckId="test-deck-id"
        isOpen={true}
        onClose={vi.fn()}
        onGenerated={vi.fn()}
      />
    );

    const generateButton = screen.getByRole('button', { name: /generate quiz/i });
    await userEvent.click(generateButton);

    expect(mockShowError).toHaveBeenCalled();
    const secondArg = mockShowError.mock.calls[0][1];
    // This assertion FAILS on unfixed code:
    // Actual: 'Failed to generate quiz. Please try again.'
    // Expected: 'Service unavailable'
    expect(secondArg).toBe('Service unavailable');
  });
});
