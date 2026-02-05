"use client";

import { useState, useCallback, useEffect } from "react";

type UndoRedoOptions<T> = {
  /** Maximum number of history states to keep */
  maxHistory?: number;
  /** Callback when state changes */
  onChange?: (state: T) => void;
};

type UndoRedoResult<T> = {
  /** Current state */
  state: T;
  /** Update the state (pushes to history) */
  setState: (newState: T | ((prev: T) => T)) => void;
  /** Undo to previous state */
  undo: () => void;
  /** Redo to next state */
  redo: () => void;
  /** Whether undo is available */
  canUndo: boolean;
  /** Whether redo is available */
  canRedo: boolean;
  /** Number of undo steps available */
  undoCount: number;
  /** Number of redo steps available */
  redoCount: number;
  /** Reset history (keeps current state) */
  resetHistory: () => void;
  /** Replace current state without adding to history */
  replaceState: (newState: T) => void;
};

/**
 * Hook for managing undo/redo history stack.
 *
 * Usage:
 * ```ts
 * const { state, setState, undo, redo, canUndo, canRedo } = useUndoRedo(initialState);
 * ```
 */
export function useUndoRedo<T>(
  initialState: T,
  options: UndoRedoOptions<T> = {}
): UndoRedoResult<T> {
  const { maxHistory = 50, onChange } = options;

  // History stack: past states
  const [past, setPast] = useState<T[]>([]);
  // Current state
  const [present, setPresent] = useState<T>(initialState);
  // Future stack: states for redo
  const [future, setFuture] = useState<T[]>([]);

  // Update state and push current to history
  const setState = useCallback(
    (newState: T | ((prev: T) => T)) => {
      setPresent((currentPresent) => {
        const nextState =
          typeof newState === "function"
            ? (newState as (prev: T) => T)(currentPresent)
            : newState;

        // Push current state to past
        setPast((currentPast) => {
          const newPast = [...currentPast, currentPresent];
          // Limit history size
          if (newPast.length > maxHistory) {
            return newPast.slice(-maxHistory);
          }
          return newPast;
        });

        // Clear future when new state is set
        setFuture([]);

        return nextState;
      });
    },
    [maxHistory]
  );

  // Undo: move present to future, pop past to present
  const undo = useCallback(() => {
    setPast((currentPast) => {
      if (currentPast.length === 0) return currentPast;

      const newPast = [...currentPast];
      const previousState = newPast.pop()!;

      setPresent((currentPresent) => {
        // Push current to future
        setFuture((currentFuture) => [currentPresent, ...currentFuture]);
        return previousState;
      });

      return newPast;
    });
  }, []);

  // Redo: move present to past, pop future to present
  const redo = useCallback(() => {
    setFuture((currentFuture) => {
      if (currentFuture.length === 0) return currentFuture;

      const newFuture = [...currentFuture];
      const nextState = newFuture.shift()!;

      setPresent((currentPresent) => {
        // Push current to past
        setPast((currentPast) => [...currentPast, currentPresent]);
        return nextState;
      });

      return newFuture;
    });
  }, []);

  // Reset history but keep current state
  const resetHistory = useCallback(() => {
    setPast([]);
    setFuture([]);
  }, []);

  // Replace current state without adding to history
  const replaceState = useCallback((newState: T) => {
    setPresent(newState);
  }, []);

  // Call onChange when present changes
  useEffect(() => {
    if (onChange) {
      onChange(present);
    }
  }, [present, onChange]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger when typing in inputs
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target instanceof HTMLElement && e.target.isContentEditable)
      ) {
        return;
      }

      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const modifier = isMac ? e.metaKey : e.ctrlKey;

      if (modifier && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (modifier && e.key === "z" && e.shiftKey) {
        e.preventDefault();
        redo();
      } else if (modifier && e.key === "y") {
        e.preventDefault();
        redo();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undo, redo]);

  return {
    state: present,
    setState,
    undo,
    redo,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
    undoCount: past.length,
    redoCount: future.length,
    resetHistory,
    replaceState,
  };
}
