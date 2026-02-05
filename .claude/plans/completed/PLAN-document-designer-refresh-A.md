# Plan A: Document Designer Refresh
## Perspective: Administrative Director (Ease of Use, Simplicity, Clarity)

**Created**: 2026-02-04
**Status**: Draft
**Perspective Priority**: Make it dead simple. If I can't figure it out in 30 seconds, it's too complicated.

---

## Executive Summary

The current Document Designer is built for developers, not for me. I need to tweak invoice templates and delivery dockets without learning a programming interface. Give me:
1. **Instant preview** - I want to see what I'm changing as I change it
2. **Clear, labeled controls** - No "bindings" or "zones" jargon
3. **Fewer options, better defaults** - Don't give me 50 settings when 5 will do

---

## Current Pain Points (From My Perspective)

| Issue | Why It's Frustrating |
|-------|---------------------|
| Preview is a button I have to click | I make a change, then have to save and click Preview to see it. Slow. |
| "Bindings" panel is confusing | What's a "binding"? I just want to put the customer name here. |
| Too many component types | I don't need 8 different widget types. I need text, tables, and maybe a line. |
| Position controls are in millimeters | I don't think in millimeters. I think "move it up a bit" |
| Zones (header/body/footer) unclear | Why is my heading in the "body" zone? What does that even mean? |
| No undo | I deleted something and now I have to start over |
| Template list is cramped | Hard to find the template I want |

---

## Proposed Solution: Simplified Designer Mode

### Key Changes

#### 1. Live Preview (Always On)
**Replace the current editor/preview toggle with split-screen view**

- Left side: Simple form-based editor
- Right side: Live preview that updates as you type
- No "Preview" button needed - it's always showing

```
+---------------------------+---------------------------+
|   EDIT TEMPLATE           |   LIVE PREVIEW            |
|                           |                           |
|   Template Name: [____]   |   +-------------------+   |
|   Document Type: Invoice  |   |   INVOICE         |   |
|                           |   |   INV-1045        |   |
|   --- HEADER ---          |   |   Greenleaf...    |   |
|   Company Name: [Doran N] |   |                   |   |
|   Show Logo: [x]          |   |   Item   Qty  $   |   |
|                           |   |   ...            |   |
|   --- CONTENT ---         |   +-------------------+   |
|   [Simplified controls]   |                           |
+---------------------------+---------------------------+
```

#### 2. Form-Based Editing (Not Canvas Drag)
**Replace the canvas with a structured form**

Instead of:
- Dragging components on a canvas
- Setting X/Y positions
- Managing "zones"

Use:
- Simple form sections (Header, Line Items, Footer)
- Toggle switches for what to show/hide
- Dropdown menus for field selection

Example simplified interface:
```
HEADER SECTION
  [ ] Show company logo
  [x] Show company name
  Company Name: [Use default] [Custom: ______]

  [ ] Show customer address block

LINE ITEMS TABLE
  Columns to show:
  [x] Description
  [x] Quantity
  [x] Unit Price
  [x] Line Total
  [ ] SKU
  [ ] Location

FOOTER SECTION
  [x] Show totals
  [x] Show payment terms
  Payment terms: [Net 30 ▼]
```

#### 3. Quick Toggle Preview Mode
**For users who want to test with real data**

- Button: "Preview with Real Order"
- Opens dropdown of recent orders/invoices
- Shows exactly what the printed document would look like
- Can print/PDF directly from preview

#### 4. Template Presets
**Start from something that works**

- "Classic Invoice" - clean, professional
- "Simple Docket" - minimal, fast to print
- "Detailed Invoice" - shows all fields

User picks a preset, then just adjusts what they need.

---

## Implementation Phases

### Phase 1: Split-Screen Live Preview (High Impact, Low Effort)
**Goal**: See changes instantly without clicking Preview

Tasks:
1. Add auto-preview toggle to toolbar (default: ON)
2. When auto-preview is on, render preview in right panel
3. Debounce updates (300ms delay after typing stops)
4. Preview uses sample data by default
5. Add "Preview with Real Data" dropdown

**Definition of Done**:
- User types in any text field, preview updates within 500ms
- No need to save before previewing
- Toggle to disable auto-preview if performance is an issue

### Phase 2: Simplified Form Mode (Medium Effort)
**Goal**: Edit templates without the complex canvas

Tasks:
1. Create new "Simple Editor" tab alongside "Visual Editor"
2. Simple Editor shows form-based controls organized by section
3. Each section has show/hide toggles and simple settings
4. Changes in Simple Editor sync to underlying layout
5. Add preset templates users can start from

**Definition of Done**:
- User can edit template without touching the canvas
- All common customizations available through forms
- Preset templates available for each document type

### Phase 3: Better Defaults & Polish (Low Effort)
**Goal**: The obvious thing should be obvious

Tasks:
1. Rename "Bindings" to "Data Fields" with descriptions
2. Add tooltips explaining what each field does
3. Make template list easier to browse (bigger cards, search)
4. Add undo/redo (Ctrl+Z, Ctrl+Y)
5. Simplify zone labels (remove if possible)

**Definition of Done**:
- Non-technical user can customize a template without documentation
- Undo works for all changes
- Finding templates takes < 5 seconds

---

## What We're NOT Doing (Explicitly)

- Not removing the advanced canvas editor (keep for power users)
- Not changing the underlying data model (backward compatible)
- Not adding new component types
- Not building a full page builder

---

## Success Metrics

| Metric | Current State | Target |
|--------|---------------|--------|
| Time to make a text change | ~45 seconds (edit, save, preview) | ~3 seconds (type, see) |
| Support tickets about templates | Unknown, but high | Reduce by 50% |
| Template customization adoption | Low (people use defaults) | Increase active customization |

---

## Session Estimate

| Phase | Sessions |
|-------|----------|
| Phase 1 (Live Preview) | 1-2 |
| Phase 2 (Form Editor) | 2-3 |
| Phase 3 (Polish) | 1 |
| **Total** | **4-6 sessions** |

---

## Handoff Notes for Jimmy

**Recommended Mode**: `standard`

**First Agent**: `feature-builder` for Phase 1 live preview

**DB Changes**: None required - this is all UI

**Key Files**:
- `/src/components/documents/DocumentDesigner.tsx` - main component to modify
- `/src/components/documents/DocumentCanvas.tsx` - keep as "advanced mode"
- NEW: `/src/components/documents/SimpleDocumentEditor.tsx` - form-based editor

**Risk**: Medium - changes to existing workflow, but additive (not destructive)

**Test Focus**:
- Auto-preview performance with complex templates
- Simple editor produces valid layouts
- Existing canvas mode still works

---

## Appendix: User Quotes (Why This Matters)

> "I just want to add our new phone number to the invoice. Why do I need to drag something?"

> "What's a binding? I clicked on Available Bindings and I don't understand any of it."

> "I made changes but I can't tell if they're saved or not."

> "Can you just do it for me? I don't have time to learn this."
