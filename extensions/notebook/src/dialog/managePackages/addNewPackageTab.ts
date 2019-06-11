/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from 'vscode-nls';
import * as azdata from 'azdata';
import * as request from 'request';

import JupyterServerInstallation from '../../jupyter/jupyterServerInstallation';
import * as utils from '../../common/utils';
import { ManagePackagesDialog } from './managePackagesDialog';

const localize = nls.loadMessageBundle();

export class AddNewPackageTab {
	private addNewPkgTab: azdata.window.DialogTab;

	private newPackagesSearchBar: azdata.InputBoxComponent;
	private packagesSearchButton: azdata.ButtonComponent;
	private newPackagesName: azdata.TextComponent;
	private newPackagesNameLoader: azdata.LoadingComponent;
	private newPackagesVersions: azdata.DropDownComponent;
	private newPackagesVersionsLoader: azdata.LoadingComponent;
	private newPackagesSummary: azdata.TextComponent;
	private newPackagesSummaryLoader: azdata.LoadingComponent;
	private packageInstallButton: azdata.ButtonComponent;

	private readonly InvalidTextPlaceholder = localize('managePackages.invalidTextPlaceholder', "N/A");

	constructor(private dialog: ManagePackagesDialog, private jupyterInstallation: JupyterServerInstallation) {
		this.addNewPkgTab = azdata.window.createTab(localize('managePackages.addNewTabTitle', "Add new"));

		this.addNewPkgTab.registerContent(async view => {
			this.newPackagesSearchBar = view.modelBuilder.inputBox()
				.withProperties<azdata.InputBoxProperties>({
					placeHolder: localize('managePackages.searchBarPlaceholder', "Search for packages")
				}).component();

			this.packagesSearchButton = view.modelBuilder.button()
				.withProperties<azdata.ButtonProperties>({
					label: localize('managePackages.searchButtonLabel', "Search"),
					width: '80px'
				}).component();
			this.packagesSearchButton.onDidClick(() => {
				this.loadNewPackageInfo();
			});

			this.newPackagesName = view.modelBuilder.text().withProperties({
				value: this.InvalidTextPlaceholder
			}).component();
			this.newPackagesNameLoader = view.modelBuilder.loadingComponent()
				.withItem(this.newPackagesName)
				.withProperties({ loading: false })
				.component();

			this.newPackagesVersions = view.modelBuilder.dropDown().withProperties({
				value: this.InvalidTextPlaceholder,
				values: [this.InvalidTextPlaceholder]
			}).component();
			this.newPackagesVersionsLoader = view.modelBuilder.loadingComponent()
				.withItem(this.newPackagesVersions)
				.withProperties({ loading: false })
				.component();

			this.newPackagesSummary = view.modelBuilder.text().withProperties({
				value: this.InvalidTextPlaceholder
			}).component();
			this.newPackagesSummaryLoader = view.modelBuilder.loadingComponent()
				.withItem(this.newPackagesSummary)
				.withProperties({ loading: false })
				.component();

			this.packageInstallButton = view.modelBuilder.button().withProperties({
				label: localize('managePackages.installButtonText', "Install"),
				enabled: false,
				width: '80px'
			}).component();
			this.packageInstallButton.onDidClick(() => {
				this.doPackageInstall();
			});

			let formModel = view.modelBuilder.formContainer()
				.withFormItems([{
					component: this.newPackagesSearchBar,
					title: ''
				}, {
					component: this.packagesSearchButton,
					title: ''
				}, {
					component: this.newPackagesNameLoader,
					title: localize('managePackages.packageNameTitle', "Package Name")
				}, {
					component: this.newPackagesVersionsLoader,
					title: localize('managePackages.packageVersionTitle', "Package Version")
				}, {
					component: this.newPackagesSummaryLoader,
					title: localize('managePackages.packageSummaryTitle', "Package Summary")
				}, {
					component: this.packageInstallButton,
					title: ''
				}]).component();

			await view.initializeModel(formModel);
		});
	}

	public get tab(): azdata.window.DialogTab {
		return this.addNewPkgTab;
	}

	private async toggleNewPackagesFields(enable: boolean): Promise<void> {
		await this.packagesSearchButton.updateProperties({ enabled: enable });
		await this.newPackagesNameLoader.updateProperties({ loading: !enable });
		await this.newPackagesVersionsLoader.updateProperties({ loading: !enable });
		await this.newPackagesSummaryLoader.updateProperties({ loading: !enable });
	}

