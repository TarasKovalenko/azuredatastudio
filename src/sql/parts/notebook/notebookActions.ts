/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as sqlops from 'sqlops';

import { Action } from 'vs/base/common/actions';
import { TPromise } from 'vs/base/common/winjs.base';
import { localize } from 'vs/nls';
import { IContextViewProvider } from 'vs/base/browser/ui/contextview/contextview';
import { INotificationService, Severity, INotificationActions } from 'vs/platform/notification/common/notification';

import { SelectBox, ISelectBoxOptionsWithLabel } from 'sql/base/browser/ui/selectBox/selectBox';
import { INotebookModel } from 'sql/parts/notebook/models/modelInterfaces';
import { CellType } from 'sql/parts/notebook/models/contracts';
import { NotebookComponent } from 'sql/parts/notebook/notebook.component';
import { getErrorMessage } from 'sql/parts/notebook/notebookUtils';
import { IConnectionManagementService, IConnectionDialogService } from 'sql/platform/connection/common/connectionManagement';
import { ICapabilitiesService } from 'sql/platform/capabilities/common/capabilitiesService';
import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import { noKernel } from 'sql/workbench/services/notebook/common/sessionManager';

const msgLoading = localize('loading', 'Loading kernels...');
const kernelLabel: string = localize('Kernel', 'Kernel: ');
const attachToLabel: string = localize('AttachTo', 'Attach to: ');
const msgLoadingContexts = localize('loadingContexts', 'Loading contexts...');
const msgAddNewConnection = localize('addNewConnection', 'Add new connection');
const msgSelectConnection = localize('selectConnection', 'Select connection');
const msgLocalHost = localize('localhost', 'localhost');

// Action to add a cell to notebook based on cell type(code/markdown).
export class AddCellAction extends Action {
	public cellType: CellType;

	constructor(
		id: string, label: string, cssClass: string
	) {
		super(id, label, cssClass);
	}
	public run(context: NotebookComponent): TPromise<boolean> {
		return new TPromise<boolean>((resolve, reject) => {
			try {
				context.addCell(this.cellType);
				resolve(true);
			} catch (e) {
				reject(e);
			}
		});
	}
}

export class SaveNotebookAction extends Action {
	private static readonly notebookSavedMsg = localize('notebookSavedMsg', 'Notebook saved successfully.');
	private static readonly notebookFailedSaveMsg = localize('notebookFailedSaveMsg', 'Failed to save Notebook.');
	constructor(
		id: string, label: string, cssClass: string,
		@INotificationService private _notificationService: INotificationService
	) {
		super(id, label, cssClass);
	}

	public async run(context: NotebookComponent): TPromise<boolean> {
		const actions: INotificationActions = { primary: [] };
		let saved = await context.save();
		if (saved) {
			this._notificationService.notify({ severity: Severity.Info, message: SaveNotebookAction.notebookSavedMsg, actions });
		}
		return saved;
	}
}

export interface IToggleableState {
	baseClass?: string;
	shouldToggleTooltip?: boolean;
	toggleOnClass: string;
	toggleOnLabel: string;
	toggleOffLabel: string;
	toggleOffClass: string;
	isOn: boolean;
}

export abstract class ToggleableAction extends Action {

	constructor(id: string, protected state: IToggleableState) {
		super(id, '');
		this.updateLabelAndIcon();
	}

	private updateLabelAndIcon() {
		if (this.state.shouldToggleTooltip) {
			this.tooltip = this.state.isOn ? this.state.toggleOnLabel : this.state.toggleOffLabel;
		} else {
			this.label = this.state.isOn ? this.state.toggleOnLabel : this.state.toggleOffLabel;
		}
		let classes = this.state.baseClass ? `${this.state.baseClass} ` : '';
		classes += this.state.isOn ? this.state.toggleOnClass : this.state.toggleOffClass;
		this.class = classes;
	}

	protected toggle(isOn: boolean): void {
		this.state.isOn = isOn;
		this.updateLabelAndIcon();
	}
}

