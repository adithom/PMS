// src/config/roleConfig.ts

export interface RouteConfig {
  path: string;
  label: string;
  component: string; // Component name for reference
  allowedRoles: string[];
}

// Define all available routes with their access control
export const routes: RouteConfig[] = [
  {
    path: '/properties',
    label: 'Properties',
    component: 'Properties',
    allowedRoles: ['ADMIN', 'MANAGER']
  },
  {
    path: '/rooms',
    label: 'Rooms',
    component: 'Rooms',
    allowedRoles: ['ADMIN', 'MANAGER', 'FRONTDESK', 'HOUSEKEEPING']
  },
  {
    path: '/bookings',
    label: 'Bookings',
    component: 'Bookings',
    allowedRoles: ['ADMIN', 'MANAGER', 'FRONTDESK', 'AGENCY']
  },
  {
    path: '/guests',
    label: 'Guests',
    component: 'Guests',
    allowedRoles: ['ADMIN', 'MANAGER', 'FRONTDESK']
  },
  {
    path: '/billing',
    label: 'Billing',
    component: 'Billing',
    allowedRoles: ['ADMIN', 'MANAGER', 'FRONTDESK', 'POS']
  },
  {
    path: '/pos',
    label: 'POS',
    component: 'PosInterface',
    allowedRoles: ['ADMIN', 'MANAGER', 'POS']
  },
  {
    path: '/reports',
    label: 'Reports',
    component: 'Reports',
    allowedRoles: ['ADMIN', 'MANAGER', 'POS']
  }
];

/**
 * Get routes allowed for a specific role
 */
export function getRoutesForRole(role: string): RouteConfig[] {
  return routes.filter(route => route.allowedRoles.includes(role));
}

/**
 * Check if a role has access to a specific route
 */
export function hasAccessToRoute(role: string, path: string): boolean {
  const route = routes.find(r => r.path === path);
  return route ? route.allowedRoles.includes(role) : false;
}

/**
 * Get default route for a role (first allowed route)
 */
export function getDefaultRouteForRole(role: string): string {
  const allowedRoutes = getRoutesForRole(role);
  return allowedRoutes.length > 0 ? allowedRoutes[0].path : '/';
}