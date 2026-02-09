# Plan B: Picking Redesign — Nursery Operative Perspective

> Focus: Speed, simplicity, one-hand operation, works in polytunnel with dirty hands and sun glare

## The Operative's Reality

- Standing in a polytunnel, phone in one hand, trolley handle in the other
- Gloves on half the time, screen might be wet
- Wants to pick the order and move on — not navigate a UI
- Scanning datamatrix labels is the fastest input method
- Typing batch numbers is the fallback for when labels are damaged
- **Never** wants to think about "multi-batch" vs "single-batch" — just "pick stuff"

## What's Wrong Today

1. **Too many buttons**: Scan, Keyboard, Layers, Checkmark, Substitute, Short — 6 decisions per item
2. **Multi-batch is hidden**: The Layers icon means nothing to an operative
3. **Batch selection dialog is overwhelming**: 4 tabs (Available, Scan, Type, Search), shelf quantity buttons, custom quantity input — it's a spreadsheet not a picking flow
4. **Nothing works**: The actual save fails with a database error, so the operative taps "Pick" and nothing happens
5. **No confirmation feedback**: When you scan, there's no clear "good, next" moment

## The Ideal Flow (As Simple As Possible)

### Per-Item Flow
```
1. Item card shows: "1.5L Heather × 100"
2. Operative taps card → Pick mode opens
3. BIG scan area at top (camera viewfinder)
4. Operative scans a batch label → BEEP ✓
5. Screen shows: "Batch 3-2548-00003 — 70 available — How many?"
6. Number input pre-filled with min(remaining, available) = 70
7. Operative taps "Confirm 70" → vibrate ✓
8. Screen shows: "70/100 picked — Scan next batch"
9. Operative scans another batch → same flow
10. When 100/100: "Done! ✓" auto-closes, card turns green
```

### Search Fallback
```
1. If label is damaged/missing, operative taps "Search" tab
2. Types part of batch number → sees matches
3. Taps a match → same quantity confirm flow
```

### Short / Substitute
```
- "Short" button always visible at bottom (red)
- Substitute is a secondary action (not primary — operatives rarely use it)
```

## Design Principles

1. **ONE primary action**: Scan. Everything else is a fallback.
2. **ONE confirmation per batch**: Scan → quantity → confirm. Three taps max.
3. **BIG touch targets**: Minimum 48px, ideally 56px. Dirty gloves need big buttons.
4. **Progress always visible**: "70/100 picked" must be on screen at all times.
5. **Auto-advance**: When item is complete, auto-show next pending item.
6. **No jargon**: "Pick" not "Multi-batch". "How many?" not "Select quantity".

## Proposed UI Layout

### Item Card (Collapsed)
```
┌─────────────────────────────────────┐
│ 1.5L Heather                  ×100  │
│ 1.5 Litre • Tunnel 2               │
│ [████████░░░░░░░░░░░░] 0/100       │
│                                     │
│     [ TAP TO PICK ]                 │
└─────────────────────────────────────┘
```

### Pick Mode (Expanded/Sheet)
```
┌─────────────────────────────────────┐
│ 1.5L Heather          0/100 needed  │
│ [████████████████████] 0% ─────────│
│                                     │
│ ┌─[ Pick ]──────[ Search ]────────┐ │
│ │                                 │ │
│ │  ┌─────────────────────────┐   │ │
│ │  │                         │   │ │
│ │  │    📷 Camera Scanner    │   │ │
│ │  │    Point at batch label │   │ │
│ │  │                         │   │ │
│ │  └─────────────────────────┘   │ │
│ │                                 │ │
│ │  ── or tap a batch below ──    │ │
│ │                                 │ │
│ │  ┌ 3-2548-00003  70 avail ──┐  │ │
│ │  │ Tunnel 2 • Looking Good  │  │ │
│ │  └──────────────────────────┘  │ │
│ │                                 │ │
│ │  ┌ 3-2550-00004  1999 avail ┐  │ │
│ │  │ Section 2 • Looking Good │  │ │
│ │  └──────────────────────────┘  │ │
│ └─────────────────────────────────┘ │
│                                     │
│  Already picked: (none yet)         │
│                                     │
│  [ Mark Short ]        [ Done 0 ]   │
└─────────────────────────────────────┘
```

### After Scanning / Tapping a Batch
```
┌─────────────────────────────────────┐
│ ✓ Batch 3-2548-00003               │
│ 70 available • Tunnel 2             │
│                                     │
│ How many?                           │
│                                     │
│    [ - ]    ┌─────┐    [ + ]        │
│             │  70 │                 │
│             └─────┘                 │
│                                     │
│  [ Cancel ]    [ ✓ Confirm 70 ]     │
└─────────────────────────────────────┘
```

### After Confirming (Back to Pick Mode)
```
│ 1.5L Heather         70/100 needed  │
│ [████████████████░░░░] 70% ────────│
│                                     │
│  📷 Scan next batch                 │
│  (30 remaining)                     │
│                                     │
│  Already picked:                    │
│  • 3-2548-00003: 70 ✓              │
│                                     │
│  [ Mark Short ]     [ ✓ Done 70 ]   │
```

## Key Differences from Plan A

| Aspect | Plan A (Engineer) | Plan B (Operative) |
|--------|------------------|--------------------|
| Primary action | Refactored component | BIG scan area |
| Batch list | Below scanner | Below scanner (same) |
| Quantity input | Inline in batch card | Full-width confirmation overlay |
| Progress | Progress bar | Progress bar + "X remaining" text |
| Short/Substitute | More menu | Short = always visible, Substitute = buried |
| Auto-advance | Mentioned | Required |
| Touch targets | Standard 40px | Minimum 48px, confirm buttons 56px |
| Shelf qty buttons | Removed | Removed (just +/- and number input) |

## Non-Negotiables for Operative UX
1. Camera scanner MUST work on first tap — no permissions dance every time
2. Quantity pre-filled to sensible default (min of remaining and available)
3. Haptic feedback on every scan (success = short buzz, error = long buzz)
4. Progress visible at ALL times
5. "Short" always one tap away
6. Works offline-ish (queue picks if network drops, sync when back) — FUTURE
