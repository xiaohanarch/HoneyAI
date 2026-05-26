// shadcn/ui `cn` utility — class-name merger using clsx + tailwind-merge.
// Installed here so aliased path @/lib/utils resolves for future shadcn component installs.
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
