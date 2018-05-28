/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import 'vs/css!sql/parts/grid/media/slickColorTheme';
import 'vs/css!sql/parts/grid/media/flexbox';
import 'vs/css!sql/parts/grid/media/styles';
import 'vs/css!sql/parts/grid/media/slick.grid';
import 'vs/css!sql/parts/grid/media/slickGrid';

import { ElementRef, ChangeDetectorRef, OnInit, OnDestroy, Component, Inject, forwardRef, ViewChild } from '@angular/core';
import { IBootstrapParams } from 'sql/services/bootstrap/bootstrapService';
import { IQueryComponentParams } from 'sql/services/bootstrap/bootstrapParams';
import { QueryComponent } from 'sql/parts/grid/views/query/query.component';
import { QueryPlanComponent } from 'sql/parts/queryPlan/queryPlan.component';
import { TopOperationsComponent } from 'sql/parts/queryPlan/topOperations.component';
import { ChartViewerComponent } from 'sql/parts/grid/views/query/chartViewer.component';
import { toDisposableSubscription } from 'sql/parts/common/rxjsUtils';
import { PanelComponent, IPanelOptions } from 'sql/base/browser/ui/panel/panel.component';

import * as nls from 'vs/nls';
import { IDisposable } from 'vs/base/common/lifecycle';

export const QUERY_OUTPUT_SELECTOR: string = 'query-output-component';

declare type PaneType = 'messages' | 'results';

@Component({
	selector: QUERY_OUTPUT_SELECTOR,
	templateUrl: decodeURI(require.toUrl('sql/parts/query/views/queryOutput.component.html'))
})
export class QueryOutputComponent implements OnDestroy {

	@ViewChild(QueryComponent) queryComponent: QueryComponent;
	@ViewChild(QueryPlanComponent) queryPlanComponent: QueryPlanComponent;
	@ViewChild(TopOperationsComponent) topOperationsComponent: TopOperationsComponent;

	@ViewChild(PanelComponent) private _panel: PanelComponent;

	private activeDataSet: any;

	// tslint:disable:no-unused-variable
	private readonly queryComponentTitle: string = nls.localize('results', 'Results');
	private readonly queryPlanTitle: string = nls.localize('queryPlan', 'Query Plan');
	private readonly topOperationsTitle: string = nls.localize('topOperations', 'Top Operations');
	private readonly chartViewerTitle: string = nls.localize('chartViewer', 'Chart Viewer');

	private readonly resultsTabIdentifier = 'results';
	private readonly queryPlanTabIdentifier = 'queryPlan';
	private readonly chartViewerTabIdentifier = 'chartViewer';
	// tslint:enable:no-unused-variable

	private hasQueryPlan = false;
	private showChartView = false;

	// tslint:disable-next-line:no-unused-variable
	private readonly panelOpt: IPanelOptions = {
		showTabsWhenOne: false
	};

	private _disposables: Array<IDisposable> = [];

	constructor(
		@Inject(forwardRef(() => ElementRef)) el: ElementRef,
		@Inject(forwardRef(() => ChangeDetectorRef)) private _cd: ChangeDetectorRef,
		@Inject(IBootstrapParams) public queryParameters: IQueryComponentParams
	) {
	}

	/**
	 * Called by Angular when the object is initialized
	 */
	public ngAfterViewInit(): void {
		this._disposables.push(toDisposableSubscription(this.queryComponent.queryPlanAvailable.subscribe((xml) => {
			this.hasQueryPlan = true;
			this._cd.detectChanges();
			this._panel.selectTab(this.queryPlanTabIdentifier);
			this.queryPlanComponent.planXml = xml;
			this.topOperationsComponent.planXml = xml;
		})));

		this._disposables.push(toDisposableSubscription(this.queryComponent.showChartRequested.subscribe((dataSet) => {
			this.showChartView = true;
			this._cd.detectChanges();
			this.activeDataSet = dataSet;
			this._panel.selectTab(this.chartViewerTabIdentifier);
		})));

		this._disposables.push(toDisposableSubscription(this.queryComponent.queryExecutionStatus.subscribe(status => {
			if (status === 'start') {
				this._panel.selectTab(this.resultsTabIdentifier);
				this.hasQueryPlan = false;
				this.showChartView = false;
				this._cd.detectChanges();
			}
		})));

		this._disposables.push(toDisposableSubscription(this.queryComponent.goToNextQueryOutputTabRequested.subscribe(() => {
			this._panel.selectOnNextTab();
		})));
	}

	public ngOnDestroy(): void {
		this._disposables.forEach(i => i.dispose());
	}
}