export class TrustedAction extends ToggleableAction {
	// Constants
	private static readonly trustedLabel = localize('trustLabel', 'Trusted');
	private static readonly notTrustedLabel = localize('untrustLabel', 'Not Trusted');
	private static readonly alreadyTrustedMsg = localize('alreadyTrustedMsg', 'Notebook is already trusted.');
	private static readonly baseClass = 'notebook-button';
	private static readonly trustedCssClass = 'icon-trusted';
	private static readonly notTrustedCssClass = 'icon-notTrusted';

	// Properties

	constructor(
		id: string,
		@INotificationService private _notificationService: INotificationService
	) {
		super(id, {
			baseClass: TrustedAction.baseClass,
			toggleOnLabel: TrustedAction.trustedLabel,
			toggleOnClass: TrustedAction.trustedCssClass,
			toggleOffLabel: TrustedAction.notTrustedLabel,
			toggleOffClass: TrustedAction.notTrustedCssClass,
			isOn: false
		});
	}

	public get trusted(): boolean {
		return this.state.isOn;
	}
	public set trusted(value: boolean) {
		this.toggle(value);
	}

	public run(context: NotebookComponent): TPromise<boolean> {
		let self = this;
		return new TPromise<boolean>((resolve, reject) => {
			try {
				if (self.trusted) {
					const actions: INotificationActions = { primary: [] };
					self._notificationService.notify({ severity: Severity.Info, message: TrustedAction.alreadyTrustedMsg, actions });
				}
				else {
					self.trusted = !self.trusted;
					context.updateModelTrustDetails(self.trusted);
				}
				resolve(true);
			} catch (e) {
				reject(e);
			}
		});
	}
}

export class KernelsDropdown extends SelectBox {
	private model: INotebookModel;
	constructor(container: HTMLElement, contextViewProvider: IContextViewProvider, modelRegistered: Promise<INotebookModel>
	) {
		let selectBoxOptionsWithLabel: ISelectBoxOptionsWithLabel = {
			labelText: kernelLabel,
			labelOnTop: false
		};
		super([msgLoading], msgLoading, contextViewProvider, container, selectBoxOptionsWithLabel);
		if (modelRegistered) {
			modelRegistered
				.then((model) => this.updateModel(model))
				.catch((err) => {
					// No-op for now
				});
		}

		this.onDidSelect(e => this.doChangeKernel(e.selected));
	}

	updateModel(model: INotebookModel): void {
		this.model = model;
		model.kernelsChanged((defaultKernel) => {
			this.updateKernel(defaultKernel);
		});
		if (model.clientSession) {
			model.clientSession.kernelChanged((changedArgs: sqlops.nb.IKernelChangedArgs) => {
				if (changedArgs.newValue) {
					this.updateKernel(changedArgs.newValue);
				}
			});
		}
	}

	// Update SelectBox values
	private updateKernel(defaultKernel: sqlops.nb.IKernelSpec) {
		let specs = this.model.specs;
		if (specs && specs.kernels) {
			let index = specs.kernels.findIndex((kernel => kernel.name === defaultKernel.name));
			this.setOptions(specs.kernels.map(kernel => kernel.display_name), index);
		}
	}

	public doChangeKernel(displayName: string): void {
		this.model.changeKernel(displayName);
	}
}

export class AttachToDropdown extends SelectBox {
	private model: INotebookModel;

	constructor(container: HTMLElement, contextViewProvider: IContextViewProvider, modelRegistered: Promise<INotebookModel>,
		@IConnectionManagementService private _connectionManagementService: IConnectionManagementService,
		@IConnectionDialogService private _connectionDialogService: IConnectionDialogService,
		@INotificationService private _notificationService: INotificationService,
		@ICapabilitiesService private _capabilitiesService: ICapabilitiesService) {
		super([msgLoadingContexts], msgLoadingContexts, contextViewProvider, container, { labelText: attachToLabel, labelOnTop: false } as ISelectBoxOptionsWithLabel);
		if (modelRegistered) {
			modelRegistered
				.then((model) => this.updateModel(model))
				.catch((err) => {
					// No-op for now
				});
		}
		this.onDidSelect(e => {
			let connection = this.model.contexts.otherConnections.find((c) => c.serverName === e.selected);
			this.doChangeContext(new ConnectionProfile(this._capabilitiesService, connection));
		});
	}

