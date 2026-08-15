"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getProduct, parsePrice, type Product } from "@/data/products";

export type CartLine = {
  slug: string;
  quantity: number;
};

type CartContextValue = {
  lines: CartLine[];
  itemCount: number;
  subtotal: number;
  addItem: (slug: string, quantity?: number) => void;
  removeItem: (slug: string) => void;
  setQuantity: (slug: string, quantity: number) => void;
  clear: () => void;
  getLineProduct: (slug: string) => Product | undefined;
};

const STORAGE_KEY = "sitesync-cart-v1";
const CartContext = createContext<CartContextValue | null>(null);

function readStored(): CartLine[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CartLine[];
    return Array.isArray(parsed)
      ? parsed.filter((l) => l.slug && l.quantity > 0)
      : [];
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setLines(
      readStored().filter((l) => {
        const p = getProduct(l.slug);
        return Boolean(p && !p.contactOnly);
      })
    );
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
  }, [lines, ready]);

  const addItem = useCallback((slug: string, quantity = 1) => {
    const product = getProduct(slug);
    if (!product || product.contactOnly) return;
    setLines((prev) => {
      const existing = prev.find((l) => l.slug === slug);
      if (existing) {
        return prev.map((l) =>
          l.slug === slug
            ? { ...l, quantity: Math.min(99, l.quantity + quantity) }
            : l
        );
      }
      return [...prev, { slug, quantity: Math.min(99, quantity) }];
    });
  }, []);

  const removeItem = useCallback((slug: string) => {
    setLines((prev) => prev.filter((l) => l.slug !== slug));
  }, []);

  const setQuantity = useCallback((slug: string, quantity: number) => {
    const next = Math.floor(quantity);
    if (next <= 0) {
      setLines((prev) => prev.filter((l) => l.slug !== slug));
      return;
    }
    setLines((prev) =>
      prev.map((l) =>
        l.slug === slug ? { ...l, quantity: Math.min(99, next) } : l
      )
    );
  }, []);

  const clear = useCallback(() => setLines([]), []);

  const getLineProduct = useCallback(
    (slug: string) => getProduct(slug),
    []
  );

  const itemCount = useMemo(
    () => lines.reduce((sum, l) => sum + l.quantity, 0),
    [lines]
  );

  const subtotal = useMemo(
    () =>
      lines.reduce((sum, l) => {
        const product = getProduct(l.slug);
        return sum + (product ? parsePrice(product.price) * l.quantity : 0);
      }, 0),
    [lines]
  );

  const value = useMemo(
    () => ({
      lines,
      itemCount,
      subtotal,
      addItem,
      removeItem,
      setQuantity,
      clear,
      getLineProduct,
    }),
    [
      lines,
      itemCount,
      subtotal,
      addItem,
      removeItem,
      setQuantity,
      clear,
      getLineProduct,
    ]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error("useCart must be used within CartProvider");
  }
  return ctx;
}
