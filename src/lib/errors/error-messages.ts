/**
 * Domain-specific error messages for the horticultural app
 * Maps technical errors to user-friendly descriptions
 */

export const errorMessages = {
  // Batch operations
  batch: {
    notFound: 'Batch not found. It may have been archived or deleted.',
    alreadyExists: 'A batch with this number already exists.',
    invalidQuantity: 'Please enter a valid quantity.',
    cannotDelete: 'This batch has linked records and cannot be deleted.',
    cannotModify: 'This batch cannot be modified in its current state.',
    insufficientQuantity: 'Not enough plants available in this batch.',
    saveFailed: 'Could not save batch. Please try again.',
  },

  // Sales operations
  sales: {
    orderNotFound: 'Order not found.',
    insufficientStock: 'Not enough stock available for this order.',
    customerNotFound: 'Customer account not found.',
    priceListNotFound: 'No price list available for this customer.',
    orderClosed: 'This order is closed and cannot be modified.',
    cannotDelete: 'This order has been processed and cannot be deleted.',
    invoiceFailed: 'Could not generate invoice. Please try again.',
    pickListFailed: 'Could not generate pick list. Please try again.',
  },

  // Dispatch operations
  dispatch: {
    loadNotFound: 'Delivery load not found.',
    cannotDispatch: 'Cannot dispatch - some orders are blocked.',
    trolleyOccupied: 'This trolley position is already occupied.',
    pickListNotFound: 'Pick list not found for this order.',
    driverNotAssigned: 'No driver assigned to this load.',
    routeNotSet: 'Delivery route has not been set.',
    alreadyDispatched: 'This load has already been dispatched.',
  },

  // Plant health / IPM
  plantHealth: {
    programNotFound: 'Treatment program not found.',
    trialNotFound: 'Trial not found.',
    taskNotFound: 'Task not found.',
    productNotFound: 'Product not found in inventory.',
    bottleEmpty: 'This bottle is empty. Please select another.',
    applicationFailed: 'Could not record application. Please try again.',
    assignmentFailed: 'Could not create assignment. Please try again.',
  },

  // Production operations
  production: {
    planNotFound: 'Production plan not found.',
    cannotModifyPlan: 'This plan is locked and cannot be modified.',
    propagationFailed: 'Propagation recording failed. Please try again.',
    transplantFailed: 'Transplant recording failed. Please try again.',
    checkInFailed: 'Check-in failed. Please try again.',
  },

  // Reference data (varieties, sizes, locations, etc.)
  reference: {
    varietyNotFound: 'Plant variety not found.',
    varietyInUse: 'This variety is in use and cannot be deleted.',
    sizeNotFound: 'Size not found.',
    sizeInUse: 'This size is in use and cannot be deleted.',
    locationNotFound: 'Location not found.',
    locationInUse: 'This location is in use and cannot be deleted.',
    supplierNotFound: 'Supplier not found.',
    customerNotFound: 'Customer not found.',
    saveFailed: 'Could not save changes. Please try again.',
    deleteFailed: 'Could not delete. Please try again.',
  },

  // Materials / inventory
  materials: {
    insufficientStock: 'Not enough stock available.',
    purchaseOrderFailed: 'Could not create purchase order.',
    consumptionFailed: 'Could not record consumption.',
    adjustmentFailed: 'Stock adjustment failed.',
  },

  // AI operations
  ai: {
    generationFailed: 'AI could not generate a response. Please try again.',
    unavailable: 'AI features are temporarily unavailable.',
    timeout: 'AI request timed out. Please try again.',
  },

  // Generic operations
  generic: {
    saveFailed: 'Could not save changes. Please try again.',
    loadFailed: 'Could not load data. Please refresh the page.',
    deleteFailed: 'Could not delete. Please try again.',
    searchFailed: 'Search failed. Please try again.',
    exportFailed: 'Export failed. Please try again.',
    importFailed: 'Import failed. Please check the file and try again.',
    printFailed: 'Could not print. Please check your printer.',
    uploadFailed: 'Upload failed. Please try again.',
    downloadFailed: 'Download failed. Please try again.',
    networkError: 'Connection lost. Please check your internet.',
    sessionExpired: 'Your session has expired. Please sign in again.',
    permissionDenied: "You don't have permission to do this.",
    notFound: 'The requested item could not be found.',
    unknownError: 'Something went wrong. Please try again.',
  },
} as const;

export type ErrorDomain = keyof typeof errorMessages;
export type ErrorKey<D extends ErrorDomain> = keyof (typeof errorMessages)[D];

/**
 * Get a domain-specific error message
 */
export function getErrorMessage<D extends ErrorDomain>(
  domain: D,
  key: ErrorKey<D>,
  fallback?: string
): string {
  const domainMessages = errorMessages[domain];
  const message = domainMessages[key as keyof typeof domainMessages];
  return (message as string) ?? fallback ?? errorMessages.generic.unknownError;
}

/**
 * Get a generic error message by key
 */
export function getGenericError(
  key: keyof typeof errorMessages.generic
): string {
  return errorMessages.generic[key];
}
