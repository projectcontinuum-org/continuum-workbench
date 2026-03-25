import { FrontendApplication, FrontendApplicationContribution } from "@theia/core/lib/browser";
import { MaybePromise } from "@theia/core";
import { inject, injectable, postConstruct } from "@theia/core/shared/inversify";
import ContinuumThemeService from "../theme/ContinuumThemeService";
import { MonacoLanguageRegistration } from "../language/MonacoLanguageRegistration";
import { StatusBar, StatusBarAlignment } from "@theia/core/lib/browser/status-bar/status-bar";
import '../style/continuum-overrides.css';

@injectable()
export class ContinuumFrontendApplicationContribution implements FrontendApplicationContribution {

    constructor(
        @inject(ContinuumThemeService)
        protected readonly continuumThemeService: ContinuumThemeService,
        @inject(MonacoLanguageRegistration)
        protected readonly languageRegistration: MonacoLanguageRegistration,
        @inject(StatusBar)
        protected readonly statusBar: StatusBar
    ) {}

    @postConstruct()
    protected init(): void {
        // Register languages as early as possible
        this.languageRegistration.initialize();
    }

    initialize(): MaybePromise<void> {
        // Register themes in initialize() (earliest lifecycle hook)
        // so Continuum themes are available when Theia resolves defaultTheme from config
        this.continuumThemeService.registerAllThemes();
    }

    onStart(app: FrontendApplication): void {
        // Inject Continuum favicon
        const link = document.createElement('link');
        link.rel = 'icon';
        link.type = 'image/svg+xml';
        link.href = './favicon.svg';
        document.head.appendChild(link);

        // Add Continuum brand element to status bar
        this.statusBar.setElement('continuum-brand', {
            text: 'Continuum',
            alignment: StatusBarAlignment.LEFT,
            priority: 1000,
            tooltip: 'Continuum Workflow IDE'
        });
    }
}