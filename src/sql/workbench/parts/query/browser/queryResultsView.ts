/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { QueryResultsInput } from 'sql/workbench/parts/query/common/queryResultsInput';
import { TabbedPanel, IPanelTab, IPanelView } from 'sql/base/browser/ui/panel/panel';
import { IQueryModelService } from 'sql/platform/query/common/queryModel';
import QueryRunner from 'sql/platform/query/common/queryRunner';
import { MessagePanel, MessagePanelState } from 'sql/workbench/parts/query/browser/messagePanel';
import { GridPanel, GridPanelState } from 'sql/workbench/parts/query/electron-browser/gridPanel';
import { ChartTab } from 'sql/workbench/parts/charts/browser/chartTab';
import { QueryPlanTab } from 'sql/workbench/parts/queryPlan/electron-browser/queryPlan';
import { TopOperationsTab } from 'sql/workbench/parts/queryPlan/browser/topOperations';
import { QueryModelViewTab } from 'sql/workbench/parts/query/modelViewTab/queryModelViewTab';

import * as nls from 'vs/nls';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import * as DOM from 'vs/base/browser/dom';
import { IDisposable, dispose, Disposable } from 'vs/base/common/lifecycle';
import { attachTabbedPanelStyler } from 'sql/platform/theme/common/styler';
import { IThemeService } from 'vs/platform/theme/common/themeService';

class MessagesView extends Disposable implements IPanelView {
	private messagePanel: MessagePanel;
	private container = document.createElement('div');
	private _state: MessagePanelState;

	constructor(private instantiationService: IInstantiationService) {
		super();
		this.messagePanel = this._register(this.instantiationService.createInstance(MessagePanel));
		this.messagePanel.render(this.container);
	}

	render(container: HTMLElement): void {
		container.appendChild(this.container);
	}

	layout(dimension: DOM.Dimension): void {
		this.container.style.width = `${dimension.width}px`;
		this.container.style.height = `${dimension.height}px`;
		this.messagePanel.layout(dimension);
	}

	public clear() {
		this.messagePanel.clear();
	}

	remove(): void {
		this.container.remove();
	}

	public set queryRunner(runner: QueryRunner) {
		this.messagePanel.queryRunner = runner;
	}

	public set state(val: MessagePanelState) {
		this._state = val;
		this.messagePanel.state = val;
	}

	public get state(): MessagePanelState {
		return this._state;
	}
}

class ResultsView extends Disposable implements IPanelView {
	private gridPanel: GridPanel;
	private container = document.createElement('div');
	private _state: GridPanelState;

	constructor(private instantiationService: IInstantiationService) {
		super();
		this.gridPanel = this._register(this.instantiationService.createInstance(GridPanel));
		this.gridPanel.render(this.container);
	}

	render(container: HTMLElement): void {
		container.appendChild(this.container);
	}

	layout(dimension: DOM.Dimension): void {
		this.container.style.width = `${dimension.width}px`;
		this.container.style.height = `${dimension.height}px`;
		this.gridPanel.layout(dimension);
	}

	public clear() {
		this.gridPanel.clear();
	}

	remove(): void {
		this.container.remove();
	}

	public set queryRunner(runner: QueryRunner) {
		this.gridPanel.queryRunner = runner;
	}

	public set state(val: GridPanelState) {
		this._state = val;
		this.gridPanel.state = val;
	}

	public get state(): GridPanelState {
		return this._state;
	}
}

class ResultsTab implements IPanelTab {
	public readonly title = nls.localize('resultsTabTitle', 'Results');
	public readonly identifier = 'resultsTab';
	public readonly view: ResultsView;

	constructor(instantiationService: IInstantiationService) {
		this.view = new ResultsView(instantiationService);
	}

	public set queryRunner(runner: QueryRunner) {
		this.view.queryRunner = runner;
	}

	public dispose() {
		dispose(this.view);
	}

	public clear() {
		this.view.clear();
	}
}

class MessagesTab implements IPanelTab {
	public readonly title = nls.localize('messagesTabTitle', 'Messages');
	public readonly identifier = 'messagesTab';
	public readonly view: MessagesView;

	constructor(instantiationService: IInstantiationService) {
		this.view = new MessagesView(instantiationService);
	}

	public set queryRunner(runner: QueryRunner) {
		this.view.queryRunner = runner;
	}

	public dispose() {
		dispose(this.view);
	}

	public clear() {
		this.view.clear();
	}
}

export class QueryResultsView extends Disposable {
	private _panelView: TabbedPanel;
	private _input: QueryResultsInput;
	private resultsTab: ResultsTab;
	private messagesTab: MessagesTab;
	private chartTab: ChartTab;
	private qpTab: QueryPlanTab;
	private topOperationsTab: TopOperationsTab;
	private dynamicModelViewTabs: QueryModelViewTab[] = [];

	private runnerDisposables: IDisposable[];

	constructor(
		container: HTMLElement,
		@IThemeService themeService: IThemeService,
		@IInstantiationService private instantiationService: IInstantiationService,
		@IQueryModelService private queryModelService: IQueryModelService
	) {
		super();
		this.resultsTab = this._register(new ResultsTab(instantiationService));
		this.messagesTab = this._register(new MessagesTab(instantiationService));
		this.chartTab = this._register(new ChartTab(instantiationService));
		this._panelView = this._register(new TabbedPanel(container, { showHeaderWhenSingleView: false }));
		attachTabbedPanelStyler(this._panelView, themeService);
		this.qpTab = this._register(new QueryPlanTab());
		this.topOperationsTab = this._register(new TopOperationsTab(instantiationService));

		attachTabbedPanelStyler(this._panelView, themeService);

		this._panelView.pushTab(this.resultsTab);
		this._panelView.pushTab(this.messagesTab);
		this._register(this._panelView.onTabChange(e => {
			if (this.input) {
				this.input.state.activeTab = e;
			}
		}));
	}

