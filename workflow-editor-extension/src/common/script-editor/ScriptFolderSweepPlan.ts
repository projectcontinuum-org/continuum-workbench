import { LEASE_EXPIRY_MS } from './ScriptFolderLayout';
import { isPackageId } from './ScriptFileNaming';

/** One entry of the hidden folder and the time of its last lease renewal, if it has a readable lease. */
export interface FolderLease {
    readonly name: string;
    readonly leasedAt: number | undefined;
}

/**
 * Which folders of the hidden folder to delete: those shaped like an editor's folder whose lease is missing or has not
 * been renewed for the expiry time. A second browser tab's live editors renew their leases, so they stay; anything that
 * is not shaped like an editor's folder (the ignore file, a user's file) is never touched.
 */
export function foldersToSweep(entries: readonly FolderLease[], now: number, expiryMs: number = LEASE_EXPIRY_MS): string[] {
    return entries
        .filter(entry => isPackageId(entry.name))
        .filter(entry => entry.leasedAt === undefined || !Number.isFinite(entry.leasedAt) || now - entry.leasedAt > expiryMs)
        .map(entry => entry.name);
}
