/**
 * Preservation Property Tests — Task 2
 *
 * These tests confirm the non-buggy paths work correctly on UNFIXED code.
 * They capture baseline behavior that must be preserved after the fix.
 *
 * EXPECTED OUTCOME: Tests PASS on unfixed code.
 * Passing confirms the baseline behavior to preserve.
 *
 * Validates: Requirements 3.5, 3.6, 3.7, 3.12, 3.13, 3.14, 3.15, 3.16
 *
 * Property 2: Preservation — Non-Buggy Paths Unchanged
 *   For any input that does NOT reach the catch block with a server-derived error
 *   (success responses, 429 upgrade-modal responses), the components SHALL produce
 *   exactly the same behavior as the original code.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

// ── Shared mocks ─────────────────────────────────────────────────────────────
const mockShowError = vi.fn();
const mockStartLoading = vi.fn();
const mockStopLoading = vi.fn();

// ── Mock contexts and hooks ──────────────────────────────────────────────────
vi.mock('@/contexts/LoaderContext', () => ({
  useGlobalLoader: () => ({
    startLoading: mockStartLoading,
    stopLoading: mockStopLoading,
  }),
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
function mockFetchOk() {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    })
  );
}

function mockFetch429Upgrade() {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({ details: 'Limit reached', upgradeRequired: true }),
    })
  );
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('Preservation — Success path (200 OK)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it('FlashcardConfig — onGenerated is called and showError is NOT called on success', async () => {
    mockFetchOk();
    const onGenerated = vi.fn();

    render(
      <FlashcardConfig
        deckId="test-deck-id"
        isOpen={true}
        onClose={vi.fn()}
        onGenerated={onGenerated}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: /generate flashcards/i }));

    await waitFor(() => expect(onGenerated).toHaveBeenCalled());
    expect(mockShowError).not.toHaveBeenCalled();
  });

  it('MindMapConfig — onGenerated is called and showError is NOT called on success', async () => {
    mockFetchOk();
    const onGenerated = vi.fn();

    render(
      <MindMapConfig
        deckId="test-deck-id"
        isOpen={true}
        onClose={vi.fn()}
        onGenerated={onGenerated}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: /generate mind map/i }));

    await waitFor(() => expect(onGenerated).toHaveBeenCalled());
    expect(mockShowError).not.toHaveBeenCalled();
  });

  it('QuizConfig — onGenerated is called (with any args) and showError is NOT called on success', async () => {
    mockFetchOk();
    const onGenerated = vi.fn();

    render(
      <QuizConfig
        deckId="test-deck-id"
        isOpen={true}
        onClose={vi.fn()}
        onGenerated={onGenerated}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: /generate quiz/i }));

    await waitFor(() => expect(onGenerated).toHaveBeenCalled());
    expect(mockShowError).not.toHaveBeenCalled();
  });
});

describe('Preservation — 429 upgrade-modal path', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it('FlashcardConfig — showError called with type "limit" and onGenerated is NOT called on 429', async () => {
    mockFetch429Upgrade();
    const onGenerated = vi.fn();

    render(
      <FlashcardConfig
        deckId="test-deck-id"
        isOpen={true}
        onClose={vi.fn()}
        onGenerated={onGenerated}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: /generate flashcards/i }));

    await waitFor(() => expect(mockShowError).toHaveBeenCalled());
    expect(mockShowError.mock.calls[0][2]).toBe('limit');
    expect(onGenerated).not.toHaveBeenCalled();
  });

  it('MindMapConfig — showError called with type "limit" and onGenerated is NOT called on 429', async () => {
    mockFetch429Upgrade();
    const onGenerated = vi.fn();

    render(
      <MindMapConfig
        deckId="test-deck-id"
        isOpen={true}
        onClose={vi.fn()}
        onGenerated={onGenerated}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: /generate mind map/i }));

    await waitFor(() => expect(mockShowError).toHaveBeenCalled());
    expect(mockShowError.mock.calls[0][2]).toBe('limit');
    expect(onGenerated).not.toHaveBeenCalled();
  });

  it('QuizConfig — showError called with type "limit" and onGenerated is NOT called on 429', async () => {
    mockFetch429Upgrade();
    const onGenerated = vi.fn();

    render(
      <QuizConfig
        deckId="test-deck-id"
        isOpen={true}
        onClose={vi.fn()}
        onGenerated={onGenerated}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: /generate quiz/i }));

    await waitFor(() => expect(mockShowError).toHaveBeenCalled());
    expect(mockShowError.mock.calls[0][2]).toBe('limit');
    expect(onGenerated).not.toHaveBeenCalled();
  });
});

describe('Preservation — Loading state reset after any outcome', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it('FlashcardConfig — stopLoading is called after success', async () => {
    mockFetchOk();

    render(
      <FlashcardConfig
        deckId="test-deck-id"
        isOpen={true}
        onClose={vi.fn()}
        onGenerated={vi.fn()}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: /generate flashcards/i }));

    await waitFor(() => expect(mockStopLoading).toHaveBeenCalled());
  });

  it('FlashcardConfig — stopLoading is called after 429 error', async () => {
    mockFetch429Upgrade();

    render(
      <FlashcardConfig
        deckId="test-deck-id"
        isOpen={true}
        onClose={vi.fn()}
        onGenerated={vi.fn()}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: /generate flashcards/i }));

    await waitFor(() => expect(mockStopLoading).toHaveBeenCalled());
  });

  it('MindMapConfig — stopLoading is called after success', async () => {
    mockFetchOk();

    render(
      <MindMapConfig
        deckId="test-deck-id"
        isOpen={true}
        onClose={vi.fn()}
        onGenerated={vi.fn()}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: /generate mind map/i }));

    await waitFor(() => expect(mockStopLoading).toHaveBeenCalled());
  });

  it('MindMapConfig — stopLoading is called after 429 error', async () => {
    mockFetch429Upgrade();

    render(
      <MindMapConfig
        deckId="test-deck-id"
        isOpen={true}
        onClose={vi.fn()}
        onGenerated={vi.fn()}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: /generate mind map/i }));

    await waitFor(() => expect(mockStopLoading).toHaveBeenCalled());
  });

  it('QuizConfig — stopLoading is called after success', async () => {
    mockFetchOk();

    render(
      <QuizConfig
        deckId="test-deck-id"
        isOpen={true}
        onClose={vi.fn()}
        onGenerated={vi.fn()}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: /generate quiz/i }));

    await waitFor(() => expect(mockStopLoading).toHaveBeenCalled());
  });

  it('QuizConfig — stopLoading is called after 429 error', async () => {
    mockFetch429Upgrade();

    render(
      <QuizConfig
        deckId="test-deck-id"
        isOpen={true}
        onClose={vi.fn()}
        onGenerated={vi.fn()}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: /generate quiz/i }));

    await waitFor(() => expect(mockStopLoading).toHaveBeenCalled());
  });
});
