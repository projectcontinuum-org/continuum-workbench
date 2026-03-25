import * as React from 'react';
import { injectable, inject } from '@theia/core/shared/inversify';
import { AboutDialog, AboutDialogProps } from '@theia/core/lib/browser/about-dialog';

@injectable()
export class ContinuumAboutDialog extends AboutDialog {

    constructor(@inject(AboutDialogProps) props: AboutDialogProps) {
        super(props);
    }

    protected override renderHeader(): React.ReactNode {
        const applicationInfo = this.applicationInfo;
        return React.createElement('div', { className: 'continuum-about-header' },
            React.createElement('img', {
                src: './Logo.png',
                alt: 'Continuum',
                style: { width: '80px', marginBottom: '16px' }
            }),
            React.createElement('h2', { style: { margin: '0 0 8px 0', fontWeight: 300, letterSpacing: '2px' } }, 'Continuum'),
            React.createElement('p', { style: { margin: '0 0 4px 0', opacity: 0.8 } }, 'Workflow Development IDE'),
            applicationInfo && React.createElement('p', {
                style: { margin: '8px 0 0 0', fontSize: '0.85em', opacity: 0.6 }
            }, `Version ${applicationInfo.version}`)
        );
    }

    protected override renderExtensions(): React.ReactNode {
        // Filter to only show @continuum/* extensions
        const continuumExtensions = this.extensionsInfos.filter(
            ext => ext.name.startsWith('@continuum/')
        );

        if (continuumExtensions.length === 0) {
            return React.createElement(React.Fragment, null);
        }

        return React.createElement(React.Fragment, null,
            React.createElement('h3', { style: { marginTop: '16px' } }, 'Extensions'),
            React.createElement('ul', { className: 'theia-aboutExtensions' },
                continuumExtensions
                    .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()))
                    .map(ext => React.createElement('li', { key: ext.name },
                        ext.name, ' ', ext.version
                    ))
            )
        );
    }

    protected override render(): React.ReactNode {
        return React.createElement('div', {
            className: 'theia-aboutDialog',
            style: { textAlign: 'center', padding: '16px' }
        },
            this.renderHeader(),
            this.renderExtensions()
        );
    }
}
