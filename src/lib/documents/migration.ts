import type {
  TemplateLayout,
  DocumentLayout,
  DocumentComponent,
  DocumentZone,
  ZoneConfig,
} from "./types";
import { isDocumentLayout } from "./types";

// A4 page size in mm
const A4 = { width: 210, height: 297 };

// Default zone configuration
const DEFAULT_ZONES: ZoneConfig[] = [
  { zone: "header", height: 35, layoutMode: "absolute" },
  { zone: "body", height: 227, layoutMode: "flow" },
  { zone: "footer", height: 20, layoutMode: "absolute" },
];

// Default margins in mm
const DEFAULT_MARGINS = { top: 15, right: 15, bottom: 15, left: 15 };

/**
 * Migrate a legacy array-based layout to the new DocumentLayout format.
 * Assigns components to zones based on their vertical position if they have one,
 * otherwise places them in the body zone.
 */
export function migrateToDocumentLayout(layout: TemplateLayout): DocumentLayout {
  // If already new format, return as-is
  if (isDocumentLayout(layout)) {
    return layout;
  }

  // Convert legacy array to new format
  const components: DocumentComponent[] = layout.map((c, index) => {
    // If component already has position, use it to determine zone
    const pos = c.style?.position;
    let zone: DocumentZone = c.zone || "body";

    if (pos && typeof pos.y === "number") {
      const headerHeight = DEFAULT_ZONES[0].height;
      const footerStart = A4.height - DEFAULT_ZONES[2].height;

      if (pos.y < headerHeight) {
        zone = "header";
      } else if (pos.y >= footerStart) {
        zone = "footer";
      } else {
        zone = "body";
      }
    }

    return {
      ...c,
      zone,
    };
  });

  return {
    pageSize: A4,
    margins: DEFAULT_MARGINS,
    zones: DEFAULT_ZONES,
    components,
  };
}

/**
 * Extract just the components array from any layout format.
 * Use this when you only need the components without the full layout metadata.
 */
export function extractComponents(layout: TemplateLayout): DocumentComponent[] {
  if (isDocumentLayout(layout)) {
    return layout.components;
  }
  return layout;
}

/**
 * Create a new empty DocumentLayout with default settings
 */
export function createEmptyLayout(): DocumentLayout {
  return {
    pageSize: A4,
    margins: DEFAULT_MARGINS,
    zones: [...DEFAULT_ZONES],
    components: [],
  };
}

/**
 * Add a component to a layout with automatic position assignment
 */
export function addComponentToLayout(
  layout: DocumentLayout,
  component: Omit<DocumentComponent, "style"> & { style?: DocumentComponent["style"] },
  zone: DocumentZone = "body"
): DocumentLayout {
  // Calculate default Y position based on zone and existing components
  const zoneComponents = layout.components.filter((c) => c.zone === zone);
  const headerHeight = layout.zones.find((z) => z.zone === "header")?.height ?? 35;
  const footerHeight = layout.zones.find((z) => z.zone === "footer")?.height ?? 20;

  let defaultY = layout.margins.top;
  if (zone === "body") {
    defaultY = headerHeight + 5 + zoneComponents.length * 15;
  } else if (zone === "footer") {
    defaultY = A4.height - footerHeight + 5 + zoneComponents.length * 10;
  } else {
    defaultY = layout.margins.top + zoneComponents.length * 12;
  }

  const newComponent: DocumentComponent = {
    ...component,
    zone,
    style: {
      ...component.style,
      position: component.style?.position ?? {
        x: layout.margins.left,
        y: defaultY,
        width: A4.width - layout.margins.left - layout.margins.right,
        height: 12,
      },
    },
  } as DocumentComponent;

  return {
    ...layout,
    components: [...layout.components, newComponent],
  };
}
