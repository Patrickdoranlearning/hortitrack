# HortiTrack Future Feature Roadmap

This document outlines the planned features and ideas for the HortiTrack application, as discussed. The application will be developed using a modular architecture to ensure scalability and maintainability.

## Core Modules

*   **Production Module (Current Focus):** Core functionality for tracking plant batches from propagation to sale-ready status. Includes batch creation, logging, AI recommendations, and protocol generation.
*   **Sales Module:** To be developed. Will handle customer-facing inventory, ordering, and salesperson tools.
*   **Dispatch Module:** To be developed. Will manage preparing and shipping customer orders.
*   **IPM (Integrated Pest Management) / Plant Health Module:** To be developed. Will track pest and disease issues, treatments, and perform advanced health analysis.

---

## Planned Features

## 1. Batch Photos (Production & Sales Module)

A system to attach photos to batches, enhancing visual tracking and sales capabilities.

### Sub-Features:

*   **Dual Photo Types:**
    *   **Grower Photos:** For internal use. A visual log to track the batch's progress, health, and size over its lifecycle. Helps standardize production techniques.
    *   **Sales Photos:** "Glamour shots" of market-ready batches to be used by the sales team and shown to customers in a future portal.
*   **Implementation:**
    *   Add a "Take Photo" option after scanning a batch or from the batch details screen.
    *   Use the device's camera.
    *   Store images securely using a cloud service like Firebase Storage.

### AI Enhancements (IPM / Plant Health Module)

*   **AI-Powered Growth Rate Analysis:**
    *   This feature will be part of the future **IPM / Plant Health Module**.
    *   It will use a multi-modal AI (like Gemini) to compare two "Grower Photos" from different dates.
    *   The AI will analyze and report on changes in size, biomass, and foliage density, providing quantifiable growth data.
    *   Requires consistent photo-taking, potentially using a reference object for scale.

## 2. User Roles, Authentication & Ordering (Sales Module)

Transform the app into a multi-user platform with distinct roles and capabilities.

### Sub-Features:

*   **User Roles:**
    *   **Nursery Operative:** Focused on batch management, logging actions, and completing assigned tasks within the Production Module.
    *   **Sales Person:** Can view inventory, check what's ready for sale, and potentially create quotes or orders in the Sales Module.
        *   **Customer:** A B2B portal for wholesale customers to log in, view available stock, see pricing, and place orders directly in the Sales Module. **They will use the same UI as Sales Persons for creating orders.**
*   **Implementation:**
    *   Use **Firebase Authentication** to manage user accounts, logins, and security.
    *   Build different UI views and dashboards tailored to each user role.
    *   **Note:** Sales Persons and Customers will share the same UI for order creation to reduce program size.

## 3. Product & Alias Management (Sales Module)

A flexible system to manage how inventory is presented and sold to customers, separating internal stock from saleable products.

### Sub-Features:

*   **Product Catalogue:**
    *   Create a customer-facing "Product" (e.g., "1.5L Mixed Colour Heather"). This is the item the customer sees and buys.
    *   Products can have their own descriptions, sales photos, and prices.
*   **Stock Linking:**
    *   Link one or more production `Batches` to a single `Product`.
    *   The system will automatically calculate the total available quantity for a product by summing the stock of all linked batches.
    *   This allows selling multiple different batches (e.g., *Erica 'Kramer's Red'* and *Erica 'White Perfection'*) under a single product listing.
*   **Implementation:**
    *   Create a new "Products" data table in Firestore.
    *   Build an interface in the Sales Module to create/edit products and link/unlink batches to them.

## 4. Task Management System (Production Module)

An active, operational tool to assign and track nursery tasks.

### Sub-Features:

*   **Digital "Job Board":**
    *   Create tasks with a title, assignee, associated batch, due date, and priority.
    *   Operatives get a personalized "My Tasks" dashboard upon login.
    *   Managers get a comprehensive view to track all tasks and overall progress.
*   **Implementation:**
    *   Build on top of the User Roles feature.
    *   Use a real-time database like **Firestore** to store and sync tasks across devices instantly.

### AI Enhancements:

*   **AI-Assisted Task Creation:**
    *   Add a "Create Tasks" button to the AI Care Recommendations feature. The AI's suggestions (e.g., "Watering needed") can be converted directly into assignable tasks.
    *   AI could help prioritize tasks based on external data like weather forecasts.

## 5. Label Printing (Production/Dispatch Module)

Bridge the gap between digital data and physical inventory by printing labels directly from the application.

### Sub-Features:

*   **Print-Ready PDF Generation:**
    *   Create a feature to generate a standardized, print-ready PDF for a selected batch.
    *   The label would include the batch number, plant name, a scannable barcode/QR code, and other key details.
*   **Direct Printer Integration:**
    *   Investigate direct printing to specific hardware (e.g., Toshiba B-EXT1) for a more seamless workflow, potentially via a browser extension or a small network service.
