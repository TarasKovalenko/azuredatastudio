/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/


import * as DOM from 'vs/base/browser/dom';
import * as tree from 'vs/base/parts/tree/browser/tree';
import * as TreeDefaults from 'vs/base/parts/tree/browser/treeDefaults';
import { Promise, TPromise } from 'vs/base/common/winjs.base';
import { IMouseEvent } from 'vs/base/browser/mouseEvent';
import { generateUuid } from 'vs/base/common/uuid';
import { JobManagementUtilities } from 'sql/parts/jobManagement/common/jobManagementUtilities';

export class JobStepsViewRow {
	public stepId: string;
	public stepName: string;
	public message: string;
	public rowID: string = generateUuid();
	public runStatus: string;
}

// Empty class just for tree input
export class JobStepsViewModel {
	public static readonly id = generateUuid();
}

export class JobStepsViewController extends TreeDefaults.DefaultController {

	protected onLeftClick(tree: tree.ITree, element: JobStepsViewRow, event: IMouseEvent, origin: string = 'mouse'): boolean {
		return true;
	}

	public onContextMenu(tree: tree.ITree, element: JobStepsViewRow, event: tree.ContextMenuEvent): boolean {
		return true;
	}

}

export class JobStepsViewDataSource implements tree.IDataSource {
	private _data: JobStepsViewRow[];

	public getId(tree: tree.ITree, element: JobStepsViewRow | JobStepsViewModel): string {
		if (element instanceof JobStepsViewModel) {
			return JobStepsViewModel.id;
		} else {
			return (element as JobStepsViewRow).rowID;
		}
	}

	public hasChildren(tree: tree.ITree, element: JobStepsViewRow | JobStepsViewModel): boolean {
		if (element instanceof JobStepsViewModel) {
			return true;
		} else {
			return false;
		}
	}

	public getChildren(tree: tree.ITree, element: JobStepsViewRow | JobStepsViewModel): Promise {
		if (element instanceof JobStepsViewModel) {
			return TPromise.as(this._data);
		} else {
			return TPromise.as(undefined);
		}
	}

	public getParent(tree: tree.ITree, element: JobStepsViewRow | JobStepsViewModel): Promise {
		if (element instanceof JobStepsViewModel) {
			return TPromise.as(undefined);
		} else {
			return TPromise.as(new JobStepsViewModel());
		}
	}

	public set data(data: JobStepsViewRow[]) {
		this._data = data;
	}
}

export interface IListTemplate {
	statusIcon: HTMLElement;
	label: HTMLElement;
}

export class JobStepsViewRenderer implements tree.IRenderer {
	private _statusIcon: HTMLElement;

	public getHeight(tree: tree.ITree, element: JobStepsViewRow): number {
		return 22 * Math.ceil(element.message.length/JobManagementUtilities.jobMessageLength);
	}

	public getTemplateId(tree: tree.ITree, element: JobStepsViewRow | JobStepsViewModel): string {
		if (element instanceof JobStepsViewModel) {
			return 'jobStepsViewModel';
		} else {
			return 'jobStepsViewRow';
		}
	}

	public renderTemplate(tree: tree.ITree, templateId: string, container: HTMLElement): IListTemplate {
		let row = DOM.$('.list-row');
		let label = DOM.$('.label');
		this._statusIcon = this.createStatusIcon();
		row.appendChild(this._statusIcon);
		row.appendChild(label);
		container.appendChild(row);
		let statusIcon = this._statusIcon;
		return { statusIcon, label };
	}

	public renderElement(tree: tree.ITree, element: JobStepsViewRow, templateId: string, templateData: IListTemplate): void {
		let stepIdCol: HTMLElement = DOM.$('div');
		stepIdCol.className = 'tree-id-col';
		stepIdCol.innerText = element.stepId;
		let stepNameCol: HTMLElement = DOM.$('div');
		stepNameCol.className = 'tree-name-col';
		stepNameCol.innerText = element.stepName;
		let stepMessageCol: HTMLElement = DOM.$('div');
		stepMessageCol.className = 'tree-message-col';
		stepMessageCol.innerText = element.message;
		templateData.label.appendChild(stepIdCol);
		templateData.label.appendChild(stepNameCol);
		templateData.label.appendChild(stepMessageCol);
		let statusClass: string;
		if (element.runStatus === 'Succeeded') {
			statusClass = ' step-passed';
		} else if (element.runStatus === 'Failed') {
			statusClass = ' step-failed';
		} else {
			statusClass = ' step-unknown';
		}
		this._statusIcon.className += statusClass;
	}

	public disposeTemplate(tree: tree.ITree, templateId: string, templateData: IListTemplate): void {
		// no op
	}

	private createStatusIcon(): HTMLElement {
		let statusIcon: HTMLElement = DOM.$('div');
		statusIcon.className += 'status-icon';
		return statusIcon;
	}
}

export class JobStepsViewFilter implements tree.IFilter {
	private _filterString: string;

	public isVisible(tree: tree.ITree, element: JobStepsViewRow): boolean {
		return this._isJobVisible();
	}

	private _isJobVisible(): boolean {
		return true;
	}

	public set filterString(val: string) {
		this._filterString = val;
	}
}
