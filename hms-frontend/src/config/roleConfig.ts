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
    path: '/bookings',
    label: 'Bookings',
    component: 'Bookings',
    allowedRoles: ['ADMIN', 'MANAGER', 'FRONTDESK', 'AGENCY']
  },
  {
    path: '/reservations',
    label: 'Reservations',
    component: 'Reservations',
    allowedRoles: ['ADMIN', 'MANAGER', 'FRONTDESK', 'AGENCY']
  },
  {
    path: '/rooms',
    label: 'Inventory',
    component: 'Rooms',
    allowedRoles: ['ADMIN']
  },
  {
    path: '/guests',
    label: 'Guests',
    component: 'Guests',
    allowedRoles: ['ADMIN', 'MANAGER', 'FRONTDESK']
  },
  {
    path: '/pos',
    label: 'POS',
    component: 'PosInterface',
    allowedRoles: ['POS']
  },
  {
    path: '/pos/manage',
    label: 'POS',
    component: 'PosManagement',
    allowedRoles: ['MANAGER']
  },
  {
    path: '/billing',
    label: 'Billing',
    component: 'Billing',
    allowedRoles: ['ADMIN', 'MANAGER', 'FRONTDESK']
  },
  {
    path: '/reports',
    label: 'Reports',
    component: 'Reports',
    allowedRoles: ['ADMIN', 'MANAGER', 'FRONTDESK']
  },
  {
    path: '/console',
    label: 'Console',
    component: 'AdminConsole',
    allowedRoles: ['ADMIN']
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