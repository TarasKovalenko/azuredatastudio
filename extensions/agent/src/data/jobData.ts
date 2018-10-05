/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as nls from 'vscode-nls';
import * as sqlops from 'sqlops';
import * as vscode from 'vscode';
import { AgentUtils } from '../agentUtils';
import { IAgentDialogData, AgentDialogMode } from '../interfaces';

const localize = nls.loadMessageBundle();

export class JobData implements IAgentDialogData {

	private readonly JobCompletionActionCondition_Always: string =  localize('jobData.whenJobCompletes', 'When the job completes');
	private readonly JobCompletionActionCondition_OnFailure: string = localize('jobData.whenJobFails', 'When the job fails');
	private readonly JobCompletionActionCondition_OnSuccess: string = localize('jobData.whenJobSucceeds', 'When the job succeeds');

	// Error Messages
	private readonly CreateJobErrorMessage_NameIsEmpty = localize('jobData.jobNameRequired', 'Job name must be provided');

	private _ownerUri: string;
	private _jobCategories: string[];
	private _operators: string[];
	private _defaultOwner: string;
	private _jobCompletionActionConditions: sqlops.CategoryValue[];

	public dialogMode: AgentDialogMode = AgentDialogMode.CREATE;
	public name: string;
	public originalName: string;
	public enabled: boolean = true;
	public description: string;
	public category: string;
	public categoryId: number;
	public owner: string;
	public emailLevel: sqlops.JobCompletionActionCondition = sqlops.JobCompletionActionCondition.OnFailure;
	public pageLevel: sqlops.JobCompletionActionCondition = sqlops.JobCompletionActionCondition.OnFailure;
	public eventLogLevel: sqlops.JobCompletionActionCondition = sqlops.JobCompletionActionCondition.OnFailure;
	public deleteLevel: sqlops.JobCompletionActionCondition = sqlops.JobCompletionActionCondition.OnSuccess;
	public operatorToEmail: string;
	public operatorToPage: string;
	public jobSteps: sqlops.AgentJobStepInfo[];
	public jobSchedules: sqlops.AgentJobScheduleInfo[];
	public alerts: sqlops.AgentAlertInfo[];

	constructor(
		ownerUri: string,
		jobInfo: sqlops.AgentJobInfo = undefined,
		private _agentService: sqlops.AgentServicesProvider = undefined) {

		this._ownerUri = ownerUri;
		if (jobInfo) {
			this.dialogMode = AgentDialogMode.EDIT;
			this.name = jobInfo.name;
			this.originalName = jobInfo.name;
			this.owner = jobInfo.owner;
			this.category = jobInfo.category;
			this.description = jobInfo.description;
			this.enabled = jobInfo.enabled;
			this.jobSteps = jobInfo.JobSteps;
			this.jobSchedules = jobInfo.JobSchedules;
			this.alerts = jobInfo.Alerts;
		}
	}

	public get jobCategories(): string[] {
		return this._jobCategories;
	}

	public get operators(): string[] {
		return this._operators;
	}

	public get ownerUri(): string {
		return this._ownerUri;
	}

	public get defaultOwner(): string {
		return this._defaultOwner;
	}

	public get JobCompletionActionConditions(): sqlops.CategoryValue[] {
		return this._jobCompletionActionConditions;
	}

	public async initialize() {
		this._agentService = await AgentUtils.getAgentService();
		let jobDefaults = await this._agentService.getJobDefaults(this.ownerUri);
		if (jobDefaults && jobDefaults.success) {
			this._jobCategories = jobDefaults.categories.map((cat) => {
				return cat.name;
			});

			this._defaultOwner = jobDefaults.owner;

			this._operators = ['', this._defaultOwner];
		}

		this._jobCompletionActionConditions = [{
			displayName: this.JobCompletionActionCondition_OnSuccess,
			name: sqlops.JobCompletionActionCondition.OnSuccess.toString()
		}, {
			displayName: this.JobCompletionActionCondition_OnFailure,
			name: sqlops.JobCompletionActionCondition.OnFailure.toString()
		}, {
			displayName: this.JobCompletionActionCondition_Always,
			name: sqlops.JobCompletionActionCondition.Always.toString()
		}];
	}

	public async save() {
		let jobInfo: sqlops.AgentJobInfo = this.toAgentJobInfo();
		let result = this.dialogMode === AgentDialogMode.CREATE
			? await this._agentService.createJob(this.ownerUri,  jobInfo)
			: await this._agentService.updateJob(this.ownerUri, this.originalName, jobInfo);

		if (!result || !result.success) {
			vscode.window.showErrorMessage(
				localize('jobData.saveErrorMessage', "Job update failed '{0}'", result.errorMessage ? result.errorMessage : 'Unknown'));
		}
	}

	public validate(): { valid: boolean, errorMessages: string[] } {
		let validationErrors: string[] = [];

		if (!(this.name && this.name.trim())) {
			validationErrors.push(this.CreateJobErrorMessage_NameIsEmpty);
		}

		return {
			valid: validationErrors.length === 0,
			errorMessages: validationErrors
		};
	}

	public addJobSchedule(schedule: sqlops.AgentJobScheduleInfo) {
		let existingSchedule = this.jobSchedules.find(item => item.name === schedule.name);
		if (!existingSchedule) {
			this.jobSchedules.push(schedule);
		}
	}

	public toAgentJobInfo(): sqlops.AgentJobInfo {
		return {
			name: this.name,
			owner: this.owner,
			description: this.description,
			EmailLevel: this.emailLevel,
			PageLevel: this.pageLevel,
			EventLogLevel: this.eventLogLevel,
			DeleteLevel: this.deleteLevel,
			OperatorToEmail: this.operatorToEmail,
			OperatorToPage: this.operatorToPage,
			enabled: this.enabled,
			category: this.category,
			Alerts: this.alerts,
			JobSchedules: this.jobSchedules,
			JobSteps: this.jobSteps,
			// The properties below are not collected from UI
			// We could consider using a seperate class for create job request
			//
			currentExecutionStatus: 0,
			lastRunOutcome: 0,
			currentExecutionStep: '',
			hasTarget: true,
			hasSchedule: false,
			hasStep: false,
			runnable: true,
			categoryId: 0,
			categoryType: 1, // LocalJob, hard-coding the value, corresponds to the target tab in SSMS
			lastRun: '',
			nextRun: '',
			jobId: ''
		};
	}
}