/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';
import * as nls from 'vscode-nls';
import * as azdata from 'azdata';
import { AppContext } from '../appContext';
import { TreeNode } from './treeNode';
import { CmsResourceTreeProvider } from './tree/treeProvider';
import { CmsResourceEmptyTreeNode } from './tree/cmsResourceEmptyTreeNode';
import { RegisteredServerTreeNode } from './tree/registeredServerTreeNode';
import { ServerGroupTreeNode } from './tree/serverGroupTreeNode';
import { CmsResourceTreeNode } from './tree/cmsResourceTreeNode';

const localize = nls.loadMessageBundle();

export function registerCmsServerCommand(appContext: AppContext, tree: CmsResourceTreeProvider): void {
	// Create a CMS Server
	appContext.apiWrapper.registerCommand('cms.resource.registerCmsServer', async (node?: TreeNode) => {
		if (node && !(node instanceof CmsResourceEmptyTreeNode)) {
			return;
		}
		await appContext.apiWrapper.connection.then(async (connection) => {
			if (connection && connection.options) {
				let registeredCmsServerName = connection.options.registeredServerName ?
					connection.options.registeredServerName : connection.options.server;
				// check if a CMS with the same name is registered or not
				let cachedServers = appContext.apiWrapper.registeredCmsServers;
				let serverExists: boolean = false;
				if (cachedServers) {
					serverExists = cachedServers.some((server) => {
						return server.name === registeredCmsServerName;
					});
				}
				if (!serverExists) {
					// remove any group ID if user selects a connection from
					// recent connection list
					connection.options.groupId = null;
					let registeredCmsServerDescription = connection.options.registeredServerDescription;
					// remove server description from connection uri
					connection.options.registeredCmsServerDescription = null;
					let ownerUri = await azdata.connection.getUriForConnection(connection.connectionId);
					appContext.apiWrapper.cacheRegisteredCmsServer(registeredCmsServerName, registeredCmsServerDescription, ownerUri, connection);
					tree.notifyNodeChanged(undefined);
				} else {
					// error out for same server name
					let errorText = localize('cms.errors.sameCmsServerName', 'Central Management Server Group already has a Registered Server with the name {0}', registeredCmsServerName);
					appContext.apiWrapper.showErrorMessage(errorText);
					return;
				}
			}
		});
	});
}

export function deleteCmsServerCommand(appContext: AppContext, tree: CmsResourceTreeProvider): void {
	// Delete a CMS Server
	appContext.apiWrapper.registerCommand('cms.resource.deleteCmsServer', async (node?: TreeNode) => {
		if (!(node instanceof CmsResourceTreeNode)) {
			return;
		}
		await appContext.apiWrapper.deleteCmsServer(node.name);
		tree.isSystemInitialized = false;
		tree.notifyNodeChanged(undefined);
	});
}

export function addRegisteredServerCommand(appContext: AppContext, tree: CmsResourceTreeProvider): void {
	// Add a registered server
	appContext.apiWrapper.registerCommand('cms.resource.addRegisteredServer', async (node?: TreeNode) => {
		if (!(node instanceof CmsResourceTreeNode || node instanceof ServerGroupTreeNode)) {
			return;
		}
		let relativePath = node instanceof CmsResourceTreeNode ? '' : node.relativePath;
		let serverName = node instanceof CmsResourceTreeNode ? node.connection.options.server : null;
		await appContext.apiWrapper.addRegisteredServer(relativePath, node.ownerUri, serverName).then((result) => {
			if (result) {
				tree.notifyNodeChanged(undefined);
			}
		});
	});
}

export function deleteRegisteredServerCommand(appContext: AppContext, tree: CmsResourceTreeProvider): void {
	// Delete a registered server
	appContext.apiWrapper.registerCommand('cms.resource.deleteRegisteredServer', async (node?: TreeNode) => {
		if (!(node instanceof RegisteredServerTreeNode)) {
			return;
		}
		appContext.apiWrapper.removeRegisteredServer(node.name, node.relativePath, node.ownerUri).then((result) => {
			if (result) {
				tree.notifyNodeChanged(undefined);
			}
		});
	});
}

export function addServerGroupCommand(appContext: AppContext, tree: CmsResourceTreeProvider): void {
	// Add a registered server group
	appContext.apiWrapper.registerCommand('cms.resource.addServerGroup', async (node?: TreeNode) => {
		if (!(node instanceof ServerGroupTreeNode || node instanceof CmsResourceTreeNode)) {
			return;
		}
		// add a dialog for adding a group
		let title = localize('cms.AddServerGroup', 'Add Server Group');
		let dialog = azdata.window.createModelViewDialog(title, 'cms.addServerGroup');
		dialog.okButton.label = localize('cms.OK', 'OK');
		dialog.cancelButton.label = localize('cms.Cancel', 'Cancel');
		let mainTab = azdata.window.createTab(title);
		let serverGroupName: string = null;
		let serverDescription: string = null;
		mainTab.registerContent(async view => {
			let nameTextBox = view.modelBuilder.inputBox().component();
			nameTextBox.required = true;
			nameTextBox.onTextChanged((e) => {
				serverGroupName = e;
			});
			if (nameTextBox.value && nameTextBox.value.length > 0) {
				dialog.message = null;
			}
			let descriptionTextBox = view.modelBuilder.inputBox().component();
			descriptionTextBox.required = false;
			descriptionTextBox.onTextChanged((e) => {
				serverDescription = e;
			});
			let formModel = view.modelBuilder.formContainer()
				.withFormItems([{
					component: nameTextBox,
					title: localize('cms.ServerGroupName', 'Server Group Name')
				}, {
					component: descriptionTextBox,
					title: localize('cms.ServerGroupDescription', 'Server Group Description')
				}]).withLayout({ width: '100%' }).component();
			await view.initializeModel(formModel);
		});
		dialog.content = [mainTab];
		azdata.window.openDialog(dialog);
		let groupExists = false;
		dialog.okButton.onClick(() => {
			let path = node instanceof ServerGroupTreeNode ? node.relativePath : '';
			if (node.serverGroupNodes.some(node => node.name === serverGroupName)) {
				groupExists = true;
			}
			if (!groupExists) {
				appContext.apiWrapper.addServerGroup(serverGroupName, serverDescription, path, node.ownerUri).then((result) => {
					if (result) {
						tree.notifyNodeChanged(undefined);
					}
				});
			} else {
				// error out for same server group
				let errorText = localize('cms.errors.sameServerGroupName', '{0} already has a Server Group with the name {1}', node.name, serverGroupName);
				appContext.apiWrapper.showErrorMessage(errorText);
				return;
			}
		});
	});
}

export function deleteServerGroupCommand(appContext: AppContext, tree: CmsResourceTreeProvider): void {
	// Remove a registered server group
	appContext.apiWrapper.registerCommand('cms.resource.deleteServerGroup', async (node?: TreeNode) => {
		if (!(node instanceof ServerGroupTreeNode)) {
			return;
		}
		appContext.apiWrapper.removeServerGroup(node.name, node.relativePath, node.ownerUri).then((result) => {
			if (result) {
				tree.notifyNodeChanged(undefined);
			}
		});
	});
}

export function refreshCommand(appContext: AppContext, tree: CmsResourceTreeProvider): void {
	// Refresh the cms resource
	appContext.apiWrapper.registerCommand('cms.resource.refresh', async (node?: TreeNode) => {
		if (!node) {
			return;
		}
		tree.notifyNodeChanged(undefined);
	});
}

