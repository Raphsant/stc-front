// Bitácora (journal) limits shared by the upload form and the API.

/** Max screenshots in one image entry — they are analyzed together as one thread. */
export const MAX_JOURNAL_IMAGES = 6

/**
 * S3 keys of an image entry, in conversation order. Entries created before
 * multi-image support only have `content` (a single key).
 */
export function journalImageKeys(entry: { content?: string | null; images?: string[] | null }): string[] {
    if (entry.images?.length) return [...entry.images]
    return entry.content ? [entry.content] : []
}
