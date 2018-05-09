/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { MainThreadModelViewShape, SqlMainContext, ExtHostModelViewShape, SqlExtHostContext } from 'sql/workbench/api/node/sqlExtHost.protocol';
import { extHostNamedCustomer } from 'vs/workbench/api/electron-browser/extHostCustomers';
import { IExtHostContext } from 'vs/workbench/api/node/extHost.protocol';

import * as sqlops from 'sqlops';

import { IModelViewService } from 'sql/services/modelComponents/modelViewService';
import { IItemConfig, ModelComponentTypes, IComponentShape } from 'sql/workbench/api/common/sqlExtHostTypes';
import { IModelView } from 'sql/services/model/modelViewService';
import { Disposable } from 'vs/base/common/lifecycle';


@extHostNamedCustomer(SqlMainContext.MainThreadModelView)
export class MainThreadModelView extends Disposable implements MainThreadModelViewShape {

	private static _handlePool = 0;
	private readonly _proxy: ExtHostModelViewShape;
	private readonly _dialogs = new Map<number, IModelView>();

	private knownWidgets = new Array<string>();

	constructor(
		context: IExtHostContext,
		@IModelViewService viewService: IModelViewService
	) {
		super();
		this._proxy = context.getProxy(SqlExtHostContext.ExtHostModelView);
		viewService.onRegisteredModelView(view => {
			if (this.knownWidgets.includes(view.id)) {
				let handle = MainThreadModelView._handlePool++;
				this._dialogs.set(handle, view);
				this._proxy.$registerWidget(handle, view.id, view.connection, view.serverInfo);
			}
		});
	}

	$registerProvider(id: string) {
		this.knownWidgets.push(id);
	}

	$initializeModel(handle: number, rootComponent: IComponentShape): Thenable<void> {
		return this.execModelViewAction(handle, (modelView) => {
			modelView.initializeModel(rootComponent);
		});
	}

	$clearContainer(handle: number, componentId: string): Thenable<void> {
		return this.execModelViewAction(handle, (modelView) => modelView.clearContainer(componentId));
	}

	$addToContainer(handle: number, containerId: string, item: IItemConfig): Thenable<void> {
		return this.execModelViewAction(handle,
			(modelView) => modelView.addToContainer(containerId, item));
	}

	$setLayout(handle: number, componentId: string, layout: any): Thenable<void> {
		return this.execModelViewAction(handle, (modelView) => modelView.setLayout(componentId, layout));
	}

	private onEvent(handle: number, componentId: string, eventArgs: any) {
		this._proxy.$handleEvent(handle, componentId, eventArgs);
	}

	$registerEvent(handle: number, componentId: string): Thenable<void> {
		let properties: { [key: string]: any; } = { eventName: this.onEvent };
		return this.execModelViewAction(handle, (modelView) => {
			this._register(modelView.onEvent(e => {
				if (e.componentId && e.componentId === componentId) {
					this.onEvent(handle, componentId, e);
				}
			}));
		});
	}

	$setProperties(handle: number, componentId: string, properties: { [key: string]: any; }): Thenable<void> {
		return this.execModelViewAction(handle, (modelView) => modelView.setProperties(componentId, properties));
	}

	$notifyValidation(handle: number, componentId: string, valid: boolean): Thenable<void> {
		return this.execModelViewAction(handle, (modelView) => modelView.setValid(componentId, valid));
	}

	private execModelViewAction<T>(handle: number, action: (m: IModelView) => T): Thenable<T> {
		let modelView: IModelView = this._dialogs.get(handle);
		let result = action(modelView);
		return Promise.resolve(result);
	}
}
