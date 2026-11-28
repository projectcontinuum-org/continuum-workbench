/**
 * Names for one open script editor. Every editor gets a package of its own (and a folder of the same name): two scripts
 * on the language server's source path that shared a package would clash on the names they declare, and a name derived
 * from the script's content would clash for two nodes with equal content. So the id is random per editor and never
 * issued twice in one session, not even after the editor is closed.
 */

const ID_PREFIX = 'ctx';
const ID_LENGTH = 16;
const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';
const ID_PATTERN = new RegExp(`^${ID_PREFIX}[a-z0-9]{${ID_LENGTH}}$`);

/** Source of random bytes; replaceable so a spec can force a collision. */
export type RandomBytes = (length: number) => Uint8Array;

const cryptoRandomBytes: RandomBytes = length => {
    const bytes = new Uint8Array(length);
    globalThis.crypto.getRandomValues(bytes);
    return bytes;
};

const issued = new Set<string>();

/** A fresh package id such as `ctx3k9x0q7m2b1c4d8z`; also the name of the editor's folder. */
export function createPackageId(randomBytes: RandomBytes = cryptoRandomBytes): string {
    for (;;) {
        const bytes = randomBytes(ID_LENGTH);
        let id = ID_PREFIX;
        for (let index = 0; index < ID_LENGTH; index++) {
            id += ALPHABET[bytes[index] % ALPHABET.length];
        }
        if (!issued.has(id)) {
            issued.add(id);
            return id;
        }
    }
}

/** True for a name `createPackageId` could have produced; used to leave foreign folders alone. */
export function isPackageId(name: string): boolean {
    return ID_PATTERN.test(name);
}
