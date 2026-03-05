import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const NATIVE_SELECT_CLASS =
  "border border-border rounded-lg px-3 py-1.5 text-sm text-foreground bg-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors";