	public updateModel(model: INotebookModel): void {
		this.model = model;
		model.contextsChanged(() => {
			if (this.model.clientSession.kernel && this.model.clientSession.kernel.name) {
				let nameLower = this.model.clientSession.kernel.name.toLowerCase();
				let currentKernelSpec = this.model.specs.kernels.find(kernel => kernel.name && kernel.name.toLowerCase() === nameLower);
				this.loadAttachToDropdown(this.model, currentKernelSpec.display_name);
			}
		});
	}

	// Load "Attach To" dropdown with the values corresponding to Kernel dropdown
	public async loadAttachToDropdown(model: INotebookModel, currentKernel: string): Promise<void> {
		let connProviderIds = this.model.getApplicableConnectionProviderIds(currentKernel);
		if ((connProviderIds && connProviderIds.length === 0) || currentKernel === noKernel) {
			this.setOptions([msgLocalHost]);
		}
		else {
			let connections = this.getConnections(model);
			this.enable();
			if (connections.length === 1 && connections[0] === msgAddNewConnection) {
				connections.unshift(msgSelectConnection);
				this.selectWithOptionName(msgSelectConnection);
			}
			else {
				connections.push(msgAddNewConnection);
			}
			this.setOptions(connections);
		}

	}

	//Get connections from context
	public getConnections(model: INotebookModel): string[] {
		let otherConnections: ConnectionProfile[] = [];
		model.contexts.otherConnections.forEach((conn) => { otherConnections.push(conn); });
		this.selectWithOptionName(model.contexts.defaultConnection.serverName);
		otherConnections = this.setConnectionsList(model.contexts.defaultConnection, model.contexts.otherConnections);
		let connections = otherConnections.map((context) => context.serverName);
		return connections;
	}

	private setConnectionsList(defaultConnection: ConnectionProfile, otherConnections: ConnectionProfile[]) {
		if (defaultConnection.serverName !== msgSelectConnection) {
			otherConnections = otherConnections.filter(conn => conn.serverName !== defaultConnection.serverName);
			otherConnections.unshift(defaultConnection);
			if (otherConnections.length > 1) {
				otherConnections = otherConnections.filter(val => val.serverName !== msgSelectConnection);
			}
		}
		return otherConnections;
	}

	public doChangeContext(connection?: ConnectionProfile): void {
		if (this.value === msgAddNewConnection) {
			this.openConnectionDialog();
		} else {
			this.model.changeContext(this.value, connection).then(ok => undefined, err => this._notificationService.error(getErrorMessage(err)));
		}
	}

	/**
	 * Open connection dialog
	 * Enter server details and connect to a server from the dialog
	 * Bind the server value to 'Attach To' drop down
	 * Connected server is displayed at the top of drop down
	 **/
	public async openConnectionDialog(): Promise<void> {
		try {
			await this._connectionDialogService.openDialogAndWait(this._connectionManagementService, { connectionType: 1, providers: this.model.getApplicableConnectionProviderIds(this.model.clientSession.kernel.name) }).then(connection => {
				let attachToConnections = this.values;
				if (!connection) {
					this.loadAttachToDropdown(this.model, this.model.clientSession.kernel.name);
					return;
				}
				let connectionProfile = new ConnectionProfile(this._capabilitiesService, connection);
				let connectedServer = connectionProfile.serverName;
				//Check to see if the same server is already there in dropdown. We only have server names in dropdown
				if (attachToConnections.some(val => val === connectedServer)) {
					this.loadAttachToDropdown(this.model, this.model.clientSession.kernel.name);
					this.doChangeContext();
					return;
				}
				else {
					attachToConnections.unshift(connectedServer);
				}
				//To ignore n/a after we have at least one valid connection
				attachToConnections = attachToConnections.filter(val => val !== msgSelectConnection);

				let index = attachToConnections.findIndex((connection => connection === connectedServer));
				this.setOptions([]);
				this.setOptions(attachToConnections);
				if (!index || index < 0 || index >= attachToConnections.length) {
					index = 0;
				}
				this.select(index);

				// Call doChangeContext to set the newly chosen connection in the model
				this.doChangeContext(connectionProfile);
			});
		}
		catch (error) {
			const actions: INotificationActions = { primary: [] };
			this._notificationService.notify({ severity: Severity.Error, message: getErrorMessage(error), actions });
		}
	}
}