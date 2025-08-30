// Demo mode utilities and fake data generators
import type { Asset } from "@/services/assets";
import type { Property } from "@/services/properties";

let seeded = false;
let demoAssets: Asset[] = [];
let demoProperties: Property[] = [];
let demoUsers: Array<{ id: string; name: string; email: string; role: string; department: string | null }> = [];

export function isDemoMode(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const p = window.location.pathname || '';
    return p.startsWith('/demo');
  } catch { return false; }
}

function seedOnce() {
  if (seeded) return;
  seeded = true;
  // Properties: 10
  demoProperties = Array.from({ length: 10 }, (_, i) => {
    const id = `PROP-${String(i + 1).padStart(3, '0')}`;
    return {
      id,
      name: `Property ${i + 1}`,
      address: `#${100 + i}, Sample Street, City`,
      type: i % 2 === 0 ? 'Office' : 'Warehouse',
      status: 'active',
      manager: i % 3 === 0 ? 'Manager A' : 'Manager B',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  });

  // Assets: 50
  const types = ['Laptop', 'Printer', 'Router', 'Chair', 'Desk', 'Camera'];
  const conditions = ['New', 'Good', 'Fair'];
  const statuses = ['active', 'maintenance', 'retired'];
  const now = new Date();
  demoAssets = Array.from({ length: 50 }, (_, i) => {
    const property = demoProperties[i % demoProperties.length].id;
    const type = types[i % types.length];
    const name = `${type} ${i + 1}`;
    const purchaseDate = new Date(now.getFullYear(), now.getMonth() - (i % 12), 1 + (i % 28));
    const expMonths = (i % 18) - 6; // some past, some future
    const expiryDate = new Date(now.getFullYear(), now.getMonth() + expMonths, 1 + (i % 28));
    return {
      id: `AST-${String(i + 1).padStart(3, '0')}`,
      name,
      type,
      property,
      property_id: property,
      quantity: (i % 4) + 1,
      purchaseDate: purchaseDate.toISOString(),
      expiryDate: expiryDate.toISOString(),
      poNumber: `PO-${1000 + i}`,
      condition: conditions[i % conditions.length],
      status: statuses[i % statuses.length],
      location: `Room ${((i % 20) + 1)}`,
      created_at: new Date().toISOString(),
    } as Asset;
  });

  // Users: 15
  demoUsers = Array.from({ length: 15 }, (_, i) => ({
    id: `U-${String(i + 1).padStart(3, '0')}`,
    name: `Demo User ${i + 1}`,
    email: `demo.user${i + 1}@example.com`,
    role: i === 0 ? 'admin' : i % 3 === 0 ? 'manager' : 'user',
    department: i % 2 === 0 ? 'Operations' : 'IT',
  }));
}

export function getDemoProperties(): Property[] {
  seedOnce();
  return demoProperties;
}

export function getDemoAssets(): Asset[] {
  seedOnce();
  return demoAssets;
}

export function getDemoUsers() {
  seedOnce();
  return demoUsers;
}

export function demoStats() {
  const assets = getDemoAssets();
  const properties = getDemoProperties();
  const users = getDemoUsers();
  const expiring = assets.filter(a => {
    if (!a.expiryDate) return false;
    const d = new Date(a.expiryDate);
    const now = new Date();
    const diff = (d.getTime() - now.getTime()) / (1000*60*60*24);
    return diff >= 0 && diff <= 30;
  }).length;
  const totalQuantity = assets.reduce((sum, a) => sum + (Number(a.quantity) || 0), 0);
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const startThisMonth = new Date(year, month, 1);
  const startNextMonth = new Date(year, month + 1, 1);
  const startPrevMonth = new Date(year, month - 1, 1);
  const endPrevMonth = new Date(year, month, 1);
  const monthlyPurchases = assets.filter(a => a.purchaseDate && new Date(a.purchaseDate) >= startThisMonth && new Date(a.purchaseDate) < startNextMonth).length;
  const monthlyPurchasesPrev = assets.filter(a => a.purchaseDate && new Date(a.purchaseDate) >= startPrevMonth && new Date(a.purchaseDate) < endPrevMonth).length;
  const assetTypes = Array.from(new Set(assets.map(a => a.type || ''))).filter(Boolean).length;
  const codesTotal = assets.length; // simple proxy for demo
  const codesReady = Math.max(0, Math.floor(codesTotal * 0.3));
  return {
    counts: { assets: assets.length, properties: properties.length, users: users.length, expiring },
    metrics: { totalQuantity, monthlyPurchases, monthlyPurchasesPrev, codesTotal, codesReady, assetTypes },
  };
}

export function demoAuthKeys() {
  return {
    current: 'demo_current_user_id',
    auth: 'demo_auth_user',
    perms: 'demo_user_permissions',
  } as const;
}
