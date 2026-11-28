#!/usr/bin/env node
'use strict';
/**
 * Seeds the settings of the Kotlin VS Code extension (fwcd.kotlin) so that it uses the language server and Java
 * runtime bundled with the workbench and never downloads anything. One implementation serves both the image (called
 * by entrypoint.sh on every start) and development (`yarn start` and `yarn seed:kotlin-settings`):
 *
 * - `<config dir>/settings.json` gets the `kotlin.*` keys below. Every other key is kept. The file keeps its permissions when rewritten. The two keys that hold the
 *   installation's paths (`kotlin.languageServer.path`, `kotlin.java.home`) are rewritten on each run, because they
 *   must follow the install. The other keys (`enabled`, `java.opts`, `scripts.enabled`, `debugAdapter.enabled`) are
 *   defaults: they are written only while the user has not set them, so a user's choice survives a restart.
 * - settings.json may be JSONC (comments, trailing commas). It is parsed leniently and rewritten as plain JSON, so its
 *   comments are lost; the original is kept once as `settings.json.continuum-backup` when that happens. The new file is
 *   written to a temporary file and renamed, so an interrupted run never leaves a truncated settings file.
 * - A settings.json that cannot be read (anything but "does not exist": permissions, a directory...) or cannot be
 *   parsed even leniently is left untouched: the script reports it on stderr, exits
 *   with status 1 and writes nothing (not the marker below either, so the extension asks before downloading anything
 *   instead of silently fetching a server).
 * - `<config dir>/globalStorage/fwcd.kotlin/config.json` marks the extension as initialised, which stops its
 *   first-run dialog ("will automatically download a language server") from blocking activation.
 *
 * The extension starts the server through `<install>/bin/kotlin-language-server`, a launcher that puts the install's
 * Kotlin standard library repository on the server's search path (see scripts/kotlin-language-server-launcher.sh).
 *
 * Install directory: CONTINUUM_KOTLIN_LS_HOME, else /opt/continuum/kotlin-ls when present, else <repository>/.kotlin-ls.
 * Config directory: THEIA_CONFIG_DIR, else ~/.continuum (the app's theia.backend.config.configurationFolder).
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

/** Must equal `theia.backend.config.configurationFolder` of the application package.json (a spec guards it). */
const CONFIGURATION_FOLDER = '.continuum';

/** THEIA_CONFIG_DIR wins; otherwise the application's configuration folder under the user's home. */
function resolveConfigDirectory(env, home) {
    return env.THEIA_CONFIG_DIR || path.join(home, CONFIGURATION_FOLDER);
}

const IMAGE_INSTALL_DIRECTORY = '/opt/continuum/kotlin-ls';
const SERVER_START_SCRIPT = path.join('server', 'bin', 'kotlin-language-server');
/** The launcher the extension starts: the server plus the install's standard library repository. */
const LAUNCHER_SCRIPT = path.join('bin', 'kotlin-language-server');
/** Settings written only while the user has not set them; every other seeded key follows the install. */
const USER_OVERRIDABLE_KEYS = ['kotlin.languageServer.enabled', 'kotlin.java.opts', 'kotlin.scripts.enabled', 'kotlin.debugAdapter.enabled'];
/** Object-valued settings that are merged entry by entry, so the user's own entries (and a `false` for ours) survive. */
const MERGED_OBJECT_KEYS = ['files.exclude', 'search.exclude'];
/** The workspace folder the script editor writes its temp files to; must equal the one in the editor extension. */
const SCRIPT_FOLDER = '.continuum-scripts';
/** Heap and code-cache caps for the single server JVM. */
const SERVER_JAVA_OPTIONS = '-Xmx512m -XX:+UseSerialGC -XX:ReservedCodeCacheSize=64m -XX:MaxMetaspaceSize=192m';
const EXTENSION_ID = 'fwcd.kotlin';

function installDirectory(env, exists, developmentDirectory) {
    if (env.CONTINUUM_KOTLIN_LS_HOME) {
        return env.CONTINUUM_KOTLIN_LS_HOME;
    }
    return exists(path.join(IMAGE_INSTALL_DIRECTORY, SERVER_START_SCRIPT)) ? IMAGE_INSTALL_DIRECTORY : developmentDirectory;
}

/** The extension settings that point it at the bundled server and runtime and switch its downloads off. */
function kotlinSettings({ env, exists, developmentDirectory }) {
    const home = installDirectory(env, exists, developmentDirectory);
    const bundledJava = path.join(home, 'jre');
    const javaHome = env.CONTINUUM_JAVA_HOME || (exists(path.join(bundledJava, 'bin', 'java')) ? bundledJava : undefined);
    return {
        'kotlin.languageServer.enabled': true,
        'kotlin.languageServer.path': path.join(home, LAUNCHER_SCRIPT),
        // Without a runtime to point at the key is left out, so a value the user set is not blanked on every start.
        ...(javaHome ? { 'kotlin.java.home': javaHome } : {}),
        'kotlin.java.opts': SERVER_JAVA_OPTIONS,
        'kotlin.scripts.enabled': true,
        'kotlin.debugAdapter.enabled': false,
        // The script editor's temp files are an implementation detail: keep them out of the Explorer and the search.
        'files.exclude': { [SCRIPT_FOLDER]: true },
        'search.exclude': { [SCRIPT_FOLDER]: true }
    };
}

/**
 * Removes comments and trailing commas from JSONC text, leaving strings alone, so that JSON.parse can read it.
 */
