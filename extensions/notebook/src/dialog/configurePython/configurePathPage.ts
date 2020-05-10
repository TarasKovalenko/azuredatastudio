/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as azdata from 'azdata';
import { BasePage } from './basePage';
import * as nls from 'vscode-nls';
import { JupyterServerInstallation } from '../../jupyter/jupyterServerInstallation';
import { PythonPathInfo } from '../pythonPathLookup';
import * as utils from '../../common/utils';

const localize = nls.loadMessageBundle();

export class ConfigurePathPage extends BasePage {
	private readonly BrowseButtonText = localize('configurePython.browseButtonText', "Browse");
	private readonly LocationTextBoxTitle = localize('configurePython.locationTextBoxText', "Python Install Location");
	private readonly SelectFileLabel = localize('configurePython.selectFileLabel', "Select");

	private pythonLocationDropdown: azdata.DropDownComponent;
	private pythonDropdownLoader: azdata.LoadingComponent;
	private browseButton: azdata.ButtonComponent;
	private newInstallButton: azdata.RadioButtonComponent;
	private existingInstallButton: azdata.RadioButtonComponent;

	private usingCustomPath: boolean = false;

	public async initialize(): Promise<boolean> {
		this.pythonLocationDropdown = this.view.modelBuilder.dropDown()
			.withProperties<azdata.DropDownProperties>({
				value: undefined,
				values: [],
				width: '100%'
			}).component();
		this.pythonDropdownLoader = this.view.modelBuilder.loadingComponent()
			.withItem(this.pythonLocationDropdown)
			.withProperties<azdata.LoadingComponentProperties>({
				loading: false
			})
			.component();

		this.browseButton = this.view.modelBuilder.button()
			.withProperties<azdata.ButtonProperties>({
				label: this.BrowseButtonText,
				width: '70px'
			}).component();
		this.browseButton.onDidClick(() => this.handleBrowse());

		this.createInstallRadioButtons(this.view.modelBuilder, this.model.useExistingPython);

		let formModel = this.view.modelBuilder.formContainer()
			.withFormItems([{
				component: this.newInstallButton,
				title: localize('configurePython.installationType', "Installation Type")
			}, {
				component: this.existingInstallButton,
				title: ''
			}, {
				component: this.pythonDropdownLoader,
				title: this.LocationTextBoxTitle
			}, {
				component: this.browseButton,
				title: ''
			}]).component();

		await this.view.initializeModel(formModel);

		await this.updatePythonPathsDropdown(this.model.useExistingPython);

		return true;
	}

	public async onPageEnter(): Promise<void> {
	}

	public async onPageLeave(): Promise<boolean> {
		let pythonLocation = utils.getDropdownValue(this.pythonLocationDropdown);
		if (!pythonLocation || pythonLocation.length === 0) {
			this.instance.showErrorMessage(this.instance.InvalidLocationMsg);
			return false;
		}

		this.model.pythonLocation = pythonLocation;
		this.model.useExistingPython = !!this.existingInstallButton.checked;

		return true;
	}

	private async updatePythonPathsDropdown(useExistingPython: boolean): Promise<void> {
		this.pythonDropdownLoader.loading = true;
		try {
			let pythonPaths: PythonPathInfo[];
			let dropdownValues: azdata.CategoryValue[];
			if (useExistingPython) {
				pythonPaths = await this.model.pythonPathsPromise;
				if (pythonPaths && pythonPaths.length > 0) {
					dropdownValues = pythonPaths.map(path => {
						return {
							displayName: localize('configurePythyon.dropdownPathLabel', "{0} (Python {1})", path.installDir, path.version),
							name: path.installDir
						};
					});
				} else {
					dropdownValues = [{
						displayName: localize('configurePythyon.noVersionsFound', "No supported Python versions found."),
						name: ''
					}];
				}
			} else {
				let defaultPath = JupyterServerInstallation.DefaultPythonLocation;
				dropdownValues = [{
					displayName: localize('configurePythyon.defaultPathLabel', "{0} (Default)", defaultPath),
					name: defaultPath
				}];
			}

			this.usingCustomPath = false;
			await this.pythonLocationDropdown.updateProperties({
				value: dropdownValues[0],
				values: dropdownValues
			});
		} finally {
			this.pythonDropdownLoader.loading = false;
		}
	}

	private createInstallRadioButtons(modelBuilder: azdata.ModelBuilder, useExistingPython: boolean): void {
		let buttonGroup = 'installationType';
		this.newInstallButton = modelBuilder.radioButton()
			.withProperties<azdata.RadioButtonProperties>({
				name: buttonGroup,
				label: localize('configurePython.newInstall', "New Python installation"),
				checked: !useExistingPython
			}).component();
		this.newInstallButton.onDidClick(() => {
			this.updatePythonPathsDropdown(false)
				.catch(err => {
					this.instance.showErrorMessage(utils.getErrorMessage(err));
				});
		});

		this.existingInstallButton = modelBuilder.radioButton()
			.withProperties<azdata.RadioButtonProperties>({
				name: buttonGroup,
				label: localize('configurePython.existingInstall', "Use existing Python installation"),
				checked: useExistingPython
			}).component();
		this.existingInstallButton.onDidClick(() => {
			this.updatePythonPathsDropdown(true)
				.catch(err => {
					this.instance.showErrorMessage(utils.getErrorMessage(err));
				});
		});
	}

	private async handleBrowse(): Promise<void> {
		let options: vscode.OpenDialogOptions = {
			defaultUri: vscode.Uri.file(utils.getUserHome()),
			canSelectFiles: false,
			canSelectFolders: true,
			canSelectMany: false,
			openLabel: this.SelectFileLabel
		};

		let fileUris: vscode.Uri[] = await this.apiWrapper.showOpenDialog(options);
		if (fileUris?.length > 0 && fileUris[0]) {
			let existingValues = <azdata.CategoryValue[]>this.pythonLocationDropdown.values;
			let filePath = fileUris[0].fsPath;
			let newValue = {
				displayName: localize('configurePythyon.customPathLabel', "{0} (Custom)", filePath),
				name: filePath
			};

			if (this.usingCustomPath) {
				existingValues[0] = newValue;
			} else {
				existingValues.unshift(newValue);
				this.usingCustomPath = true;
			}

			await this.pythonLocationDropdown.updateProperties({
				value: existingValues[0],
				values: existingValues
			});
		}
	}
}
