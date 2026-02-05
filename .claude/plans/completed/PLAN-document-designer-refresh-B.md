# Plan B: Document Designer Refresh
## Perspective: Senior Software Engineer (Architecture, Maintainability)

**Created**: 2026-02-04
**Status**: Draft
**Perspective Priority**: Build it right, make it maintainable, handle edge cases gracefully.

---

## Technical Assessment of Current State

### Architecture Review

The current Document Designer has a solid foundation:

**Strengths**:
- Clean type definitions (`/src/lib/documents/types.ts`)
- Separation of concerns (canvas, drag hooks, rendering)
- Dual rendering paths (HTML preview, PDF generation)
- Component-based layout system (composable)
- Server-side validation with Zod schemas

**Weaknesses**:
- `DocumentDesigner.tsx` is 1,200+ lines - too much responsibility
- Preview requires explicit action (poor UX feedback loop)
- No state management abstraction (useState soup)
- Undo/redo not implemented (easy to lose work)
- Canvas and form state can desync
- Error states not consistently handled

### Technical Debt Identified

| Issue | Impact | Effort to Fix |
|-------|--------|---------------|
| Monolithic component | Hard to test, hard to extend | Medium |
| No state machine for editor states | Bug-prone transitions | Medium |
| Preview fetches on button click | Latency, poor UX | Low |
| Position updates not batched | Performance on rapid drags | Low |
| No optimistic updates | Feels slow even when it isn't | Medium |

---

## Proposed Architecture

### 1. Component Decomposition

Split `DocumentDesigner.tsx` into focused components:

```
DocumentDesigner/
├── index.tsx                    # Main orchestrator, minimal logic
├── DocumentDesignerContext.tsx  # Shared state via context
├── useDocumentDesigner.ts       # Custom hook for all state management
├── components/
│   ├── Toolbar.tsx              # Top toolbar (save, preview, publish)
│   ├── TemplateList.tsx         # Left sidebar template browser
│   ├── ComponentPalette.tsx     # Component drag palette
│   ├── PropertyPanel.tsx        # Right sidebar properties
│   ├── CanvasEditor.tsx         # Visual canvas mode
│   ├── FormEditor.tsx           # NEW: Simplified form-based mode
│   └── PreviewPanel.tsx         # NEW: Live preview pane
├── hooks/
│   ├── useAutoPreview.ts        # Debounced auto-preview logic
│   ├── useUndoRedo.ts           # History stack management
│   └── useTemplateSync.ts       # Optimistic save with rollback
└── utils/
    └── layoutTransform.ts       # Convert between form/canvas representations
```

### 2. State Management with Reducer

Replace scattered `useState` with a reducer pattern:

```typescript
type EditorState = {
  // Template data
  template: DocumentTemplate | null;
  layout: DocumentComponent[];
  isDirty: boolean;

  // Editor UI state
  mode: 'canvas' | 'form' | 'preview';
  selectedComponentId: string | null;
  zoom: number;
  showGrid: boolean;

  // Async states
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  previewStatus: 'idle' | 'loading' | 'ready' | 'error';
  previewHtml: string;

  // History for undo/redo
  history: DocumentComponent[][];
  historyIndex: number;
};

type EditorAction =
  | { type: 'LOAD_TEMPLATE'; payload: DocumentTemplate }
  | { type: 'UPDATE_COMPONENT'; payload: { id: string; patch: Partial<DocumentComponent> } }
  | { type: 'ADD_COMPONENT'; payload: DocumentComponent }
  | { type: 'REMOVE_COMPONENT'; payload: string }
  | { type: 'MOVE_COMPONENT'; payload: { id: string; position: Position } }
  | { type: 'SET_MODE'; payload: 'canvas' | 'form' | 'preview' }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'SAVE_START' }
  | { type: 'SAVE_SUCCESS'; payload: DocumentTemplate }
  | { type: 'SAVE_ERROR'; payload: string }
  | { type: 'PREVIEW_UPDATE'; payload: string };
```

### 3. Auto-Preview Architecture

Implement preview as a derived state with smart caching:

```typescript
// useAutoPreview.ts
function useAutoPreview(layout: DocumentComponent[], documentType: DocumentType) {
  const [preview, setPreview] = useState<{ html: string; stale: boolean }>({ html: '', stale: true });
  const layoutHash = useRef<string>('');

  // Debounced preview generation
  useEffect(() => {
    const hash = hashLayout(layout);
    if (hash === layoutHash.current) return;

    layoutHash.current = hash;
    setPreview(p => ({ ...p, stale: true }));

    const timer = setTimeout(async () => {
      // Client-side preview for instant feedback (no network)
      const html = renderPreviewClient(layout, getSampleData(documentType));
      setPreview({ html, stale: false });
    }, 300);

    return () => clearTimeout(timer);
  }, [layout, documentType]);

  return preview;
}
```

