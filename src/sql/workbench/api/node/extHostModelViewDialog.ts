/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { IMainContext } from 'vs/workbench/api/node/extHost.protocol';
import Event, { Emitter } from 'vs/base/common/event';
import { deepClone } from 'vs/base/common/objects';
import * as nls from 'vs/nls';

import * as vscode from 'vscode';
import * as sqlops from 'sqlops';

import { SqlMainContext, ExtHostModelViewDialogShape, MainThreadModelViewDialogShape } from 'sql/workbench/api/node/sqlExtHost.protocol';
import { IItemConfig, ModelComponentTypes, IComponentShape } from 'sql/workbench/api/common/sqlExtHostTypes';

class DialogImpl implements sqlops.window.modelviewdialog.Dialog {
	public title: string;
	public content: string | sqlops.window.modelviewdialog.DialogTab[];
	public okButton: sqlops.window.modelviewdialog.Button;
	public cancelButton: sqlops.window.modelviewdialog.Button;
	public customButtons: sqlops.window.modelviewdialog.Button[];
	public readonly onValidityChanged: vscode.Event<boolean>;
	private _valid: boolean = true;

	constructor(private _extHostModelViewDialog: ExtHostModelViewDialog) {
		this.okButton = this._extHostModelViewDialog.createButton(nls.localize('dialogOkLabel', 'Done'));
		this.cancelButton = this._extHostModelViewDialog.createButton(nls.localize('dialogCancelLabel', 'Cancel'));
		this.onValidityChanged = this._extHostModelViewDialog.getValidityChangedEvent(this);
		this.onValidityChanged(valid => this._valid = valid);
	}

	public get valid(): boolean {
		return this._valid;
	}
}

class TabImpl implements sqlops.window.modelviewdialog.DialogTab {
	public title: string;
	public content: string;

	constructor(private _extHostModelViewDialog: ExtHostModelViewDialog) { }
}

class ButtonImpl implements sqlops.window.modelviewdialog.Button {
	private _label: string;
	private _enabled: boolean;
	private _hidden: boolean;

	private _onClick = new Emitter<void>();
	public onClick = this._onClick.event;

	constructor(private _extHostModelViewDialog: ExtHostModelViewDialog) {
		this._enabled = true;
		this._hidden = false;
	}

	public get label(): string {
		return this._label;
	}

	public set label(label: string) {
		this._label = label;
		this._extHostModelViewDialog.updateButton(this);
	}

	public get enabled(): boolean {
		return this._enabled;
	}

	public set enabled(enabled: boolean) {
		this._enabled = enabled;
		this._extHostModelViewDialog.updateButton(this);
	}

	public get hidden(): boolean {
		return this._hidden;
	}

	public set hidden(hidden: boolean) {
		this._hidden = hidden;
		this._extHostModelViewDialog.updateButton(this);
	}

	public getOnClickCallback(): () => void {
		return () => this._onClick.fire();
	}
}

export class ExtHostModelViewDialog implements ExtHostModelViewDialogShape {
	private static _currentHandle = 0;

	private readonly _proxy: MainThreadModelViewDialogShape;

	private readonly _dialogHandles = new Map<sqlops.window.modelviewdialog.Dialog, number>();
	private readonly _tabHandles = new Map<sqlops.window.modelviewdialog.DialogTab, number>();
	private readonly _buttonHandles = new Map<sqlops.window.modelviewdialog.Button, number>();

	private readonly _validityEmitters = new Map<number, Emitter<boolean>>();
	private readonly _onClickCallbacks = new Map<number, () => void>();

	constructor(
		mainContext: IMainContext
	) {
		this._proxy = mainContext.getProxy(SqlMainContext.MainThreadModelViewDialog);
	}

	private static getNewHandle() {
		let handle = ExtHostModelViewDialog._currentHandle;
		ExtHostModelViewDialog._currentHandle += 1;
		return handle;
	}

	private getDialogHandle(dialog: sqlops.window.modelviewdialog.Dialog) {
		let handle = this._dialogHandles.get(dialog);
		if (handle === undefined) {
			handle = ExtHostModelViewDialog.getNewHandle();
			this._dialogHandles.set(dialog, handle);
		}
		return handle;
	}

