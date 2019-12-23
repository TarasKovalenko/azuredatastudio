/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { JupyterServerInstallation } from '../../jupyter/jupyterServerInstallation';
import { IPackageManageProvider, IPackageDetails, IPackageOverview } from '../../types';

export interface ManagePackageDialogOptions {
	multiLocations: boolean;
	defaultLocation?: string;
	defaultProviderId?: string;
}

export interface ProviderPackageType {
	packageType: string;
	providerId: string;
}

/**
 * Manage package dialog model
 */
export class ManagePackagesDialogModel {

	private _currentProvider: string;

	/**
	 * A set for locations
	 */
	private _locations: Set<string> = new Set<string>();

	/**
	 * Map of locations to providers
	 */
	private _packageTypes: Map<string, IPackageManageProvider[]> = new Map<string, IPackageManageProvider[]>();

	/**
	 * Creates new instance of the model
	 * @param _jupyterInstallation Jupyter installation
	 * @param _packageManageProviders package manage providers
	 * @param _options dialog options
	 */
	constructor(
		private _jupyterInstallation: JupyterServerInstallation,
		private _packageManageProviders: Map<string, IPackageManageProvider>,
		private _options?: ManagePackageDialogOptions) {

		if (!this._packageManageProviders || this._packageManageProviders.size === 0) {
			throw Error('Invalid list of package manager providers');
		}
	}

	/**
	 * Initialized the model
	 */
	public async init(): Promise<void> {
		await this.loadCaches();
		this.loadOptions();
		this.changeProvider(this.defaultProviderId);
	}

	/**
	 * Loads the model options
	 */
	private loadOptions(): void {

		// Set Default Options
		//
		if (!this._options) {
			this._options = this.defaultOptions;
		}

		if (this._options.defaultLocation && !this._packageTypes.has(this._options.defaultLocation)) {
			throw new Error(`Invalid default location '${this._options.defaultLocation}`);
		}

		if (this._options.defaultProviderId && !this._packageManageProviders.has(this._options.defaultProviderId)) {
			throw new Error(`Invalid default provider id '${this._options.defaultProviderId}`);
		}

		if (!this._options.multiLocations && !this.defaultLocation) {
			throw new Error('Default location not specified for single location mode');
		}
	}

	private get defaultOptions(): ManagePackageDialogOptions {
		return {
			multiLocations: true,
			defaultLocation: undefined,
			defaultProviderId: undefined
		};
	}

	/**
	 * Returns the providers map
	 */
	public get packageManageProviders(): Map<string, IPackageManageProvider> {
		return this._packageManageProviders;
	}

	/**
	 * Returns the current provider
	 */
	public get currentPackageManageProvider(): IPackageManageProvider | undefined {
		if (this._currentProvider) {
			let provider = this._packageManageProviders.get(this._currentProvider);
			return provider;
		}
		return undefined;
	}

	/**
	 * Returns the current provider
	 */
	public get currentPackageType(): string | undefined {
		if (this._currentProvider) {
			let provider = this._packageManageProviders.get(this._currentProvider);
			return provider.packageTarget.packageType;
		}
		return undefined;
	}

	/**
	 * Returns true if multi locations mode is enabled
	 */
	public get multiLocationMode(): boolean {
		return this.options.multiLocations;
	}

	/**
	 * Returns options
	 */
	public get options(): ManagePackageDialogOptions {
		return this._options || this.defaultOptions;
	}

	/**
	 * returns the array of target locations
	 */
	public get targetLocations(): string[] {
		return Array.from(this._locations.keys());
	}

	/**
	 * Returns the default location
	 */
	public get defaultLocation(): string {
		return this.options.defaultLocation || this.targetLocations[0];
	}

	/**
	 * Returns the default location
	 */
	public get defaultProviderId(): string {
		return this.options.defaultProviderId || Array.from(this.packageManageProviders.keys())[0];
	}

	/**
	 * Loads the provider cache
	 */
	private async loadCaches(): Promise<void> {
		if (this.packageManageProviders) {
			let keyArray = Array.from(this.packageManageProviders.keys());
			for (let index = 0; index < keyArray.length; index++) {
				const element = this.packageManageProviders.get(keyArray[index]);
				if (await element.canUseProvider()) {
					if (!this._locations.has(element.packageTarget.location)) {
						this._locations.add(element.packageTarget.location);
					}
					if (!this._packageTypes.has(element.packageTarget.location)) {
						this._packageTypes.set(element.packageTarget.location, []);
					}
					this._packageTypes.get(element.packageTarget.location).push(element);
				}
			}
		}
	}

	/**
	 * Returns a map of providerId to package types for given location
	 */
	public getPackageTypes(targetLocation?: string): ProviderPackageType[] {
		targetLocation = targetLocation || this.defaultLocation;
		let providers = this._packageTypes.get(targetLocation);
		return providers.map(x => {
			return {
				providerId: x.providerId,
				packageType: x.packageTarget.packageType
			};
		});
	}

	/**
	 * Returns a map of providerId to package types for given location
	 */
	public getDefaultPackageType(): ProviderPackageType {
		let defaultProviderId = this.defaultProviderId;
		let packageTypes = this.getPackageTypes();
		return packageTypes.find(x => x.providerId === defaultProviderId);
	}

	/**
	 * returns the list of packages for current provider
	 */
	public async listPackages(): Promise<IPackageDetails[]> {
		let provider = this.currentPackageManageProvider;
		if (provider) {
			return await provider.listPackages();
		} else {
			throw new Error('Current Provider is not set');
		}
	}

	/**
	 * Changes the current provider
	 */
	public changeProvider(providerId: string): void {
		if (this._packageManageProviders.has(providerId)) {
			this._currentProvider = providerId;
		} else {
			throw Error(`Invalid package type ${providerId}`);
		}
	}

	/**
	 * Installs given packages using current provider
	 * @param packages Packages to install
	 */
	public async installPackages(packages: IPackageDetails[]): Promise<void> {
		let provider = this.currentPackageManageProvider;
		if (provider) {
			await provider.installPackages(packages, false);
		} else {
			throw new Error('Current Provider is not set');
		}
	}

	/**
	 * Returns the location title for current provider
	 */
	public async getLocationTitle(): Promise<string | undefined> {
		let provider = this.currentPackageManageProvider;
		if (provider) {
			return await provider.getLocationTitle();
		}
		return Promise.resolve(undefined);
	}

	/**
	 * UnInstalls given packages using current provider
	 * @param packages Packages to install
	 */
	public async uninstallPackages(packages: IPackageDetails[]): Promise<void> {
		let provider = this.currentPackageManageProvider;
		if (provider) {
			await provider.uninstallPackages(packages);
		} else {
			throw new Error('Current Provider is not set');
		}
	}

	/**
	 * Returns package preview for given name
	 * @param packageName Package name
	 */
	public async getPackageOverview(packageName: string): Promise<IPackageOverview> {
		let provider = this.currentPackageManageProvider;
		if (provider) {
			return await provider.getPackageOverview(packageName);
		} else {
			throw new Error('Current Provider is not set');
		}
	}

	/**
	 * Returns the jupyterInstallation instance
	 */
	public get jupyterInstallation(): JupyterServerInstallation {
		return this._jupyterInstallation;
	}
}
