/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import 'vs/css!./webview';
import {
	Component, Input, Inject, ChangeDetectorRef, forwardRef, ComponentFactoryResolver,
	ViewChild, ViewChildren, ElementRef, Injector, OnDestroy, QueryList
} from '@angular/core';

import * as sqlops from 'sqlops';
import { Event, Emitter } from 'vs/base/common/event';
import { addDisposableListener, EventType } from 'vs/base/browser/dom';
import { Parts, IPartService } from 'vs/workbench/services/part/common/partService';
import { CommonServiceInterface } from 'sql/services/common/commonServiceInterface.service';
import { IEnvironmentService } from 'vs/platform/environment/common/environment';
import { IContextViewService } from 'vs/platform/contextview/browser/contextView';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { WebviewElement } from 'vs/workbench/parts/webview/electron-browser/webviewElement';

import { ComponentBase } from 'sql/parts/modelComponents/componentBase';
import { IComponent, IComponentDescriptor, IModelStore, ComponentEventType } from 'sql/parts/modelComponents/interfaces';

@Component({
	template: '',
	selector: 'modelview-webview-component'
})
export default class WebViewComponent extends ComponentBase implements IComponent, OnDestroy {
	@Input() descriptor: IComponentDescriptor;
	@Input() modelStore: IModelStore;

	private _webview: WebviewElement;
	private _onMessage = new Emitter<any>();
	private _renderedHtml: string;

	constructor(
		@Inject(forwardRef(() => CommonServiceInterface)) private _commonService: CommonServiceInterface,
		@Inject(forwardRef(() => ChangeDetectorRef)) changeRef: ChangeDetectorRef,
		@Inject(forwardRef(() => ElementRef)) private _el: ElementRef,
		@Inject(IPartService) private partService: IPartService,
		@Inject(IThemeService) private themeService: IThemeService,
		@Inject(IEnvironmentService) private environmentService: IEnvironmentService,
		@Inject(IContextViewService) private contextViewService: IContextViewService
	) {
		super(changeRef);
	}

	ngOnInit(): void {
		this.baseInit();
		this._createWebview();
		this._register(addDisposableListener(window, EventType.RESIZE, e => {
			this.layout();
		}));
	}

	private _createWebview(): void {
		this._webview = this._register(new WebviewElement(
			this.partService.getContainer(Parts.EDITOR_PART),
			this.themeService,
			this.environmentService,
			this.contextViewService,
			undefined,
			undefined,
			{
				allowScripts: true,
				enableWrappedPostMessage: true
			}
		));
		this._webview.mountTo(this._el.nativeElement);

		this._register(this._webview.onMessage(e => {
			this._onEventEmitter.fire({
				eventType: ComponentEventType.onMessage,
				args: e
			});
		}));

		this._webview.style(this.themeService.getTheme());
		this.setHtml();
	}

	ngOnDestroy(): void {
		this.baseDestroy();
	}

	/// Webview Functions

	private setHtml(): void {
		if (this._webview && this.html) {
			this._renderedHtml = this.html;
			this._webview.contents = this._renderedHtml;
			this._webview.layout();
		}
	}

	private sendMessage(): void {
		if (this._webview && this.message) {
			this._webview.sendMessage(this.message);
		}
	}

	/// IComponent implementation

	public layout(): void {
		this._webview.layout();
	}

	public setLayout(layout: any): void {
		// TODO allow configuring the look and feel
		this.layout();
	}

	public setProperties(properties: { [key: string]: any; }): void {
		super.setProperties(properties);
		if (this.html !== this._renderedHtml) {
			this.setHtml();
		}
		this.sendMessage();
	}

	// CSS-bound properties

	public get message(): any {
		return this.getPropertyOrDefault<sqlops.WebViewProperties, any>((props) => props.message, undefined);
	}

	public set message(newValue: any) {
		this.setPropertyFromUI<sqlops.WebViewProperties, any>((properties, message) => { properties.message = message; }, newValue);
	}

	public get html(): string {
		return this.getPropertyOrDefault<sqlops.WebViewProperties, string>((props) => props.html, undefined);
	}

	public set html(newValue: string) {
		this.setPropertyFromUI<sqlops.WebViewProperties, string>((properties, html) => { properties.html = html; }, newValue);
	}
}