	private async loadNewPackageInfo(): Promise<void> {
		await this.packageInstallButton.updateProperties({ enabled: false });
		await this.toggleNewPackagesFields(false);
		try {
			let packageName = this.newPackagesSearchBar.value;
			if (!packageName || packageName.length === 0) {
				return;
			}

			let pipPackage = await this.fetchPypiPackage(packageName);
			if (!pipPackage.versions || pipPackage.versions.length === 0) {
				this.dialog.showErrorMessage(
					localize('managePackages.noVersionsFound',
						"Could not find any valid versions for the specified package"));
				return;
			}

			await this.newPackagesName.updateProperties({
				value: packageName
			});
			await this.newPackagesVersions.updateProperties({
				values: pipPackage.versions,
				value: pipPackage.versions[0],
			});
			await this.newPackagesSummary.updateProperties({
				value: pipPackage.summary
			});

			// Only re-enable install on success
			await this.packageInstallButton.updateProperties({ enabled: true });
		} catch (err) {
			this.dialog.showErrorMessage(utils.getErrorMessage(err));

			await this.newPackagesName.updateProperties({
				value: this.InvalidTextPlaceholder
			});
			await this.newPackagesVersions.updateProperties({
				value: this.InvalidTextPlaceholder,
				values: [this.InvalidTextPlaceholder],
			});
			await this.newPackagesSummary.updateProperties({
				value: this.InvalidTextPlaceholder
			});
		} finally {
			await this.toggleNewPackagesFields(true);
		}
	}

	private async fetchPypiPackage(packageName: string): Promise<PipPackageData> {
		return new Promise<PipPackageData>((resolve, reject) => {
			request.get(`https://pypi.org/pypi/${packageName}/json`, { timeout: 10000 }, (error, response, body) => {
				if (error) {
					return reject(error);
				}

				if (response.statusCode === 404) {
					return reject(localize('managePackages.packageNotFound', "Could not find the specified package"));
				}

				if (response.statusCode !== 200) {
					return reject(
						localize('managePackages.packageRequestError',
							"Package info request failed with error: {0} {1}",
							response.statusCode,
							response.statusMessage));
				}

				let versionNums: string[] = [];
				let packageSummary = '';

				let packagesJson = JSON.parse(body);
				if (packagesJson) {
					if (packagesJson.releases) {
						let versionKeys = Object.keys(packagesJson.releases);
						versionKeys = versionKeys.filter(versionKey => {
							let releaseInfo = packagesJson.releases[versionKey];
							return Array.isArray(releaseInfo) && releaseInfo.length > 0;
						});
						versionKeys.sort((first, second) => {
							// sort in descending order
							let firstVersion = first.split('.').map(numStr => Number.parseInt(numStr));
							let secondVersion = second.split('.').map(numStr => Number.parseInt(numStr));

							// If versions have different lengths, then append zeroes to the shorter one
							if (firstVersion.length > secondVersion.length) {
								let diff = firstVersion.length - secondVersion.length;
								secondVersion = secondVersion.concat(new Array(diff).fill(0));
							} else if (secondVersion.length > firstVersion.length) {
								let diff = secondVersion.length - firstVersion.length;
								firstVersion = firstVersion.concat(new Array(diff).fill(0));
							}

							for (let i = 0; i < firstVersion.length; ++i) {
								if (firstVersion[i] > secondVersion[i]) {
									return -1;
								} else if (firstVersion[i] < secondVersion[i]) {
									return 1;
								}
							}
							return 0;
						});
						versionNums = versionKeys;
					}

					if (packagesJson.info && packagesJson.info.summary) {
						packageSummary = packagesJson.info.summary;
					}
				}

				resolve({
					name: packageName,
					versions: versionNums,
					summary: packageSummary
				});
			});
		});
	}

	private async doPackageInstall(): Promise<void> {
		let packageName = this.newPackagesName.value;
		let packageVersion = this.newPackagesVersions.value as string;
		if (!packageName || packageName.length === 0 ||
			!packageVersion || packageVersion.length === 0) {
			return;
		}

		let taskName = localize('managePackages.backgroundInstallStarted',
			"Installing {0} {1}",
			packageName,
			packageVersion);
		this.jupyterInstallation.apiWrapper.startBackgroundOperation({
			displayName: taskName,
			description: taskName,
			isCancelable: false,
			operation: op => {
				this.jupyterInstallation.installPipPackage(packageName, packageVersion)
					.then(async () => {
						let installMsg = localize('managePackages.backgroundInstallComplete',
							"Completed install for {0} {1}",
							packageName,
							packageVersion);

						op.updateStatus(azdata.TaskStatus.Succeeded, installMsg);
						this.jupyterInstallation.outputChannel.appendLine(installMsg);

						await this.dialog.refreshInstalledPackages();
					})
					.catch(err => {
						let installFailedMsg = localize('managePackages.backgroundInstallFailed',
							"Failed to install {0} {1}. Error: {2}",
							packageName,
							packageVersion,
							utils.getErrorMessage(err));

						op.updateStatus(azdata.TaskStatus.Failed, installFailedMsg);
						this.jupyterInstallation.outputChannel.appendLine(installFailedMsg);
					});
			}
		});
	}
}

interface PipPackageData {
	name: string;
	versions: string[];
	summary: string;
}