**Key insight**: Do client-side preview rendering for instant feedback. Server preview only needed for:
- Final PDF generation
- Real data preview (fetches actual order)

### 4. Form Editor Implementation

Create a bidirectional sync between form controls and layout components:

```typescript
// layoutTransform.ts

// Extract form-editable values from layout
function layoutToFormState(layout: DocumentComponent[]): FormState {
  const header = findComponentsByZone(layout, 'header');
  const body = findComponentsByZone(layout, 'body');
  const footer = findComponentsByZone(layout, 'footer');

  return {
    header: {
      showLogo: hasComponent(header, 'image', 'logo'),
      companyName: getTextValue(header, 'company-name'),
      showAddress: hasComponent(header, 'list', 'address'),
    },
    lineItems: {
      columns: getTableColumns(body, 'lines'),
      showHeader: getTableShowHeader(body, 'lines'),
    },
    footer: {
      showTotals: hasComponent(footer, 'list', 'totals'),
      showTerms: hasComponent(footer, 'text', 'terms'),
    },
  };
}

// Apply form changes back to layout
function applyFormToLayout(layout: DocumentComponent[], form: FormState): DocumentComponent[] {
  return layout.map(component => {
    // Update component based on form state
    // Preserve positions and advanced settings
  });
}
```

### 5. Undo/Redo with Immutable History

```typescript
// useUndoRedo.ts
function useUndoRedo<T>(initial: T, maxHistory = 50) {
  const [state, setState] = useState({
    current: initial,
    history: [initial],
    index: 0,
  });

  const push = useCallback((value: T) => {
    setState(s => {
      // Truncate future history if we're not at the end
      const history = s.history.slice(0, s.index + 1);
      const newHistory = [...history, value].slice(-maxHistory);
      return {
        current: value,
        history: newHistory,
        index: newHistory.length - 1,
      };
    });
  }, [maxHistory]);

  const undo = useCallback(() => {
    setState(s => {
      if (s.index <= 0) return s;
      return {
        ...s,
        current: s.history[s.index - 1],
        index: s.index - 1,
      };
    });
  }, []);

  const redo = useCallback(() => {
    setState(s => {
      if (s.index >= s.history.length - 1) return s;
      return {
        ...s,
        current: s.history[s.index + 1],
        index: s.index + 1,
      };
    });
  }, []);

  return { current: state.current, push, undo, redo, canUndo: state.index > 0, canRedo: state.index < state.history.length - 1 };
}
```

---

## Implementation Phases

### Phase 1: Refactor & State Management
**Goal**: Clean architecture foundation before adding features

Tasks:
1. Extract `useDocumentDesigner` hook with reducer
2. Create `DocumentDesignerContext` for shared state
3. Split into component files (Toolbar, TemplateList, PropertyPanel, etc.)
4. Implement undo/redo hook
5. Add keyboard shortcuts (Ctrl+Z, Ctrl+Y, Ctrl+S)
6. Write unit tests for reducer and hooks

**Acceptance Criteria**:
- All existing functionality still works
- Undo/redo works for all layout changes
- Component files are < 300 lines each
- Tests pass for state management logic

**Files Changed**:
- REFACTOR: `DocumentDesigner.tsx` -> split into multiple files
- NEW: `DocumentDesignerContext.tsx`
- NEW: `useDocumentDesigner.ts`
- NEW: `useUndoRedo.ts`
- NEW: `DocumentDesigner/__tests__/`

### Phase 2: Client-Side Live Preview
**Goal**: Instant preview without server round-trips

Tasks:
1. Implement `useAutoPreview` hook with debouncing
2. Create client-side `renderPreviewClient` function
3. Add split-pane layout option (editor | preview)
4. Add "Auto Preview" toggle in toolbar (default: on)
5. Optimize re-renders with `useMemo` and `React.memo`
6. Add preview loading skeleton for perceived performance

**Acceptance Criteria**:
- Preview updates within 300ms of change
- No flicker during rapid edits (debounced)
- Preview is accurate compared to server render
- Performance: < 16ms render time for preview update

**Files Changed**:
- NEW: `useAutoPreview.ts`
- NEW: `renderPreviewClient.ts` (client-safe subset of server render)
- NEW: `PreviewPanel.tsx`
- UPDATE: Toolbar to add split-view toggle

