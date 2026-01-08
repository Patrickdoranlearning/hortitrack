# HortiTrack Feature Roadmap

This document outlines the planned features and architecture for HortiTrack.

---

## Core Modules

| Module | Status | Description |
|--------|--------|-------------|
| **Production** | ✅ Active | Core functionality for tracking plant batches from propagation to sale-ready status |
| **Sales** | ✅ Active | Internal module for sales staff - inventory, ordering, customer management |
| **B2B Portal** | ✅ Active | External portal for wholesale customers to view stock and place orders |
| **Dispatch** | ✅ Active | Order fulfillment - picking, packing, delivery runs |
| **Plant Health/IPM** | ✅ Active | Pest/disease tracking, treatments, scouting, compliance |
| **Tasks** | ✅ Active | Digital job board for nursery operations |
| **Materials** | ✅ Active | Stock tracking, purchase orders, consumption |

---

## Feature Roadmap

### 1. Batch Photos (Production & Sales)

A system to attach photos to batches for visual tracking and sales.

**Status**: ✅ Implemented

**Features**:
- **Grower Photos**: Internal visual log for batch progress, health, and size
- **Sales Photos**: "Glamour shots" for sales team and B2B portal
- Photo upload from device camera
- Cloud storage via Supabase Storage

**Future AI Enhancement (IPM Module)**:
- AI-powered growth rate analysis using multi-modal AI (Gemini Vision)
- Compare photos from different dates to measure growth
- Analyze size, biomass, and foliage density changes

---

### 2. User Roles & Authentication

Multi-user platform with distinct roles and capabilities.

**Status**: ✅ Implemented

**User Roles**:
| Role | Access |
|------|--------|
| **Owner** | Full admin access |
| **Admin** | Organization management |
| **Grower** | Production module, batch management |
| **Sales** | Sales module, customer management |
| **Viewer** | Read-only access |

**Implementation**:
- Supabase Authentication for login/sessions
- Row-Level Security (RLS) for data isolation
- Role-based access control (RBAC)

---

### 3. Product & Alias Management

Flexible system for managing how inventory is presented to customers.

**Status**: 🚧 In Progress

**Features**:
- **Product Catalogue**: Customer-facing products (e.g., "1.5L Mixed Colour Heather")
- **Stock Linking**: Link multiple batches to a single product
- **Product Aliases**: Customer-specific naming and pricing
- Automatic available quantity calculation

See: [features/product-aliases.md](./features/product-aliases.md)

---

### 4. Task Management System

Active operational tool to assign and track nursery tasks.

**Status**: ✅ Implemented

**Features**:
- Task creation with title, assignee, batch, due date, priority
- "My Tasks" dashboard for operatives
- Manager view for overall progress
- Real-time sync across devices

**Future AI Enhancement**:
- "Create Tasks" button from AI Care Recommendations
- AI-prioritized tasks based on weather forecasts

---

### 5. Label Printing

Print labels directly from the application.

**Status**: ✅ Implemented

**Features**:
- Print-ready PDF generation
- Batch number, plant name, QR codes
- Sale labels with customer information
- Trolley labels for dispatch
- Location labels

**Future Enhancement**:
- Direct printer integration (Toshiba B-EXT1, etc.)

---

### 6. Production Recipes

Reusable templates for growing timelines and conditions.

**Status**: 🚧 Phase 2 In Progress

**Current Features**:
- Recipe library and editor
- Stage builder with duration and environmental targets
- Planning integration

**Planned Features**:
- Size flow builder (container progression)
- Week range planning
- Performance tracking
- Sales integration

See: [features/recipes.md](./features/recipes.md)

---

### 7. AI Features

AI-powered assistance for nursery operations.

**Status**: ⏸️ Built but Disabled

**Implemented Flows**:
- **Batch Chat**: Q&A about specific batches
- **Care Recommendations**: Weather-aware plant care suggestions
- **Production Protocols**: Generate growing guides from successful batches

**Model**: Gemini 2.0 Flash

**Enabling**: Set `aiCare: true` in `src/config/features.ts`

---

## Technical Architecture

### Stack
- **Frontend**: Next.js 15, React 18, TypeScript
- **Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth with RLS
- **Storage**: Supabase Storage
- **AI**: Google Genkit with Gemini
- **Hosting**: Vercel

### Multi-Tenancy
- Organization-based data isolation
- RLS policies on all tables
- User can belong to multiple organizations

---

## Style Guidelines

| Element | Value |
|---------|-------|
| Primary Color | Fresh green (#6AB04A) |
| Background | Light green (#E5E8E3) |
| Accent | Earthy brown (#A07A5F) |
| Body Font | PT Sans (sans-serif) |
| Header Font | Playfair (serif) |

**UI Principles**:
- Clean, intuitive layout
- Clear hierarchy
- Line-based icons
- Subtle transitions and animations

---

## Next Steps

1. **Enable AI Features**: Test with power users, add response caching
2. **Recipe Phase 2**: Size flow builder and week planning
3. **Performance Tracking**: Capture recipe execution metrics
4. **Weather Integration**: Real weather API for care recommendations
5. **Dashboard Improvements**: Key metrics and alerts

---

**Last Updated**: January 2026

