/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import 'vs/css!./media/dialogModal';
import { Modal, IModalOptions } from 'sql/base/browser/ui/modal/modal';
import { attachModalDialogStyler } from 'sql/common/theme/styler';
import { Wizard, Dialog, DialogButton, WizardPage } from 'sql/platform/dialog/dialogTypes';
import { DialogPane } from 'sql/platform/dialog/dialogPane';
import { bootstrapAngular } from 'sql/services/bootstrap/bootstrapService';
import { Button } from 'vs/base/browser/ui/button/button';
import { SIDE_BAR_BACKGROUND } from 'vs/workbench/common/theme';
import { Builder } from 'vs/base/browser/builder';
import { IPartService } from 'vs/workbench/services/part/common/partService';
import { IWorkbenchThemeService } from 'vs/workbench/services/themes/common/workbenchThemeService';
import { IContextViewService } from 'vs/platform/contextview/browser/contextView';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { attachButtonStyler } from 'vs/platform/theme/common/styler';
import { localize } from 'vs/nls';
import { StandardKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import { Emitter } from 'vs/base/common/event';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { DialogMessage, MessageLevel } from '../../workbench/api/common/sqlExtHostTypes';

export class WizardModal extends Modal {
	private _dialogPanes = new Map<WizardPage, DialogPane>();
	private _onDone = new Emitter<void>();
	private _onCancel = new Emitter<void>();

	// Wizard HTML elements
	private _body: HTMLElement;

	// Buttons
	private _previousButton: Button;
	private _nextButton: Button;
	private _generateScriptButton: Button;
	private _doneButton: Button;
	private _cancelButton: Button;

	constructor(
		private _wizard: Wizard,
		name: string,
		options: IModalOptions,
		@IPartService partService: IPartService,
		@IWorkbenchThemeService private _themeService: IWorkbenchThemeService,
		@ITelemetryService telemetryService: ITelemetryService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IInstantiationService private _instantiationService: IInstantiationService
	) {
		super(_wizard.title, name, partService, telemetryService, contextKeyService, options);
	}

	public layout(): void {

	}

	public render() {
		super.render(true);
		attachModalDialogStyler(this, this._themeService);

		if (this.backButton) {
			this.backButton.onDidClick(() => this.cancel());
			attachButtonStyler(this.backButton, this._themeService, { buttonBackground: SIDE_BAR_BACKGROUND, buttonHoverBackground: SIDE_BAR_BACKGROUND });
		}

		if (this._wizard.customButtons) {
			this._wizard.customButtons.forEach(button => {
				let buttonElement = this.addDialogButton(button);
				this.updateButtonElement(buttonElement, button);
			});
		}

		this._previousButton = this.addDialogButton(this._wizard.backButton, () => this.showPage(this.getCurrentPage() - 1));
		this._nextButton = this.addDialogButton(this._wizard.nextButton, () => this.showPage(this.getCurrentPage() + 1));
		this._generateScriptButton = this.addDialogButton(this._wizard.generateScriptButton, () => undefined);
		this._doneButton = this.addDialogButton(this._wizard.doneButton, () => this.done(), false);
		this._wizard.doneButton.registerClickEvent(this._onDone.event);
		this._cancelButton = this.addDialogButton(this._wizard.cancelButton, () => this.cancel(), false);
		this._wizard.cancelButton.registerClickEvent(this._onCancel.event);

		let messageChangeHandler = (message: DialogMessage) => {
			if (message && message.text) {
				this.setError(message.text, message.level);
			} else {
				this.setError('');
			}
		};

		messageChangeHandler(this._wizard.message);
		this._wizard.onMessageChange(message => messageChangeHandler(message));
	}

	private addDialogButton(button: DialogButton, onSelect: () => void = () => undefined, registerClickEvent: boolean = true): Button {
		let buttonElement = this.addFooterButton(button.label, onSelect);
		buttonElement.enabled = button.enabled;
		if (registerClickEvent) {
			button.registerClickEvent(buttonElement.onDidClick);
		}
		button.onUpdate(() => {
			this.updateButtonElement(buttonElement, button);
		});
		attachButtonStyler(buttonElement, this._themeService);
		this.updateButtonElement(buttonElement, button);
		return buttonElement;
	}

	private updateButtonElement(buttonElement: Button, dialogButton: DialogButton) {
		buttonElement.label = dialogButton.label;
		buttonElement.enabled = dialogButton.enabled;
		dialogButton.hidden ? buttonElement.element.classList.add('dialogModal-hidden') : buttonElement.element.classList.remove('dialogModal-hidden');
	}

	protected renderBody(container: HTMLElement): void {
		new Builder(container).div({ class: 'dialogModal-body' }, (bodyBuilder) => {
			this._body = bodyBuilder.getHTMLElement();
		});

		this._wizard.pages.forEach(page => {
			this.registerPage(page);
		});
		this._wizard.onPageAdded(page => {
			this.registerPage(page);
			this.showPage(this.getCurrentPage(), false);
		});
		this._wizard.onPageRemoved(page => {
			let dialogPane = this._dialogPanes.get(page);
			this._dialogPanes.delete(page);
			this.showPage(this.getCurrentPage(), false);
			dialogPane.dispose();
		});
	}

	private registerPage(page: WizardPage): void {
		let dialogPane = new DialogPane(page.title, page.content, valid => page.notifyValidityChanged(valid), this._instantiationService);
		dialogPane.createBody(this._body);
		this._dialogPanes.set(page, dialogPane);
		page.onUpdate(() => this.setButtonsForPage(this._wizard.currentPage));
	}

	private async showPage(index: number, validate: boolean = true): Promise<void> {
		let pageToShow = this._wizard.pages[index];
		if (!pageToShow) {
			this.done(validate);
			return;
		}
		if (validate && !await this._wizard.validateNavigation(index)) {
			return;
		}
		this._dialogPanes.forEach((dialogPane, page) => {
			if (page === pageToShow) {
				dialogPane.show();
			} else {
				dialogPane.hide();
			}
		});
		this.setButtonsForPage(index);
		this._wizard.setCurrentPage(index);
	}

	private setButtonsForPage(index: number) {
		if (this._wizard.pages[index - 1]) {
			this._previousButton.element.parentElement.classList.remove('dialogModal-hidden');
			this._previousButton.enabled = this._wizard.pages[index - 1].enabled;
		} else {
			this._previousButton.element.parentElement.classList.add('dialogModal-hidden');
		}

		if (this._wizard.pages[index + 1]) {
			this._nextButton.element.parentElement.classList.remove('dialogModal-hidden');
			this._nextButton.enabled = this._wizard.pages[index + 1].enabled;
			this._doneButton.element.parentElement.classList.add('dialogModal-hidden');
		} else {
			this._nextButton.element.parentElement.classList.add('dialogModal-hidden');
			this._doneButton.element.parentElement.classList.remove('dialogModal-hidden');
		}
	}

	private getCurrentPage(): number {
		return this._wizard.currentPage;
	}

	public open(): void {
		this.showPage(0, false);
		this.show();
	}

	public async done(validate: boolean = true): Promise<void> {
		if (this._wizard.doneButton.enabled) {
			if (validate && !await this._wizard.validateNavigation(undefined)) {
				return;
			}
			this._onDone.fire();
			this.dispose();
			this.hide();
		}
	}

	public cancel(): void {
		this._onCancel.fire();
		this.dispose();
		this.hide();
	}

	protected hide(): void {
		super.hide();
	}

	protected show(): void {
		super.show();
	}

	/**
	 * Overridable to change behavior of escape key
	 */
	protected onClose(e: StandardKeyboardEvent) {
		this.cancel();
	}

	/**
	 * Overridable to change behavior of enter key
	 */
	protected onAccept(e: StandardKeyboardEvent) {
		this.done();
	}

	public dispose(): void {
		super.dispose();
		this._dialogPanes.forEach(dialogPane => dialogPane.dispose());
	}
}