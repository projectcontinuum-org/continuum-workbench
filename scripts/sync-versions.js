#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const rootPkgPath = path.join(rootDir, 'package.json');
const rootPkg = JSON.parse(fs.readFileSync(rootPkgPath, 'utf8'));
const { version, workspaces } = rootPkg;

for (const workspace of workspaces) {
    const pkgPath = path.join(rootDir, workspace, 'package.json');
    const raw = fs.readFileSync(pkgPath, 'utf8');
    const pkg = JSON.parse(raw);

    if (pkg.version === version) {
        continue;
    }

    const indentMatch = raw.match(/^(\s+)"/m);
    const indent = indentMatch ? indentMatch[1] : '  ';

    pkg.version = version;
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, indent) + '\n');
    console.log(`Synced ${workspace}/package.json -> ${version}`);
}
