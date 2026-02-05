# Document Designer Refresh - Implementation Plan
## Synthesized from Dual-Plan Analysis

**Created**: 2026-02-04
**Completed**: 2026-02-04
**Status**: Complete (All Phases Done)
**Synthesized From**:
- Plan A: Administrative Director (ease of use, simplicity, clarity)
- Plan B: Senior Software Engineer (architecture, maintainability)

---

## Dual-Plan Evaluation Summary

### Perspectives Explored

| Plan | Perspective | Focus |
|------|-------------|-------|
| A | Administrative Director | Instant preview, form-based editing, fewer options |
| B | Senior Software Engineer | Clean architecture, state management, testability |

### Comparison Matrix

| Criterion | Plan A | Plan B | Winner |
|-----------|--------|--------|--------|
| User Impact | High (immediate UX wins) | Medium (foundation for UX) | A |
| Code Quality | Low (feature-first) | High (refactor-first) | B |
| Time to Value | Fast (4-6 sessions) | Slower (6-10 sessions) | A |
| Maintainability | Medium (adds to existing) | High (cleans up existing) | B |
| Risk | Low (additive changes) | Medium (refactoring risk) | A |
| Testing | Light | Comprehensive | B |

### Key Differences

| Aspect | Plan A | Plan B |
|--------|--------|--------|
| Approach | Add features to existing code | Refactor then add features |
| Preview | Add split-pane to existing | Client-side rendering engine |
| Form Editor | Simple form alongside canvas | Bidirectional sync system |
| Undo/Redo | "Nice to have" | Core infrastructure |
| Sessions | 4-6 | 6-10 |

---

## Synthesis Decision: Hybrid Approach

**Taking from Plan A** (user-focused):
- Split-screen live preview as Phase 1 (highest impact)
- Form-based simplified editor concept
- Preset templates for quick starts
- Rename "Bindings" to "Data Fields"
- Focus on time-to-value

**Taking from Plan B** (engineering-focused):
- Extract state into `useDocumentDesigner` hook (Phase 1 prep)
- Implement undo/redo properly (not optional)
- Client-side preview rendering (for performance)
- Component decomposition (but lighter touch)
- Test coverage for new code

**Not doing (from either plan)**:
- Full refactor of existing `DocumentDesigner.tsx` upfront (too risky)
- Complex bidirectional sync (overkill for initial version)
- Optimistic saves with rollback (nice but not essential)

---

## Final Implementation Plan

### Phase 1: Live Preview & Quick Wins
**Goal**: Immediate UX improvement - see changes as you make them
**Sessions**: 2

**Tasks**:
1. Add auto-preview mode with split-pane layout
   - New `PreviewPanel.tsx` component
   - Split view: editor (60%) | preview (40%)
   - Toggle in toolbar (default: on)
   - Debounced updates (300ms)

2. Implement client-side preview rendering
   - New `renderPreviewClient.ts` (subset of server renderer)
   - Uses sample data for instant feedback
   - Falls back to server for "Preview with Real Data"

3. Implement undo/redo
   - New `useUndoRedo.ts` hook
   - Keyboard shortcuts: Ctrl+Z, Ctrl+Y
   - Visual indicators (undo/redo buttons disabled state)

4. Quick terminology fixes
   - Rename "Bindings" section to "Data Fields"
   - Add descriptions to each data field
   - Tooltips on confusing controls

**Acceptance Criteria**:
- [x] Preview updates within 500ms of any change
- [x] User can undo/redo all layout changes
- [x] "Data Fields" section is understandable without documentation
- [x] Existing functionality unchanged

**Files to Create/Modify**:
```
src/components/documents/
├── DocumentDesigner.tsx          # MODIFY: Add split-pane, undo/redo
├── PreviewPanel.tsx              # NEW: Live preview component
├── hooks/
│   ├── useAutoPreview.ts         # NEW: Debounced preview logic
│   └── useUndoRedo.ts            # NEW: History management
└── utils/
    └── renderPreviewClient.ts    # NEW: Client-side preview render
```

### Phase 2: Simplified Form Editor
**Goal**: Non-technical users can edit without the canvas
**Sessions**: 2-3

**Tasks**:
1. Create `FormEditor.tsx` component
   - Section-based UI (Header, Content, Footer)
   - Toggle switches for show/hide elements
   - Dropdown for field selection
   - Works alongside canvas (not replacement)

2. Implement layout transforms
   - `layoutToFormState`: Extract editable values
   - `formStateToLayout`: Apply changes back
   - One-directional initially (form writes to layout, not reverse)

3. Add template presets
   - "Classic Invoice" preset
   - "Simple Docket" preset
   - "Minimal" preset for each document type
   - Preset picker when creating new template

