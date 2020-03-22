/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

import * as nbExtensionApis from '../typings/notebookServices';
import * as mssql from '../../../mssql';
import { PackageManager } from '../packageManagement/packageManager';
import * as constants from '../common/constants';
import { ApiWrapper } from '../common/apiWrapper';
import { QueryRunner } from '../common/queryRunner';
import { ProcessService } from '../common/processService';
import { Config } from '../configurations/config';
import { PackageManagementService } from '../packageManagement/packageManagementService';
import { HttpClient } from '../common/httpClient';
import { LanguageController } from '../views/externalLanguages/languageController';
import { LanguageService } from '../externalLanguage/languageService';
import { ModelManagementController } from '../views/models/modelManagementController';
import { RegisteredModelService } from '../modelManagement/registeredModelService';
import { AzureModelRegistryService } from '../modelManagement/azureModelRegistryService';
import { ModelImporter } from '../modelManagement/modelImporter';
import { PredictService } from '../prediction/predictService';

/**
 * The main controller class that initializes the extension
 */
export default class MainController implements vscode.Disposable {
	private _outputChannel: vscode.OutputChannel;
	private _rootPath = this._context.extensionPath;
	private _config: Config;

	public constructor(
		private _context: vscode.ExtensionContext,
		private _apiWrapper: ApiWrapper,
		private _queryRunner: QueryRunner,
		private _processService: ProcessService,
		private _packageManager?: PackageManager,
		private _packageManagementService?: PackageManagementService,
		private _httpClient?: HttpClient
	) {
		this._outputChannel = this._apiWrapper.createOutputChannel(constants.extensionOutputChannel);
		this._rootPath = this._context.extensionPath;
		this._config = new Config(this._rootPath, this._apiWrapper);
	}

	/**
	 * Deactivates the extension
	 */
	public deactivate(): void {
	}

	/**
	 * Activates the extension
	 */
	public async activate(): Promise<boolean> {
		await this.initialize();
		return Promise.resolve(true);
	}

	/**
	 * Returns an instance of Server Installation from notebook extension
	 */
	private async getNotebookExtensionApis(): Promise<nbExtensionApis.IExtensionApi> {
		let nbExtension = this._apiWrapper.getExtension(constants.notebookExtensionName);
		if (nbExtension) {
			await nbExtension.activate();
			return (nbExtension.exports as nbExtensionApis.IExtensionApi);
		} else {
			throw new Error(constants.notebookExtensionNotLoaded);
		}
	}

	/**
	 * Returns an instance of Server Installation from notebook extension
	 */
	private async getLanguageExtensionService(): Promise<mssql.ILanguageExtensionService> {
		let mssqlExtension = this._apiWrapper.getExtension(mssql.extension.name)?.exports as mssql.IExtension;
		if (mssqlExtension) {
			return (mssqlExtension.languageExtension);
		} else {
			throw new Error(constants.mssqlExtensionNotLoaded);
		}
	}

	private async initialize(): Promise<void> {

		this._outputChannel.show(true);
		let nbApis = await this.getNotebookExtensionApis();
		await this._config.load();

		let packageManager = this.getPackageManager(nbApis);
		this._apiWrapper.registerCommand(constants.mlManagePackagesCommand, (async () => {
			await packageManager.managePackages();
		}));

		// External Languages
		//
		let mssqlService = await this.getLanguageExtensionService();
		let languagesModel = new LanguageService(this._apiWrapper, mssqlService);
		let languageController = new LanguageController(this._apiWrapper, this._rootPath, languagesModel);
		let modelImporter = new ModelImporter(this._outputChannel, this._apiWrapper, this._processService, this._config, packageManager);

		// Model Management
		//
		let registeredModelService = new RegisteredModelService(this._apiWrapper, this._config, this._queryRunner, modelImporter);
		let azureModelsService = new AzureModelRegistryService(this._apiWrapper, this._config, this.httpClient, this._outputChannel);
		let predictService = new PredictService(this._apiWrapper, this._queryRunner, this._config);
		let modelManagementController = new ModelManagementController(this._apiWrapper, this._rootPath,
			azureModelsService, registeredModelService, predictService);

		this._apiWrapper.registerCommand(constants.mlManageLanguagesCommand, (async () => {
			await languageController.manageLanguages();
		}));
		this._apiWrapper.registerCommand(constants.mlManageModelsCommand, (async () => {
			await modelManagementController.manageRegisteredModels();
		}));
		this._apiWrapper.registerCommand(constants.mlRegisterModelCommand, (async () => {
			await modelManagementController.registerModel();
		}));
		this._apiWrapper.registerCommand(constants.mlsPredictModelCommand, (async () => {
			await modelManagementController.predictModel();
		}));
		this._apiWrapper.registerCommand(constants.mlsDependenciesCommand, (async () => {
			await packageManager.installDependencies();
		}));
		this._apiWrapper.registerTaskHandler(constants.mlManagePackagesCommand, async () => {
			await packageManager.managePackages();
		});
		this._apiWrapper.registerTaskHandler(constants.mlManageLanguagesCommand, async () => {
			await languageController.manageLanguages();
		});
		this._apiWrapper.registerTaskHandler(constants.mlManageModelsCommand, async () => {
			await modelManagementController.manageRegisteredModels();
		});
		this._apiWrapper.registerTaskHandler(constants.mlRegisterModelCommand, async () => {
			await modelManagementController.registerModel();
		});
		this._apiWrapper.registerTaskHandler(constants.mlsPredictModelCommand, async () => {
			await modelManagementController.predictModel();
		});
		this._apiWrapper.registerTaskHandler(constants.mlOdbcDriverCommand, async () => {
			await this.packageManagementService.openOdbcDriverDocuments();
		});
		this._apiWrapper.registerTaskHandler(constants.mlsDocumentsCommand, async () => {
			await this.packageManagementService.openDocuments();
		});
	}

	/**
	 * Returns the package manager instance
	 */
	public getPackageManager(nbApis: nbExtensionApis.IExtensionApi): PackageManager {
		if (!this._packageManager) {
			this._packageManager = new PackageManager(this._outputChannel, this._rootPath, this._apiWrapper, this.packageManagementService, this._processService, this._config, this.httpClient);
			this._packageManager.init();
			this._packageManager.packageManageProviders.forEach(provider => {
				nbApis.registerPackageManager(provider.providerId, provider);
			});
		}
		return this._packageManager;
	}

	/**
	 * Returns the server config manager instance
	 */
	public get packageManagementService(): PackageManagementService {
		if (!this._packageManagementService) {
			this._packageManagementService = new PackageManagementService(this._apiWrapper, this._queryRunner);
		}
		return this._packageManagementService;
	}

	/**
	 * Returns the server config manager instance
	 */
	public get httpClient(): HttpClient {
		if (!this._httpClient) {
			this._httpClient = new HttpClient();
		}
		return this._httpClient;
	}

	/**
	 * Config instance
	 */
	public get config(): Config {
		return this._config;
	}

	/**
	 * Disposes the extension
	 */
	public dispose(): void {
		this.deactivate();
	}
}
