import { storage } from "../../api/client";

const SEARCH_HISTORY_KEY = "@dronefood_customer_search_history";
const MAX_HISTORY_ITEMS = 10;

export async function getSearchHistory(): Promise<string[]> {
  try {
    const raw = await storage.getItem(SEARCH_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function addSearchHistory(term: string): Promise<string[]> {
  const trimmed = term.trim();
  if (!trimmed) return getSearchHistory();
  try {
    const current = await getSearchHistory();
    // Move to front, deduplicate (case-insensitive check, keep user's case)
    const filtered = current.filter(
      (item) => item.toLowerCase() !== trimmed.toLowerCase()
    );
    const updated = [trimmed, ...filtered].slice(0, MAX_HISTORY_ITEMS);
    await storage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return [trimmed];
  }
}

export async function removeSearchHistory(term: string): Promise<string[]> {
  try {
    const current = await getSearchHistory();
    const updated = current.filter(
      (item) => item.toLowerCase() !== term.toLowerCase()
    );
    await storage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return [];
  }
}

export async function clearSearchHistory(): Promise<void> {
  try {
    await storage.deleteItem(SEARCH_HISTORY_KEY);
  } catch {
    // ignore
  }
}
