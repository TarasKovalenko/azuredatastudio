/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';
import { TreeDataProvider, EventEmitter, Event, TreeItem } from 'vscode';
import { AppContext } from '../../appContext';
import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

import { TreeNode } from '../treeNode';
import { CmsResourceEmptyTreeNode } from './cmsResourceEmptyTreeNode';
import { ICmsResourceTreeChangeHandler } from './treeChangeHandler';
import { CmsResourceMessageTreeNode } from '../messageTreeNode';
import { CmsResourceTreeNode } from './cmsResourceTreeNode';

export class CmsResourceTreeProvider implements TreeDataProvider<TreeNode>, ICmsResourceTreeChangeHandler {

	private _appContext: AppContext;

	public constructor(
		public readonly appContext: AppContext
	) {
		this._appContext = appContext;
	}

	public async getChildren(element?: TreeNode): Promise<TreeNode[]> {
		if (element) {
			return element.getChildren(true);
		}

		if (!this.isSystemInitialized) {
			try {
				// Call to collect all locally saved CMS servers
				// to determine whether the system has been initialized.
				let cmsConfig = this._appContext.apiWrapper.getConfiguration();
				let cachedServers = cmsConfig ? cmsConfig.cmsServers : [];
				if (cachedServers && cachedServers.length > 0) {
					let servers = [];
					cachedServers.forEach((server) => {
						servers.push(new CmsResourceTreeNode(
							server.name,
							server.description,
							server.ownerUri,
							server.connection,
							this._appContext, this, null));
						this.appContext.apiWrapper.cacheRegisteredCmsServer(server.name, server.description,
							server.ownerUri, server.connection);
					});
					return servers;
				}
				this.isSystemInitialized = true;
				this._onDidChangeTreeData.fire(undefined);
			} catch (error) {
				// System not initialized yet
				this.isSystemInitialized = false;
			}
			return [CmsResourceMessageTreeNode.create(CmsResourceTreeProvider.loadingLabel, undefined)];
		}
		try {
			let registeredCmsServers = this.appContext.apiWrapper.registeredCmsServers;
			if (registeredCmsServers && registeredCmsServers.length > 0) {
				this.isSystemInitialized = true;
				// save the CMS Servers for future use
				await this._appContext.apiWrapper.setConfiguration(registeredCmsServers);
				return registeredCmsServers.map((server) => {
					return new CmsResourceTreeNode(
						server.name,
						server.description,
						server.ownerUri,
						server.connection,
						this._appContext, this, null);
				});
			} else {
				return [new CmsResourceEmptyTreeNode()];

			}
		} catch (error) {
			return [new CmsResourceEmptyTreeNode()];
		}
	}

	public get onDidChangeTreeData(): Event<TreeNode> {
		return this._onDidChangeTreeData.event;
	}

	public notifyNodeChanged(node: TreeNode): void {
		this._onDidChangeTreeData.fire(node);
	}

	public async refresh(node: TreeNode): Promise<void> {
		this._onDidChangeTreeData.fire(node);
	}

	public getTreeItem(element: TreeNode): TreeItem | Thenable<TreeItem> {
		return element.getTreeItem();
	}

	public isSystemInitialized: boolean = false;
	private _onDidChangeTreeData = new EventEmitter<TreeNode>();

	private static readonly loadingLabel = localize('cms.resource.tree.treeProvider.loadingLabel', 'Loading ...');
}
