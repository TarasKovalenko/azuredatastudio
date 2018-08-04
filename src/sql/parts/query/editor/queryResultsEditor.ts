/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { TPromise } from 'vs/base/common/winjs.base';
import { Builder } from 'vs/base/browser/builder';
import { EditorOptions } from 'vs/workbench/common/editor';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { RawContextKey } from 'vs/platform/contextkey/common/contextkey';
import { BaseEditor } from 'vs/workbench/browser/parts/editor/baseEditor';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { BareFontInfo } from 'vs/editor/common/config/fontInfo';
import { getZoomLevel } from 'vs/base/browser/browser';
import { Configuration } from 'vs/editor/browser/config/configuration';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import * as DOM from 'vs/base/browser/dom';
import * as types from 'vs/base/common/types';

import { QueryResultsInput } from 'sql/parts/query/common/queryResultsInput';
import { IQueryModelService } from 'sql/parts/query/execution/queryModel';
import { bootstrapAngular } from 'sql/services/bootstrap/bootstrapService';
import { IQueryComponentParams } from 'sql/services/bootstrap/bootstrapParams';
import { QueryOutputModule } from 'sql/parts/query/views/queryOutput.module';
import { QUERY_OUTPUT_SELECTOR } from 'sql/parts/query/views/queryOutput.component';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { Event } from 'vs/base/common/event';

export const RESULTS_GRID_DEFAULTS = {
	cellPadding: [6, 10, 5],
	rowHeight: 29
};

export const TextCompareEditorVisible = new RawContextKey<boolean>('textCompareEditorVisible', false);

export class BareResultsGridInfo extends BareFontInfo {

	public static createFromRawSettings(opts: {
		fontFamily?: string;
		fontWeight?: string;
		fontSize?: number | string;
		lineHeight?: number | string;
		letterSpacing?: number | string;
		cellPadding?: number | number[];
	}, zoomLevel: number): BareResultsGridInfo {
		let cellPadding = !types.isUndefinedOrNull(opts.cellPadding) ? opts.cellPadding : RESULTS_GRID_DEFAULTS.cellPadding;

		return new BareResultsGridInfo(BareFontInfo.createFromRawSettings(opts, zoomLevel), { cellPadding });
	}

	readonly cellPadding: number | number[];

	protected constructor(fontInfo: BareFontInfo, opts: {
		cellPadding: number | number[];
	}) {
		super({
			zoomLevel: fontInfo.zoomLevel,
			fontFamily: fontInfo.fontFamily,
			fontWeight: fontInfo.fontWeight,
			fontSize: fontInfo.fontSize,
			lineHeight: fontInfo.lineHeight,
			letterSpacing: fontInfo.letterSpacing
		});
		this.cellPadding = opts.cellPadding;
	}
}

function getBareResultsGridInfoStyles(info: BareResultsGridInfo): string {
	let content = '';
	if (info.fontFamily) {
		content += `font-family: ${info.fontFamily};`;
	}
	if (info.fontWeight) {
		content += `font-weight: ${info.fontWeight};`;
	}
	if (info.fontSize) {
		content += `font-size: ${info.fontSize}px;`;
	}
	if (info.lineHeight) {
		content += `line-height: ${info.lineHeight}px;`;
	}
	if (info.letterSpacing) {
		content += `letter-spacing: ${info.letterSpacing}px;`;
	}
	return content;
}

/**
 * Editor associated with viewing and editing the data of a query results grid.
 */
export class QueryResultsEditor extends BaseEditor {

	public static ID: string = 'workbench.editor.queryResultsEditor';
	public static AngularSelectorString: string = 'slickgrid-container.slickgridContainer';
	protected _rawOptions: BareResultsGridInfo;
	protected _input: QueryResultsInput;

	constructor(
		@ITelemetryService telemetryService: ITelemetryService,
		@IThemeService themeService: IThemeService,
		@IQueryModelService private _queryModelService: IQueryModelService,
		@IConfigurationService private _configurationService: IConfigurationService,
		@IInstantiationService private _instantiationService: IInstantiationService
	) {
		super(QueryResultsEditor.ID, telemetryService, themeService);
		this._rawOptions = BareResultsGridInfo.createFromRawSettings(this._configurationService.getValue('resultsGrid'), getZoomLevel());
		this._configurationService.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration('resultsGrid')) {
				this._rawOptions = BareResultsGridInfo.createFromRawSettings(this._configurationService.getValue('resultsGrid'), getZoomLevel());
				this.applySettings();
			}
		});
	}

	public get input(): QueryResultsInput {
		return this._input;
	}

	private applySettings() {
		if (this.input && this.input.container) {
			if (!this.input.css) {
				this.input.css = DOM.createStyleSheet(this.input.container);
			}
			let cssRuleText = '';
			if (types.isNumber(this._rawOptions.cellPadding)) {
				cssRuleText = this._rawOptions.cellPadding + 'px';
			} else {
				cssRuleText = this._rawOptions.cellPadding.join('px ') + 'px;';
			}
			let content = `.grid .slick-cell { padding: ${cssRuleText}; }`;
			content += `.grid { ${getBareResultsGridInfoStyles(this._rawOptions)} }`;
			this.input.css.innerHTML = content;
		}
	}

	createEditor(parent: HTMLElement): void {
	}

	layout(dimension: DOM.Dimension): void {
	}

	setInput(input: QueryResultsInput, options: EditorOptions): TPromise<void> {
		super.setInput(input, options);
		this.applySettings();
		if (!input.hasBootstrapped) {
			this._bootstrapAngular();
		}
		return TPromise.wrap<void>(null);
	}

	/**
	 * Load the angular components and record for this input that we have done so
	 */
	private _bootstrapAngular(): void {
		let input = <QueryResultsInput>this.input;
		let uri = input.uri;

		// Pass the correct DataService to the new angular component
		let dataService = this._queryModelService.getDataService(uri);
		if (!dataService) {
			throw new Error('DataService not found for URI: ' + uri);
		}

		// Mark that we have bootstrapped
		input.setBootstrappedTrue();

		// Get the bootstrap params and perform the bootstrap
		// Note: pass in input so on disposal this is cleaned up.
		// Otherwise many components will be left around and be subscribed
		// to events from the backing data service
		let params: IQueryComponentParams = {
			dataService: dataService,
			onSaveViewState: this.input.onSaveViewStateEmitter.event,
			onRestoreViewState: this.input.onRestoreViewStateEmitter.event
		};
		bootstrapAngular(this._instantiationService,
			QueryOutputModule,
			this.getContainer(),
			QUERY_OUTPUT_SELECTOR,
			params,
			input);
	}

	public dispose(): void {
		super.dispose();
	}
}