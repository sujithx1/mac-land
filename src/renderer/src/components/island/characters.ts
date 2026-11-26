import type { ComponentType } from 'react'
import type { SpiderMood } from './NotchSpider'

/** What a character below the island is told; the island places it at its bottom edge. */
export interface CharacterProps {
  mood: SpiderMood
  /** Changes on every new event (charger, headphones, Mac unlock). */
  excitement: number
  /** Length of the flat part of the island's bottom edge, in points, to walk along. */
  edgeWidth: number
}

/**
 * An optional character kept in ./personal/ (git-ignored, never published). If
 * that folder holds an index.tsx whose default export is a component, it
 * replaces the chosen character in this build; a default export of null, or no
 * folder at all (how the repository ships), leaves the menu's choice in place.
 * Vite resolves this at build time, so nothing is loaded from disk at runtime.
 */
const personal = import.meta.glob<{ default: ComponentType<CharacterProps> | null }>('./personal/index.tsx', { eager: true })

export const PersonalCharacters: ComponentType<CharacterProps> | null = Object.values(personal)[0]?.default ?? null
