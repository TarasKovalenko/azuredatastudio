/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import 'vs/css!./flexContainer';

import {
	Component, Input, Inject, ChangeDetectorRef, forwardRef, ComponentFactoryResolver,
	ViewChild, ElementRef, Injector, OnDestroy, OnInit
} from '@angular/core';

import * as types from 'vs/base/common/types';

import { IComponent, IComponentDescriptor, IModelStore, IComponentEventArgs, ComponentEventType } from 'sql/parts/modelComponents/interfaces';
import { FlexLayout, FlexItemLayout } from 'sqlops';
import { ComponentHostDirective } from 'sql/parts/dashboard/common/componentHost.directive';
import { DashboardServiceInterface } from 'sql/parts/dashboard/services/dashboardServiceInterface.service';
import Event, { Emitter } from 'vs/base/common/event';
import { IDisposable, Disposable } from 'vs/base/common/lifecycle';

export class ItemDescriptor<T> {
	constructor(public descriptor: IComponentDescriptor, public config: T) { }
}

export abstract class ComponentBase extends Disposable implements IComponent, OnDestroy, OnInit {
	protected properties: { [key: string]: any; } = {};
	protected _valid: boolean = true;
	private _eventQueue: IComponentEventArgs[] = [];
	constructor(
		protected _changeRef: ChangeDetectorRef) {
		super();
	}

	/// IComponent implementation

	abstract descriptor: IComponentDescriptor;
	abstract modelStore: IModelStore;
	protected _onEventEmitter = new Emitter<IComponentEventArgs>();

	public layout(): void {
		this._changeRef.detectChanges();
	}

	protected baseInit(): void {
		if (this.modelStore) {
			this.modelStore.registerComponent(this);
		}
	}

	abstract ngOnInit(): void;

	protected baseDestroy(): void {
		if (this.modelStore) {
			this.modelStore.unregisterComponent(this);
		}
	}

	ngOnDestroy(): void {
		this.dispose();
	}

	abstract setLayout(layout: any): void;

	public setProperties(properties: { [key: string]: any; }): void {
		if (!properties) {
			this.properties = {};
		}
		this.properties = properties;
		this.layout();
	}

	protected getProperties<TPropertyBag>(): TPropertyBag {
		return this.properties as TPropertyBag;
	}

	protected getPropertyOrDefault<TPropertyBag, TValue>(propertyGetter: (TPropertyBag) => TValue, defaultVal: TValue) {
		let property = propertyGetter(this.getProperties<TPropertyBag>());
		return types.isUndefinedOrNull(property) ? defaultVal : property;
	}

	protected setPropertyFromUI<TPropertyBag, TValue>(propertySetter: (TPropertyBag, TValue) => void, value: TValue) {
		propertySetter(this.getProperties<TPropertyBag>(), value);
		this.fireEvent({
			eventType: ComponentEventType.PropertiesChanged,
			args: this.getProperties()
		});
	}

	public get enabled(): boolean {
		let properties = this.getProperties();
		let enabled = properties['enabled'];
		return enabled !== undefined ? <boolean>enabled : true;
	}

	public get valid(): boolean {
		return this._valid;
	}

	public setValid(valid: boolean): void {
		if (this._valid !== valid) {
			this._valid = valid;
			this.fireEvent({
				eventType: ComponentEventType.validityChanged,
				args: valid
			});
		}
	}

	public registerEventHandler(handler: (event: IComponentEventArgs) => void): IDisposable {
		if (this._eventQueue) {
			while (this._eventQueue.length > 0) {
				let event = this._eventQueue.pop();
				handler(event);
			}
			this._eventQueue = undefined;
		}
		return this._onEventEmitter.event(handler);
	}

	private fireEvent(event: IComponentEventArgs) {
		this._onEventEmitter.fire(event);
		if (this._eventQueue) {
			this._eventQueue.push(event);
		}
	}
}

export abstract class ContainerBase<T> extends ComponentBase {
	protected items: ItemDescriptor<T>[];

	constructor(
		_changeRef: ChangeDetectorRef
	) {
		super(_changeRef);
		this.items = [];
	}

	/// IComponent container-related implementation
	public addToContainer(componentDescriptor: IComponentDescriptor, config: any): void {
		this.items.push(new ItemDescriptor(componentDescriptor, config));
		this._changeRef.detectChanges();
	}

	public clearContainer(): void {
		this.items = [];
		this._changeRef.detectChanges();
	}

	abstract setLayout(layout: any): void;
}