function stripJsonc(text) {
    let result = '';
    let index = 0;
    while (index < text.length) {
        const char = text[index];
        const next = text[index + 1];
        if (char === '"') {
            let end = index + 1;
            while (end < text.length && text[end] !== '"') {
                end += text[end] === '\\' ? 2 : 1;
            }
            result += text.slice(index, end + 1);
            index = end + 1;
        } else if (char === '/' && next === '/') {
            while (index < text.length && text[index] !== '\n') {
                index++;
            }
        } else if (char === '/' && next === '*') {
            const end = text.indexOf('*/', index + 2);
            index = end === -1 ? text.length : end + 2;
        } else {
            result += char;
            index++;
        }
    }
    return removeTrailingCommas(result);
}

function removeTrailingCommas(text) {
    let result = '';
    let inString = false;
    for (let index = 0; index < text.length; index++) {
        const char = text[index];
        if (inString) {
            result += char;
            if (char === '\\') {
                result += text[++index] ?? '';
            } else if (char === '"') {
                inString = false;
            }
        } else if (char === '"') {
            inString = true;
            result += char;
        } else if (char === ',' && /^\s*[}\]]/.test(text.slice(index + 1))) {
            continue;
        } else {
            result += char;
        }
    }
    return result;
}

/**
 * Reads settings text as a JSON object, leniently. `strict` says whether it was plain JSON; `undefined` when it is not
 * an object even leniently.
 */
function parseSettings(rawText) {
    // Editors on Windows save UTF-8 with a byte order mark, which JSON.parse rejects.
    const text = rawText === undefined ? undefined : rawText.replace(/^\uFEFF/, '');
    if (text === undefined || text.trim() === '') {
        return { settings: {}, strict: true };
    }
    for (const [candidate, strict] of [[text, true], [stripJsonc(text), false]]) {
        try {
            const parsed = JSON.parse(candidate);
            if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
                return { settings: parsed, strict };
            }
            return undefined;
        } catch {
            // try the lenient reading next
        }
    }
    return undefined;
}

/**
 * The settings file text with [seeded] merged over the user's settings (see the file header for which keys the user
 * keeps); `undefined` when the existing text cannot be read as a JSON object.
 */
function mergeSettings(existingText, seeded) {
    const parsed = parseSettings(existingText);
    if (parsed === undefined) {
        return undefined;
    }
    const merged = { ...parsed.settings };
    for (const [key, value] of Object.entries(seeded)) {
        if (MERGED_OBJECT_KEYS.includes(key)) {
            const existing = parsed.settings[key];
            const userEntries = existing !== null && typeof existing === 'object' && !Array.isArray(existing) ? existing : {};
            merged[key] = { ...value, ...userEntries };
        } else if (!USER_OVERRIDABLE_KEYS.includes(key) || !(key in parsed.settings)) {
            merged[key] = value;
        }
    }
    return `${JSON.stringify(merged, undefined, 2)}\n`;
}

function readIfPresent(file) {
    try {
        return fs.readFileSync(file, 'utf8');
    } catch (error) {
        if (error.code === 'ENOENT') {
            return undefined;
        }
        throw error;
    }
}

/**
 * Writes through a temporary file in the same directory and renames it over [file], so the write is atomic. The file
 * keeps the permissions of the file it replaces (or of [modeFrom]), so a private settings file stays private.
 */
function writeAtomically(file, content, modeFrom = file) {
    const temporary = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(temporary, content);
    try {
        fs.chmodSync(temporary, fs.statSync(modeFrom).mode & 0o777);
    } catch {
        // Nothing to copy the permissions from: a new file keeps the default ones.
    }
    fs.renameSync(temporary, file);
}

/** Seeds the settings and the first-run marker; returns whether it could (false: settings.json was unreadable or invalid, nothing written). */
function seed({ env, configDirectory, developmentDirectory }) {
    const settings = kotlinSettings({ env, exists: file => fs.existsSync(file), developmentDirectory });
    const settingsFile = path.join(configDirectory, 'settings.json');
    let existingText;
    try {
        existingText = readIfPresent(settingsFile);
    } catch (error) {
        console.error(
            `seed-kotlin-settings: cannot read ${settingsFile} (${error.code ?? error.message}); nothing was written. ` +
                'The Kotlin file editor is not configured: fix the file or its permissions and restart.'
        );
        return false;
    }
    const merged = mergeSettings(existingText, settings);
    if (merged === undefined) {
        console.error(
            `seed-kotlin-settings: ${settingsFile} is not valid JSON (even allowing comments); left unchanged. ` +
                'The Kotlin file editor is not configured: fix the file and restart.'
        );
        return false;
    }
    fs.mkdirSync(configDirectory, { recursive: true });
    if (existingText !== undefined && parseSettings(existingText).strict === false) {
        const backup = `${settingsFile}.continuum-backup`;
        if (!fs.existsSync(backup)) {
            writeAtomically(backup, existingText, settingsFile);
        }
    }
    writeAtomically(settingsFile, merged);
    const storage = path.join(configDirectory, 'globalStorage', EXTENSION_ID);
    fs.mkdirSync(storage, { recursive: true });
    writeAtomically(path.join(storage, 'config.json'), JSON.stringify({ initialized: true }));
    return true;
}

module.exports = { resolveConfigDirectory, CONFIGURATION_FOLDER, kotlinSettings, mergeSettings, stripJsonc, SERVER_JAVA_OPTIONS, EXTENSION_ID };

if (require.main === module) {
    const seeded = seed({
        env: process.env,
        configDirectory: resolveConfigDirectory(process.env, os.homedir()),
        developmentDirectory: path.resolve(__dirname, '..', '.kotlin-ls')
    });
    process.exitCode = seeded ? 0 : 1;
}