### Phase 3: Form-Based Editor Mode
**Goal**: Simplified editing for non-technical users

Tasks:
1. Design form state schema for each document type
2. Implement `layoutToFormState` / `applyFormToLayout` transforms
3. Create `FormEditor` component with section-based UI
4. Add mode switcher (Canvas | Form | Preview)
5. Ensure form changes sync to canvas and vice versa
6. Create template presets for each document type

**Acceptance Criteria**:
- User can edit template entirely through form UI
- Form changes reflected in canvas when switching modes
- Canvas changes reflected in form when switching modes
- Preset templates load correctly

**Files Changed**:
- NEW: `FormEditor.tsx`
- NEW: `layoutTransform.ts`
- NEW: `presets/invoicePresets.ts` etc.
- UPDATE: Toolbar for mode switcher

### Phase 4: Polish & Error Handling
**Goal**: Production-ready with good error recovery

Tasks:
1. Add optimistic save with rollback on error
2. Improve error messages (user-friendly)
3. Add validation warnings (e.g., missing required fields)
4. Rename "Bindings" to "Data Fields" with descriptions
5. Add tooltips for all form fields
6. Accessibility audit (keyboard nav, screen readers)
7. Performance profiling and optimization

**Acceptance Criteria**:
- Save failures don't lose user work
- All error states have user-friendly messages
- WCAG 2.1 AA compliance
- Lighthouse performance score > 90

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Refactor breaks existing functionality | Medium | High | Comprehensive test coverage before changes |
| Form/canvas sync complexity | Medium | Medium | Clear data flow, extensive edge case testing |
| Client preview differs from server | Low | Medium | Shared rendering logic, visual regression tests |
| Performance regression | Low | Medium | Performance budget, profiling in CI |

---

## Testing Strategy

### Unit Tests
- Reducer: All action types, edge cases
- `layoutToFormState` / `applyFormToLayout`: Round-trip consistency
- `useUndoRedo`: History limits, undo past beginning, etc.

### Integration Tests
- Full editor flow: Load template -> Edit -> Save -> Verify
- Mode switching: Canvas -> Form -> Canvas preserves layout
- Auto-preview: Debounce timing, cancel on new edit

### E2E Tests (Playwright)
- Template editing workflow from user perspective
- Error recovery scenarios
- Keyboard shortcut functionality

---

## Session Estimate

| Phase | Sessions | Risk Buffer |
|-------|----------|-------------|
| Phase 1 (Refactor) | 2-3 | +1 (complex refactor) |
| Phase 2 (Live Preview) | 1-2 | +0.5 |
| Phase 3 (Form Editor) | 2-3 | +1 (sync complexity) |
| Phase 4 (Polish) | 1-2 | +0.5 |
| **Total** | **6-10** | **+3 buffer** |

---

## Handoff Notes for Jimmy

**Recommended Mode**: `thorough` (due to refactoring existing code)

**First Agent**: `feature-builder` for Phase 1, but invoke `verifier` frequently during refactor

**DB Changes**: None - pure frontend refactor

**Key Technical Decisions**:
1. Reducer over useState - easier to test, clearer data flow
2. Client-side preview - eliminates latency for common case
3. Bidirectional form/canvas sync - maintains both UX paradigms
4. Undo stack limit of 50 - prevents memory bloat

**Code Quality Flags**:
- Current `DocumentDesigner.tsx` violates single-responsibility
- Missing error boundaries
- No loading skeletons

**Security Considerations**:
- Client-side preview only uses sample data (no real customer data leak)
- Form inputs must be sanitized before use in templates

**Monitoring Recommendations**:
- Add telemetry for mode usage (canvas vs form)
- Track preview render times
- Track save failure rates

---

## Appendix: Component Dependency Graph

```
DocumentDesigner (orchestrator)
├── DocumentDesignerContext (state provider)
│   └── useDocumentDesigner (reducer + actions)
│       ├── useUndoRedo
│       └── useAutoPreview
├── Toolbar
│   ├── Save/Publish buttons
│   ├── Mode switcher
│   └── View controls (zoom, grid)
├── LeftSidebar
│   ├── TemplateList
│   └── ComponentPalette
├── MainEditor (conditional)
│   ├── CanvasEditor (mode: canvas)
│   │   └── DocumentCanvas (existing)
│   ├── FormEditor (mode: form)
│   │   └── Section components
│   └── PreviewPanel (mode: preview or split)
└── PropertyPanel
    └── Component-specific property forms
```
