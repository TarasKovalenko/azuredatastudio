/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert = require('assert');
import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { TestServerProfile } from './testConfig';

export async function connectToServer(server: TestServerProfile, timeout: number = 3000) {
	let connectionProfile: azdata.IConnectionProfile = {
		serverName: server.serverName,
		databaseName: server.database,
		authenticationType: server.authenticationTypeName,
		providerName: server.providerName,
		connectionName: '',
		userName: server.userName,
		password: server.password,
		savePassword: false,
		groupFullName: undefined,
		saveProfile: true,
		id: undefined,
		groupId: undefined,
		options: {}
	};
	await ensureConnectionViewOpened();
	let result = <azdata.ConnectionResult>await azdata.connection.connect(connectionProfile);
	assert(result.connected, `Failed to connect to "${connectionProfile.serverName}", error code: ${result.errorCode}, error message: ${result.errorMessage}`);

	//workaround
	//wait for OE to load
	await new Promise(c => setTimeout(c, timeout));
}

export async function ensureConnectionViewOpened() {
	await vscode.commands.executeCommand('dataExplorer.servers.focus');
}