# HortiTrack Production Module: Deployment Plan

This document outlines the necessary steps to prepare the HortiTrack Production Module for a live production environment. The goal is to ensure the application is secure, functionally complete for core nursery operations, and ready for your team to use.

---

## Phase 1: Foundational Security & Core Features (Current Focus)

This phase focuses on non-negotiable prerequisites for going live.

### 1. Implement User Authentication & Security Rules

*   **Status:** Not Started
*   **Priority:** **Critical**
*   **Objective:** Secure the application and its data. Currently, the database is open to anyone with the configuration details. This step is essential before any live data is entered.
*   **Action Items:**
    *   Integrate **Firebase Authentication** to add a user login system (email/password).
    *   Create a simple "Sign In" page.
    *   Implement **Firestore Security Rules** to restrict database access. Only authenticated users from your nursery will be able to read or write batch data.
    *   Protect all pages, redirecting unauthenticated users to the sign-in page.

### 2. Complete Core Production Feature: Batch Photos

*   **Status:** Not Started
*   **Priority:** High
*   **Objective:** Enhance batch tracking with visual records, as outlined in the initial project plan. This is a key feature for both internal tracking and future sales enablement.
*   **Action Items:**
    *   Update the `Batch` data structure in Firestore to include fields for `growerPhotoUrl` and `salesPhotoUrl`.
    *   Modify the **New/Edit Batch Form** to include input fields for these photo URLs.
    *   Display the attached photos on the **Batch Card**. We will use placeholder images initially if no URL is provided.

### 3. Implement Label Printing

*   **Status:** Not Started
*   **Priority:** Medium
*   **Objective:** Bridge the gap between the digital record and the physical plant batch by allowing staff to print standardized labels.
*   **Action Items:**
    *   Create a new function that generates a print-friendly HTML view for a specific batch.
    *   This view will include the batch number, plant name, and a scannable QR code representing the batch number.
    *   Add a "Print Label" button to the `BatchCard` component.

---

## Phase 2: Data & Deployment Readiness

This phase focuses on final checks and the go-live process itself.

### 4. Finalize "Golden Table" Data

*   **Status:** In Progress
*   **Priority:** Medium
*   **Objective:** Ensure all standardized data lists are accurate and complete before the team starts using the app.
*   **Action Items:**
    *   **YOU (Nursery Manager):** Review and finalize the lists on the "Manage Data" pages:
        *   `Plant Varieties`
        *   `Nursery Locations`
        *   `Plant Sizes`
    *   This ensures consistency and prevents data entry errors.

### 5. Deploy to Production

*   **Status:** Not Started
*   **Priority:** High (Final Step)
*   **Objective:** Make the application live and accessible to your team over the internet.
*   **Action Items:**
    *   **ME (AI Assistant):** Prepare the application for deployment by creating a production build.
    *   **YOU (Nursery Manager):** Run a single command to deploy the application to **Firebase App Hosting**. I will provide the exact command when we reach this step.

---

This plan provides a clear roadmap. Our immediate next step is **User Authentication**.