4. Mode switcher in toolbar
   - Three modes: Visual | Simple | Preview
   - Visual = existing canvas
   - Simple = new form editor
   - Preview = full-screen preview

**Acceptance Criteria**:
- [x] User can create and edit template without touching canvas
- [x] All common fields editable through form interface
- [x] Preset templates load correctly
- [x] Mode switching preserves unsaved changes

**Files to Create/Modify**:
```
src/components/documents/
├── DocumentDesigner.tsx          # MODIFY: Add mode switcher
├── FormEditor.tsx                # NEW: Simplified form editor
├── components/
│   ├── FormEditorHeader.tsx      # NEW: Header section form
│   ├── FormEditorContent.tsx     # NEW: Content/table section form
│   └── FormEditorFooter.tsx      # NEW: Footer section form
└── utils/
    ├── layoutTransform.ts        # NEW: Form <-> layout conversion
    └── templatePresets.ts        # NEW: Preset definitions
```

### Phase 3: Polish & Refinement
**Goal**: Production-ready, accessible, delightful
**Sessions**: 1-2

**Tasks**:
1. Template list improvements
   - Larger template cards with thumbnails
   - Search/filter functionality
   - Recently used at top

2. Error handling improvements
   - Save failure recovery (don't lose work)
   - Validation warnings in form editor
   - Helpful error messages

3. Accessibility pass
   - Keyboard navigation throughout
   - Focus management on mode switch
   - Screen reader labels

4. Performance optimization
   - Memoize expensive renders
   - Lazy load preview panel
   - Profile and fix bottlenecks

**Acceptance Criteria**:
- [x] Template search finds templates by name
- [x] Save failures don't lose user work
- [x] Keyboard-only navigation possible
- [x] No jank during rapid editing

---

## Architecture Overview

```
DocumentDesigner (main component)
│
├── State Management
│   ├── useDocumentDesigner (layout, template, UI state)
│   ├── useUndoRedo (history stack)
│   └── useAutoPreview (debounced preview)
│
├── Toolbar
│   ├── Template name/type
│   ├── Mode switcher (Visual | Simple | Preview)
│   ├── Undo/Redo buttons
│   ├── Save/Publish buttons
│   └── View controls (zoom, grid) - Visual mode only
│
├── Left Sidebar
│   ├── Templates tab (existing)
│   └── Components tab (existing, Visual mode only)
│
├── Main Area (based on mode)
│   ├── Visual Mode: DocumentCanvas (existing)
│   ├── Simple Mode: FormEditor (new)
│   └── Preview Mode: PreviewPanel (new, full width)
│
├── Right Sidebar
│   ├── Visual Mode: PropertyPanel (existing)
│   ├── Simple Mode: Hidden or tips
│   └── Preview Mode: Hidden
│
└── Split Pane (when auto-preview on)
    └── PreviewPanel (40% width on right)
```

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Breaking existing functionality | Phase 1 is additive, test thoroughly |
| Form editor doesn't cover all cases | Keep canvas as fallback, document limitations |
| Performance issues with live preview | Client-side render, debounce, memoize |
| User confusion with two editors | Clear mode labels, remember user preference |

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Time to see a change | ~45s | <3s |
| Template customization rate | Low | +50% |
| Support requests about templates | High | -50% |
| User satisfaction (qualitative) | "Confusing" | "Easy" |

---

## Session Estimate

| Phase | Sessions |
|-------|----------|
| Phase 1: Live Preview & Undo | 2 |
| Phase 2: Form Editor | 2-3 |
| Phase 3: Polish | 1-2 |
| **Total** | **5-7 sessions** |

---

## Handoff Notes for Jimmy

**Recommended Mode**: `standard`

**First Agent**: `feature-builder`

**Pipeline**: Feature Flow (no DB changes)
```
feature-builder (Phase 1)
       ↓
   verifier
       ↓
  tester-tim (validate preview works)
       ↓
task-completion-validator
```

**DB Changes**: None - pure frontend

**Critical Files**:
- `/src/components/documents/DocumentDesigner.tsx` - main component (1,240 lines)
- `/src/components/documents/DocumentCanvas.tsx` - visual editor
- `/src/lib/documents/types.ts` - type definitions
- `/src/server/documents/render.ts` - server-side rendering (reference for client)

**Testing Focus**:
- Auto-preview updates correctly and quickly
- Undo/redo works for all change types
- Form editor produces valid layouts
- Existing canvas mode unaffected

**Dependencies**:
- No new packages required
- Uses existing Tailwind, shadcn/ui components

---

## Archived Plans

The original dual-plan documents are preserved for reference:
- `.claude/plans/PLAN-document-designer-refresh-A.md` (Admin Director perspective)
- `.claude/plans/PLAN-document-designer-refresh-B.md` (Engineer perspective)
