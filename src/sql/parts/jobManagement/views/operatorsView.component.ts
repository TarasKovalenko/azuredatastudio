/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!sql/parts/grid/media/slickColorTheme';
import 'vs/css!sql/parts/grid/media/flexbox';
import 'vs/css!sql/parts/grid/media/styles';
import 'vs/css!sql/parts/grid/media/slick.grid';
import 'vs/css!sql/parts/grid/media/slickGrid';
import 'vs/css!../common/media/jobs';
import 'vs/css!sql/media/icons/common-icons';
import 'vs/css!sql/base/browser/ui/table/media/table';

import * as dom from 'vs/base/browser/dom';
import * as nls from 'vs/nls';
import * as sqlops from 'sqlops';
import { Component, Inject, forwardRef, ElementRef, ChangeDetectorRef, ViewChild, OnInit } from '@angular/core';
import { Table } from 'sql/base/browser/ui/table/table';
import { AgentViewComponent } from 'sql/parts/jobManagement/agent/agentView.component';
import { IJobManagementService } from 'sql/parts/jobManagement/common/interfaces';
import { EditOperatorAction, DeleteOperatorAction, NewOperatorAction } from 'sql/parts/jobManagement/common/jobActions';
import { JobManagementView } from 'sql/parts/jobManagement/views/jobManagementView';
import { CommonServiceInterface } from 'sql/services/common/commonServiceInterface.service';
import { TabChild } from 'sql/base/browser/ui/panel/tab.component';
import { ICommandService } from 'vs/platform/commands/common/commands';
import { IContextMenuService } from 'vs/platform/contextview/browser/contextView';
import { IKeybindingService } from 'vs/platform/keybinding/common/keybinding';
import { TPromise } from 'vs/base/common/winjs.base';
import { IAction } from 'vs/base/common/actions';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IDashboardService } from 'sql/services/dashboard/common/dashboardService';

export const VIEW_SELECTOR: string = 'joboperatorsview-component';
export const ROW_HEIGHT: number = 30;

@Component({
	selector: VIEW_SELECTOR,
	templateUrl: decodeURI(require.toUrl('./operatorsView.component.html')),
	providers: [{ provide: TabChild, useExisting: forwardRef(() => OperatorsViewComponent) }],
})

export class OperatorsViewComponent extends JobManagementView implements OnInit {

	private columns: Array<Slick.Column<any>> = [
		{ name: nls.localize('jobOperatorsView.name', 'Name'), field: 'name', width: 200, id: 'name' },
		{ name: nls.localize('jobOperatorsView.emailAddress', 'Email Address'), field: 'emailAddress', width: 200, id: 'emailAddress' },
		{ name: nls.localize('jobOperatorsView.enabled', 'Enabled'), field: 'enabled', width: 200, id: 'enabled' },
	];

	private options: Slick.GridOptions<any> = {
		syncColumnCellResize: true,
		enableColumnReorder: false,
		rowHeight: ROW_HEIGHT,
		enableCellNavigation: true,
		editable: false
	};

	private dataView: any;
	private _serverName: string;
	private _isCloud: boolean;

	@ViewChild('operatorsgrid') _gridEl: ElementRef;

	public operators: sqlops.AgentOperatorInfo[];
	public contextAction = NewOperatorAction;

	constructor(
		@Inject(forwardRef(() => ChangeDetectorRef)) private _cd: ChangeDetectorRef,
		@Inject(forwardRef(() => ElementRef)) private _el: ElementRef,
		@Inject(forwardRef(() => AgentViewComponent)) private _agentViewComponent: AgentViewComponent,
		@Inject(IJobManagementService) private _jobManagementService: IJobManagementService,
		@Inject(ICommandService) private _commandService: ICommandService,
		@Inject(IInstantiationService) instantiationService: IInstantiationService,
		@Inject(forwardRef(() => CommonServiceInterface)) commonService: CommonServiceInterface,
		@Inject(IContextMenuService) contextMenuService: IContextMenuService,
		@Inject(IKeybindingService)  keybindingService: IKeybindingService,
		@Inject(IDashboardService) _dashboardService: IDashboardService
	) {
		super(commonService, _dashboardService, contextMenuService, keybindingService, instantiationService);
		this._isCloud = commonService.connectionManagementService.connectionInfo.serverInfo.isCloud;
	}

	ngOnInit(){
		// set base class elements
		this._visibilityElement = this._gridEl;
		this._parentComponent = this._agentViewComponent;
	}

	public layout() {
		let height = dom.getContentHeight(this._gridEl.nativeElement) - 10;
		if (height < 0) {
			height = 0;
		}

		this._table.layout(new dom.Dimension(
			dom.getContentWidth(this._gridEl.nativeElement),
			height));
	}

	onFirstVisible() {
		let self = this;
		let columns = this.columns.map((column) => {
			column.rerenderOnResize = true;
			return column;
		});

		this.dataView = new Slick.Data.DataView();

		$(this._gridEl.nativeElement).empty();
		$(this.actionBarContainer.nativeElement).empty();
		this.initActionBar();
		this._table = new Table(this._gridEl.nativeElement, undefined, columns, this.options);
		this._table.grid.setData(this.dataView, true);

		this._register(this._table.onContextMenu((e: DOMEvent, data: Slick.OnContextMenuEventArgs<any>) => {
			self.openContextMenu(e);
		}));

		let ownerUri: string = this._commonService.connectionManagementService.connectionInfo.ownerUri;
		this._jobManagementService.getOperators(ownerUri).then((result) => {
			if (result && result.operators) {
				self.operators = result.operators;
				self.onOperatorsAvailable(result.operators);
			} else {
				// TODO: handle error
			}

			this._showProgressWheel = false;
			if (this.isVisible) {
				this._cd.detectChanges();
			}
		});
	}

	private onOperatorsAvailable(operators: sqlops.AgentOperatorInfo[]) {
		let items: any = operators.map((item) => {
			return {
				id: item.id,
				name: item.name,
				emailAddress: item.emailAddress,
				enabled: item.enabled
			};
		});

		this.dataView.beginUpdate();
		this.dataView.setItems(items);
		this.dataView.endUpdate();
		this._table.autosizeColumns();
		this._table.resizeCanvas();
	}

	protected getTableActions(): TPromise<IAction[]> {
		let actions: IAction[] = [];
		actions.push(this._instantiationService.createInstance(EditOperatorAction));
		actions.push(this._instantiationService.createInstance(DeleteOperatorAction));
		return TPromise.as(actions);
	}

	protected getCurrentTableObject(rowIndex: number): any {
		return (this.operators && this.operators.length >= rowIndex)
			? this.operators[rowIndex]
			: undefined;
	}

	public openCreateOperatorDialog() {
		let ownerUri: string = this._commonService.connectionManagementService.connectionInfo.ownerUri;
		this._commandService.executeCommand('agent.openOperatorDialog', ownerUri);
	}

	private refreshJobs() {
		this._agentViewComponent.refresh = true;
	}
}