	public style() {
	}

	private setQueryRunner(runner: QueryRunner) {
		this.resultsTab.queryRunner = runner;
		this.messagesTab.queryRunner = runner;
		this.chartTab.queryRunner = runner;
		this.runnerDisposables.push(runner.onQueryStart(e => {
			this.hideChart();
			this.hidePlan();
			this.hideDynamicViewModelTabs();
			this.input.state.visibleTabs = new Set();
			this.input.state.activeTab = this.resultsTab.identifier;
		}));
		if (this.input.state.visibleTabs.has(this.chartTab.identifier)) {
			if (!this._panelView.contains(this.chartTab)) {
				this._panelView.pushTab(this.chartTab);
			}
		}
		if (this.input.state.visibleTabs.has(this.qpTab.identifier)) {
			if (!this._panelView.contains(this.qpTab)) {
				this._panelView.pushTab(this.qpTab);
			}
		}
		if (this.input.state.visibleTabs.has(this.topOperationsTab.identifier)) {
			if (!this._panelView.contains(this.topOperationsTab)) {
				this._panelView.pushTab(this.topOperationsTab);
			}
		}

		// restore query model view tabs
		this.input.state.visibleTabs.forEach(tabId => {
			if (tabId.startsWith('querymodelview;')) {
				// tab id format is 'tab type;title;model view id'
				let parts = tabId.split(';');
				if (parts.length === 3) {
					let tab = this._register(new QueryModelViewTab(parts[1], this.instantiationService));
					tab.view._componentId = parts[2];
					this.dynamicModelViewTabs.push(tab);
					if (!this._panelView.contains(tab)) {
						this._panelView.pushTab(tab);
					}
				}
			}
		});

		this.runnerDisposables.push(runner.onQueryEnd(() => {
			if (runner.isQueryPlan) {
				runner.planXml.then(e => {
					this.showPlan(e);
				});
			}
		}));
		if (this.input.state.activeTab) {
			this._panelView.showTab(this.input.state.activeTab);
		} else {
			this._panelView.showTab(this.resultsTab.identifier); // our default tab is the results view
		}
	}

	public set input(input: QueryResultsInput) {
		this._input = input;
		dispose(this.runnerDisposables);
		this.runnerDisposables = [];
		this.resultsTab.view.state = this.input.state.gridPanelState;
		this.messagesTab.view.state = this.input.state.messagePanelState;
		this.qpTab.view.state = this.input.state.queryPlanState;
		this.topOperationsTab.view.state = this.input.state.topOperationsState;
		this.chartTab.view.state = this.input.state.chartState;

		let info = this.queryModelService._getQueryInfo(input.uri);
		if (info) {
			this.setQueryRunner(info.queryRunner);
		} else {
			let disposeable = this.queryModelService.onRunQueryStart(c => {
				if (c === input.uri) {
					let info = this.queryModelService._getQueryInfo(input.uri);
					this.setQueryRunner(info.queryRunner);
					disposeable.dispose();
				}
			});
		}
	}

	clearInput() {
		this._input = undefined;
		this.resultsTab.clear();
		this.messagesTab.clear();
		this.qpTab.clear();
		this.topOperationsTab.clear();
		this.chartTab.clear();
	}

	public get input(): QueryResultsInput {
		return this._input;
	}

	public layout(dimension: DOM.Dimension) {
		this._panelView.layout(dimension);
	}

	public chartData(dataId: { resultId: number, batchId: number }): void {
		this.input.state.visibleTabs.add(this.chartTab.identifier);
		if (!this._panelView.contains(this.chartTab)) {
			this._panelView.pushTab(this.chartTab);
		}

		this._panelView.showTab(this.chartTab.identifier);
		this.chartTab.chart(dataId);
	}

	public hideChart() {
		if (this._panelView.contains(this.chartTab)) {
			this._panelView.removeTab(this.chartTab.identifier);
		}
	}

	public showPlan(xml: string) {
		this.input.state.visibleTabs.add(this.qpTab.identifier);
		if (!this._panelView.contains(this.qpTab)) {
			this._panelView.pushTab(this.qpTab);
		}
		this.input.state.visibleTabs.add(this.topOperationsTab.identifier);
		if (!this._panelView.contains(this.topOperationsTab)) {
			this._panelView.pushTab(this.topOperationsTab);
		}

		this._panelView.showTab(this.qpTab.identifier);
		this.qpTab.view.showPlan(xml);
		this.topOperationsTab.view.showPlan(xml);
	}

	public hidePlan() {
		if (this._panelView.contains(this.qpTab)) {
			this._panelView.removeTab(this.qpTab.identifier);
		}

		if (this._panelView.contains(this.topOperationsTab)) {
			this._panelView.removeTab(this.topOperationsTab.identifier);
		}
	}

	public hideDynamicViewModelTabs() {
		this.dynamicModelViewTabs.forEach(tab => {
			if (this._panelView.contains(tab)) {
				this._panelView.removeTab(tab.identifier);
			}
		});

		this.dynamicModelViewTabs = [];
	}

	public dispose() {
		dispose(this.runnerDisposables);
		super.dispose();
	}

	public registerQueryModelViewTab(title: string, componentId: string): void {
		let tab = this._register(new QueryModelViewTab(title, this.instantiationService));
		tab.view._componentId = componentId;
		this.dynamicModelViewTabs.push(tab);

		this.input.state.visibleTabs.add('querymodelview;' + title + ';' + componentId);
		if (!this._panelView.contains(tab)) {
			this._panelView.pushTab(tab);
		}
	}
}
