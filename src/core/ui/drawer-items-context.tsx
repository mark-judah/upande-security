import { createContext, useContext, type ReactNode } from 'react';
import type { Ionicons } from '@expo/vector-icons';

/** A single navigation row rendered inside the SideMenu. */
export type DrawerItem = {
  /** Display label. */
  label: string;
  /** Any route path under `app/` (e.g. 'incidents', 'gate', 'settings'). */
  route: string;
  /** Ionicons name rendered next to the label. */
  icon: keyof typeof Ionicons.glyphMap;
};

const DrawerItemsContext = createContext<DrawerItem[]>([]);

export function DrawerItemsProvider({
  items,
  children,
}: {
  items: DrawerItem[];
  children: ReactNode;
}) {
  return <DrawerItemsContext.Provider value={items}>{children}</DrawerItemsContext.Provider>;
}

export function useDrawerItems(): DrawerItem[] {
  return useContext(DrawerItemsContext);
}
