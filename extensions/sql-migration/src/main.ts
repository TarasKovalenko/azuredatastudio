/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as azdata from 'azdata';
import { WizardController } from './wizard/wizardController';
import { AssessmentResultsDialog } from './dialog/assessmentResults/assessmentResultsDialog';

class SQLMigration {

	constructor(private readonly context: vscode.ExtensionContext) {
	}

	async start(): Promise<void> {
		await this.registerCommands();
	}

	async registerCommands(): Promise<void> {
		const commandDisposables: vscode.Disposable[] = [ // Array of disposables returned by registerCommand
			vscode.commands.registerCommand('sqlmigration.start', async () => {
				let activeConnection = await azdata.connection.getCurrentConnection();
				let connectionId: string = '';
				if (!activeConnection) {
					const connection = await azdata.connection.openConnectionDialog();
					if (connection) {
						connectionId = connection.connectionId;
					}
				} else {
					connectionId = activeConnection.connectionId;
				}
				const wizardController = new WizardController(this.context);
				await wizardController.openWizard(connectionId);
			}),

			vscode.commands.registerCommand('sqlmigration.testDialog', async () => {
				let dialog = new AssessmentResultsDialog('ownerUri', undefined!, 'Assessment Dialog');
				await dialog.openDialog();
			})
		];

		this.context.subscriptions.push(...commandDisposables);
	}

	stop(): void {

	}
}

let sqlMigration: SQLMigration;
export async function activate(context: vscode.ExtensionContext) {
	sqlMigration = new SQLMigration(context);
	await sqlMigration.registerCommands();
}

export function deactivate(): void {
	sqlMigration.stop();
}