	private getTabHandle(tab: sqlops.window.modelviewdialog.DialogTab) {
		let handle = this._tabHandles.get(tab);
		if (handle === undefined) {
			handle = ExtHostModelViewDialog.getNewHandle();
			this._tabHandles.set(tab, handle);
		}
		return handle;
	}

	private getButtonHandle(button: sqlops.window.modelviewdialog.Button) {
		let handle = this._buttonHandles.get(button);
		if (handle === undefined) {
			handle = ExtHostModelViewDialog.getNewHandle();
			this._buttonHandles.set(button, handle);
		}
		return handle;
	}

	public $onButtonClick(handle: number): void {
		this._onClickCallbacks.get(handle)();
	}

	public $onDialogValidityChanged(handle: number, valid: boolean): void {
		let emitter = this._validityEmitters.get(handle);
		if (emitter) {
			emitter.fire(valid);
		}
	}

	public open(dialog: sqlops.window.modelviewdialog.Dialog): void {
		let handle = this.getDialogHandle(dialog);
		this.updateDialogContent(dialog);
		this._proxy.$open(handle);
	}

	public close(dialog: sqlops.window.modelviewdialog.Dialog): void {
		let handle = this.getDialogHandle(dialog);
		this._proxy.$close(handle);
	}

	public updateDialogContent(dialog: sqlops.window.modelviewdialog.Dialog): void {
		let handle = this.getDialogHandle(dialog);
		let tabs = dialog.content;
		if (tabs && typeof tabs !== 'string') {
			tabs.forEach(tab => this.updateTabContent(tab));
		}
		if (dialog.customButtons) {
			dialog.customButtons.forEach(button => this.updateButton(button));
		}
		this.updateButton(dialog.okButton);
		this.updateButton(dialog.cancelButton);
		this._proxy.$setDialogDetails(handle, {
			title: dialog.title,
			okButton: this.getButtonHandle(dialog.okButton),
			cancelButton: this.getButtonHandle(dialog.cancelButton),
			content: dialog.content && typeof dialog.content !== 'string' ? dialog.content.map(tab => this.getTabHandle(tab)) : dialog.content as string,
			customButtons: dialog.customButtons ? dialog.customButtons.map(button => this.getButtonHandle(button)) : undefined
		});
	}

	public updateTabContent(tab: sqlops.window.modelviewdialog.DialogTab): void {
		let handle = this.getTabHandle(tab);
		this._proxy.$setTabDetails(handle, {
			title: tab.title,
			content: tab.content
		});
	}

	public updateButton(button: sqlops.window.modelviewdialog.Button): void {
		let handle = this.getButtonHandle(button);
		this._proxy.$setButtonDetails(handle, {
			label: button.label,
			enabled: button.enabled,
			hidden: button.hidden
		});
	}

	public registerOnClickCallback(button: sqlops.window.modelviewdialog.Button, callback: () => void) {
		let handle = this.getButtonHandle(button);
		this._onClickCallbacks.set(handle, callback);
	}

	public createDialog(title: string): sqlops.window.modelviewdialog.Dialog {
		let dialog = new DialogImpl(this);
		dialog.title = title;
		this.getDialogHandle(dialog);
		return dialog;
	}

	public createTab(title: string): sqlops.window.modelviewdialog.DialogTab {
		let tab = new TabImpl(this);
		tab.title = title;
		this.getTabHandle(tab);
		return tab;
	}

	public createButton(label: string): sqlops.window.modelviewdialog.Button {
		let button = new ButtonImpl(this);
		this.getButtonHandle(button);
		this.registerOnClickCallback(button, button.getOnClickCallback());
		button.label = label;
		return button;
	}

	public getValidityChangedEvent(dialog: sqlops.window.modelviewdialog.Dialog) {
		let handle = this.getDialogHandle(dialog);
		let emitter = this._validityEmitters.get(handle);
		if (!emitter) {
			emitter = new Emitter<boolean>();
			this._validityEmitters.set(handle, emitter);
		}
		return emitter.event;
	}
}