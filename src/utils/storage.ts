import { Meeting, Product, AppUser } from '../types';

const STORAGE_KEY     = 'salescrm_meetings';
const INVENTORY_KEY   = 'salescrm_inventory';
const USERS_KEY       = 'salescrm_users';
const SESSION_KEY     = 'salescrm_session';

// ─── Meetings ─────────────────────────────────────────────────────────────────
export function getMeetings(): Meeting[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function saveMeeting(meeting: Meeting): void {
  const meetings = getMeetings();
  meetings.push(meeting);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(meetings));
}

export function updateMeeting(updated: Meeting): void {
  const meetings = getMeetings();
  const idx = meetings.findIndex((m) => m.id === updated.id);
  if (idx !== -1) {
    meetings[idx] = updated;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(meetings));
  }
}

export function deleteMeeting(id: string): void {
  const meetings = getMeetings().filter((m) => m.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(meetings));
}

// ─── Inventory ────────────────────────────────────────────────────────────────
export function getProducts(): Product[] {
  try {
    const data = localStorage.getItem(INVENTORY_KEY);
    if (data) return JSON.parse(data);
    localStorage.setItem(INVENTORY_KEY, JSON.stringify([]));
    return [];
  } catch {
    return [];
  }
}

export function saveProduct(product: Product): void {
  const products = getProducts();
  products.push(product);
  localStorage.setItem(INVENTORY_KEY, JSON.stringify(products));
}

export function updateProduct(updated: Product): void {
  const products = getProducts();
  const idx = products.findIndex((p) => p.id === updated.id);
  if (idx !== -1) {
    products[idx] = updated;
    localStorage.setItem(INVENTORY_KEY, JSON.stringify(products));
  }
}

export function deleteProduct(id: string): void {
  const products = getProducts().filter((p) => p.id !== id);
  localStorage.setItem(INVENTORY_KEY, JSON.stringify(products));
}

// ─── Users ────────────────────────────────────────────────────────────────────
export function getUsers(): AppUser[] {
  try {
    const data = localStorage.getItem(USERS_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function saveUser(user: AppUser): void {
  const users = getUsers();
  users.push(user);
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

export function updateUser(updated: AppUser): void {
  const users = getUsers();
  const idx = users.findIndex((u) => u.id === updated.id);
  if (idx !== -1) {
    users[idx] = updated;
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }
}

export function deleteUser(id: string): void {
  const users = getUsers().filter((u) => u.id !== id);
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

export function authenticateUser(email: string, password: string): AppUser | null {
  const users = getUsers();
  return users.find(
    (u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password
  ) || null;
}

// ─── Session ──────────────────────────────────────────────────────────────────
// Using localStorage so session persists across tabs and page refreshes
// (and so cross-device sync works when combined with account import)
export function getSession(): AppUser | null {
  try {
    const data = localStorage.getItem(SESSION_KEY);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

export function setSession(user: AppUser): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(user));
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
}

// ─── Cross-device Account Sync ────────────────────────────────────────────────
// Encode all users as a base64 string that can be copied to another device
export function exportAccountsCode(): string {
  const users = getUsers();
  return btoa(unescape(encodeURIComponent(JSON.stringify(users))));
}

// Import users from a sync code (merges — skips duplicates by email)
export function importAccountsFromCode(code: string): { added: number; error?: string } {
  try {
    const decoded = JSON.parse(decodeURIComponent(escape(atob(code.trim()))));
    if (!Array.isArray(decoded)) return { added: 0, error: 'Invalid sync code.' };
    const existing = getUsers();
    const existingEmails = new Set(existing.map((u) => u.email.toLowerCase()));
    const toAdd: AppUser[] = decoded.filter(
      (u: AppUser) => u.id && u.email && !existingEmails.has(u.email.toLowerCase())
    );
    const merged = [...existing, ...toAdd];
    localStorage.setItem(USERS_KEY, JSON.stringify(merged));
    return { added: toAdd.length };
  } catch {
    return { added: 0, error: 'Invalid or corrupted sync code.' };
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
