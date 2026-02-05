import 'server-only';

import { getUserAndOrg } from '@/server/auth/org';

/**
 * Role hierarchy for HortiTrack
 * Higher roles include all permissions of lower roles
 */
export type OrgRole = 'owner' | 'admin' | 'editor' | 'viewer';

const ROLE_HIERARCHY: Record<OrgRole, number> = {
  owner: 4,
  admin: 3,
  editor: 2,
  viewer: 1,
};

/**
 * Check if user has one of the required roles for destructive operations
 * @param allowedRoles - Array of roles that are allowed to perform the action
 * @throws Error if user doesn't have required role
 */
export async function requireOrgRole(allowedRoles: OrgRole[]): Promise<{
  user: { id: string };
  orgId: string;
  role: OrgRole;
}> {
  const { user, orgId, supabase } = await getUserAndOrg();

  const { data: membership, error } = await supabase
    .from('org_memberships')
    .select('role')
    .eq('org_id', orgId)
    .eq('user_id', user.id)
    .single();

  if (error || !membership) {
    throw new Error('Unable to verify user permissions');
  }

  const userRole = membership.role as OrgRole;
  const hasPermission = allowedRoles.includes(userRole);

  if (!hasPermission) {
    throw new Error('Insufficient permissions');
  }

  return { user, orgId, role: userRole };
}

/**
 * Check if user has at least the minimum required role
 * Uses role hierarchy - higher roles include lower role permissions
 * @param minimumRole - Minimum role required
 */
export async function requireMinimumRole(minimumRole: OrgRole): Promise<{
  user: { id: string };
  orgId: string;
  role: OrgRole;
}> {
  const { user, orgId, supabase } = await getUserAndOrg();

  const { data: membership, error } = await supabase
    .from('org_memberships')
    .select('role')
    .eq('org_id', orgId)
    .eq('user_id', user.id)
    .single();

  if (error || !membership) {
    throw new Error('Unable to verify user permissions');
  }

  const userRole = membership.role as OrgRole;
  const userLevel = ROLE_HIERARCHY[userRole] ?? 0;
  const requiredLevel = ROLE_HIERARCHY[minimumRole];

  if (userLevel < requiredLevel) {
    throw new Error('Insufficient permissions');
  }

  return { user, orgId, role: userRole };
}

/**
 * Error class for permission denials
 */
export class PermissionDeniedError extends Error {
  constructor(message: string = 'Insufficient permissions') {
    super(message);
    this.name = 'PermissionDeniedError';
  }
}

/**
 * Check if an error is a permission denied error
 */
export function isPermissionError(error: unknown): error is PermissionDeniedError {
  return (
    error instanceof Error &&
    (error.message === 'Insufficient permissions' ||
      error.name === 'PermissionDeniedError')
  );
}
