import * as React from 'react';
import { injectable, inject, postConstruct } from '@theia/core/shared/inversify';
import { ReactWidget } from '@theia/core/lib/browser/widgets/react-widget';
import { CommandService } from '@theia/core';
import { WorkspaceService } from '@theia/workspace/lib/browser/workspace-service';
import { WorkspaceCommands } from '@theia/workspace/lib/browser/workspace-commands';
import './ContinuumWelcomeWidget.css';

@injectable()
export class ContinuumWelcomeWidget extends ReactWidget {
    static readonly ID = 'continuum-welcome';
    static readonly LABEL = 'Welcome';

    @inject(CommandService)
    protected readonly commandService: CommandService;

    @inject(WorkspaceService)
    protected readonly workspaceService: WorkspaceService;

    @postConstruct()
    protected init(): void {
        this.id = ContinuumWelcomeWidget.ID;
        this.title.label = ContinuumWelcomeWidget.LABEL;
        this.title.caption = 'Welcome to Continuum';
        this.title.closable = true;
        this.title.iconClass = 'fa fa-home';
        this.addClass('continuum-welcome-widget');
        this.update();
    }

    protected render(): React.ReactNode {
        return React.createElement('div', { className: 'continuum-welcome-container' },
            this.renderHeader(),
            this.renderActions(),
            this.renderDocumentation()
        );
    }

    private renderHeader(): React.ReactNode {
        return React.createElement('div', { className: 'continuum-welcome-header' },
            React.createElement('img', {
                src: './Logo.png',
                alt: 'Continuum',
                className: 'continuum-welcome-logo'
            }),
            React.createElement('h1', { className: 'continuum-welcome-title' }, 'Welcome to Continuum'),
            React.createElement('p', { className: 'continuum-welcome-subtitle' }, 'Workflow Development IDE')
        );
    }

    private renderActions(): React.ReactNode {
        return React.createElement('div', { className: 'continuum-welcome-section' },
            React.createElement('h2', { className: 'continuum-welcome-section-title' }, 'Start'),
            React.createElement('div', { className: 'continuum-welcome-actions' },
                this.renderActionButton(
                    'fa fa-diagram-project',
                    'New Workflow',
                    'Create a new .cwf workflow file',
                    () => this.commandService.executeCommand('continuum.create-new-workflow:command')
                ),
                this.renderActionButton(
                    'fa fa-folder-open',
                    'Open Folder',
                    'Open a folder as workspace',
                    () => this.commandService.executeCommand(WorkspaceCommands.OPEN_FOLDER.id)
                ),
                this.renderActionButton(
                    'fa fa-clock-rotate-left',
                    'Open Recent',
                    'Open a recently used workspace',
                    () => this.commandService.executeCommand(WorkspaceCommands.OPEN_RECENT_WORKSPACE.id)
                )
            )
        );
    }

    private renderActionButton(iconClass: string, label: string, description: string, onClick: () => void): React.ReactNode {
        return React.createElement('button', {
            className: 'continuum-welcome-action-btn',
            onClick,
            title: description
        },
            React.createElement('i', { className: `continuum-welcome-action-icon ${iconClass}` }),
            React.createElement('div', { className: 'continuum-welcome-action-text' },
                React.createElement('span', { className: 'continuum-welcome-action-label' }, label),
                React.createElement('span', { className: 'continuum-welcome-action-desc' }, description)
            )
        );
    }

    private renderDocumentation(): React.ReactNode {
        return React.createElement('div', { className: 'continuum-welcome-section' },
            React.createElement('h2', { className: 'continuum-welcome-section-title' }, 'Help'),
            React.createElement('div', { className: 'continuum-welcome-links' },
                this.renderLink('fa fa-globe', 'Official Website', 'https://projectcontinuum.org', 'https://projectcontinuum.org'),
                this.renderLink('fa fa-book', 'Documentation', 'Learn how to build workflows'),
                this.renderLink('fa fa-keyboard', 'Keyboard Shortcuts', 'View available shortcuts'),
                this.renderLink('fa fa-puzzle-piece', 'Node Development', 'Create custom workflow nodes')
            )
        );
    }

    private renderLink(iconClass: string, label: string, description: string, href?: string): React.ReactNode {
        const content = [
            React.createElement('i', { className: `continuum-welcome-link-icon ${iconClass}` }),
            React.createElement('div', null,
                React.createElement('span', { className: 'continuum-welcome-link-label' }, label),
                React.createElement('span', { className: 'continuum-welcome-link-desc' }, ` — ${description}`)
            )
        ];
        if (href) {
            return React.createElement('a', {
                className: 'continuum-welcome-link',
                href,
                target: '_blank',
                rel: 'noopener noreferrer'
            }, ...content);
        }
        return React.createElement('div', { className: 'continuum-welcome-link' }, ...content);
    }
}
