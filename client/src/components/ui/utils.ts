import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const NATIVE_SELECT_CLASS =
  "border border-border rounded-md px-3 py-1.5 text-sm text-foreground bg-input-background focus:outline-none focus-visible:ring-2 focus-visible:ring-ring";
