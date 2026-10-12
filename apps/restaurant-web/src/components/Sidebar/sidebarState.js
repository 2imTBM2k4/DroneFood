export const SIDEBAR_STORAGE_KEY = "restaurant-sidebar-collapsed";

export const readSidebarCollapsed = (storage = window.localStorage) =>
  storage.getItem(SIDEBAR_STORAGE_KEY) === "true";

export const writeSidebarCollapsed = (
  storage = window.localStorage,
  collapsed
) => {
  storage.setItem(SIDEBAR_STORAGE_KEY, String(Boolean(collapsed)));
};
