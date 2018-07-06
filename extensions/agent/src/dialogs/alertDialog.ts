/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as nls from 'vscode-nls';
import * as sqlops from 'sqlops';
import { AgentDialog } from './agentDialog';
import { AgentUtils } from '../agentUtils';
import { AlertData } from '../data/alertData';

const localize = nls.loadMessageBundle();

export class AlertDialog extends AgentDialog<AlertData> {

	// Top level
	private static readonly DialogTitle: string = localize('createAlert.createAlert', 'Create Alert');
	private static readonly GeneralTabText: string = localize('createAlert.General', 'General');
	private static readonly ResponseTabText: string = localize('createAlert.Response', 'Response');
	private static readonly OptionsTabText: string = localize('createAlert.Options', 'Options');

	// General tab strings
	private static readonly NameLabel: string = localize('createAlert.Name', 'Name');
	private static readonly TypeLabel: string = localize('createAlert.Type', 'Type');
	private static readonly EnabledCheckboxLabel: string = localize('createAlert.Enabled', 'Enabled');
	private static readonly DatabaseLabel: string = localize('createAlert.DatabaseName', 'Database name');
	private static readonly ErrorNumberLabel: string = localize('createAlert.ErrorNumber', 'Error number');
	private static readonly SeverityLabel: string = localize('createAlert.Severity', 'Severity');
	private static readonly RaiseIfMessageContainsLabel: string = localize('createAlert.RaiseAlertContains', 'Raise alert when message contains');
	private static readonly MessageTextLabel: string = localize('createAlert.MessageText', 'Message text');
	private static readonly AlertTypeSqlServerEventString: string = localize('createAlert.SqlServerEventAlert', 'SQL Server event alert');
	private static readonly AlertTypePerformanceConditionString: string = localize('createAlert.PerformanceCondition', 'SQL Server performance condition alert');
	private static readonly AlertTypeWmiEventString: string = localize('createAlert.WmiEvent', 'WMI event alert');
	private static readonly AlertSeverity001Label: string = localize('createAlert.Severity001', '001 - Miscellaneous System Information');
	private static readonly AlertSeverity002Label: string = localize('createAlert.Severity002', '002 - Reserved');
	private static readonly AlertSeverity003Label: string = localize('createAlert.Severity003', '003 - Reserved');
	private static readonly AlertSeverity004Label: string = localize('createAlert.Severity004', '004 - Reserved');
	private static readonly AlertSeverity005Label: string = localize('createAlert.Severity005', '005 - Reserved');
	private static readonly AlertSeverity006Label: string = localize('createAlert.Severity006', '006 - Reserved');
	private static readonly AlertSeverity007Label: string = localize('createAlert.Severity007', '007 - Notification: Status Information');
	private static readonly AlertSeverity008Label: string = localize('createAlert.Severity008', '008 - Notification: User Intervention Required');
	private static readonly AlertSeverity009Label: string = localize('createAlert.Severity009', '009 - User Defined');
	private static readonly AlertSeverity010Label: string = localize('createAlert.Severity010', '010 - Information');
	private static readonly AlertSeverity011Label: string = localize('createAlert.Severity011', '011 - Specified Database Object Not Found');
	private static readonly AlertSeverity012Label: string = localize('createAlert.Severity012', '012 - Unused');
	private static readonly AlertSeverity013Label: string = localize('createAlert.Severity013', '013 - User Transaction Syntax Error');
	private static readonly AlertSeverity014Label: string = localize('createAlert.Severity014', '014 - Insufficient Permission');
	private static readonly AlertSeverity015Label: string = localize('createAlert.Severity015', '015 - Syntax Error in SQL Statements');
	private static readonly AlertSeverity016Label: string = localize('createAlert.Severity016', '016 - Miscellaneous User Error');
	private static readonly AlertSeverity017Label: string = localize('createAlert.Severity017', '017 - Insufficient Resources');
	private static readonly AlertSeverity018Label: string = localize('createAlert.Severity018', '018 - Nonfatal Internal Error');
	private static readonly AlertSeverity019Label: string = localize('createAlert.Severity019', '019 - Fatal Error in Resource');
	private static readonly AlertSeverity020Label: string = localize('createAlert.Severity020', '020 - Fatal Error in Current Process');
	private static readonly AlertSeverity021Label: string = localize('createAlert.Severity021', '021 - Fatal Error in Database Processes');
	private static readonly AlertSeverity022Label: string = localize('createAlert.Severity022', '022 - Fatal Error: Table Integrity Suspect');
	private static readonly AlertSeverity023Label: string = localize('createAlert.Severity023', '023 - Fatal Error: Database Integrity Suspect');
	private static readonly AlertSeverity024Label: string = localize('createAlert.Severity024', '024 - Fatal Error: Hardware Error');
	private static readonly AlertSeverity025Label: string = localize('createAlert.Severity025', '025 - Fatal Error');

	private static readonly AlertTypes: string[]  = [
		AlertDialog.AlertTypeSqlServerEventString,
		AlertDialog.AlertTypePerformanceConditionString,
		AlertDialog.AlertTypeWmiEventString
	];

	private static readonly AlertSeverities: string[]  = [
		AlertDialog.AlertSeverity001Label,
		AlertDialog.AlertSeverity002Label,
		AlertDialog.AlertSeverity003Label,
		AlertDialog.AlertSeverity004Label,
		AlertDialog.AlertSeverity005Label,
		AlertDialog.AlertSeverity006Label,
		AlertDialog.AlertSeverity007Label,
		AlertDialog.AlertSeverity008Label,
		AlertDialog.AlertSeverity009Label,
		AlertDialog.AlertSeverity010Label,
		AlertDialog.AlertSeverity011Label,
		AlertDialog.AlertSeverity012Label,
		AlertDialog.AlertSeverity013Label,
		AlertDialog.AlertSeverity014Label,
		AlertDialog.AlertSeverity015Label,
		AlertDialog.AlertSeverity016Label,
		AlertDialog.AlertSeverity017Label,
		AlertDialog.AlertSeverity018Label,
		AlertDialog.AlertSeverity019Label,
		AlertDialog.AlertSeverity020Label,
		AlertDialog.AlertSeverity021Label,
		AlertDialog.AlertSeverity022Label,
		AlertDialog.AlertSeverity023Label,
		AlertDialog.AlertSeverity024Label,
		AlertDialog.AlertSeverity025Label
	];

	// Response tab strings
	private static readonly ExecuteJobCheckBoxLabel: string = localize('createAlert.ExecuteJob', 'Execute Job');
	private static readonly ExecuteJobTextBoxLabel: string = localize('createAlert.ExecuteJobName', 'Job Name');
	private static readonly NotifyOperatorsTextBoxLabel: string =  localize('createAlert.NotifyOperators', 'Notify Operators');
	private static readonly NewJobButtonLabel: string =  localize('createAlert.NewJob', 'New Job');
	private static readonly OperatorListLabel: string =  localize('createAlert.OperatorList', 'Operator List');
	private static readonly OperatorNameColumnLabel: string =  localize('createAlert.OperatorName', 'Operator');
	private static readonly OperatorEmailColumnLabel: string =  localize('createAlert.OperatorEmail', 'E-mail');
	private static readonly OperatorPagerColumnLabel: string =  localize('createAlert.OperatorPager', 'Pager');
	private static readonly NewOperatorButtonLabel: string =  localize('createAlert.NewOperator', 'New Operator');

	// Options tab strings
	private static readonly IncludeErrorInEmailCheckBoxLabel: string =  localize('createAlert.IncludeErrorInEmail', 'Include alert error text in e-mail');
	private static readonly IncludeErrorInPagerCheckBoxLabel: string =  localize('createAlert.IncludeErrorInPager', 'Include alert error text in pager');
	private static readonly AdditionalMessageTextBoxLabel: string =  localize('createAlert.AdditionalNotification', 'Additional notification message to send');
	private static readonly DelayBetweenResponsesTextBoxLabel: string =  localize('createAlert.DelayBetweenResponse', 'Delay between responses');
	private static readonly DelayMinutesTextBoxLabel: string =  localize('createAlert.DelayMinutes', 'Delay Minutes');
	private static readonly DelaySecondsTextBoxLabel: string =  localize('createAlert.DelaySeconds', 'Delay Seconds');

	// UI Components
	private generalTab: sqlops.window.modelviewdialog.DialogTab;
	private responseTab: sqlops.window.modelviewdialog.DialogTab;
	private optionsTab: sqlops.window.modelviewdialog.DialogTab;

	// General tab controls
	private nameTextBox: sqlops.InputBoxComponent;
	private typeDropDown: sqlops.DropDownComponent;
	private severityDropDown: sqlops.DropDownComponent;
	private databaseDropDown: sqlops.DropDownComponent;
	private enabledCheckBox: sqlops.CheckBoxComponent;
	private raiseAlertMessageCheckBox: sqlops.CheckBoxComponent;
	private raiseAlertMessageTextBox: sqlops.InputBoxComponent;

	// Response tab controls
	private executeJobTextBox: sqlops.InputBoxComponent;
	private executeJobCheckBox: sqlops.CheckBoxComponent;
	private newJobButton: sqlops.ButtonComponent;
	private notifyOperatorsCheckBox: sqlops.CheckBoxComponent;
	private operatorsTable: sqlops.TableComponent;
	private newOperatorButton: sqlops.ButtonComponent;

	// Options tab controls
	private additionalMessageTextBox: sqlops.InputBoxComponent;
	private includeErrorInEmailTextBox: sqlops.CheckBoxComponent;
	private includeErrorInPagerTextBox: sqlops.CheckBoxComponent;
	private delayMinutesTextBox: sqlops.InputBoxComponent;
	private delaySecondsTextBox: sqlops.InputBoxComponent;

	constructor(ownerUri: string) {
		super(ownerUri, new AlertData(ownerUri), AlertDialog.DialogTitle);
	}

	protected async initializeDialog(dialog: sqlops.window.modelviewdialog.Dialog) {
		let databases = await AgentUtils.getDatabases(this.ownerUri);
		this.generalTab = sqlops.window.modelviewdialog.createTab(AlertDialog.GeneralTabText);
		this.responseTab = sqlops.window.modelviewdialog.createTab(AlertDialog.ResponseTabText);
		this.optionsTab = sqlops.window.modelviewdialog.createTab(AlertDialog.OptionsTabText);

		this.initializeGeneralTab(databases);
		this.initializeResponseTab();
		this.initializeOptionsTab();

		dialog.content = [this.generalTab, this.responseTab, this.optionsTab];
	}

	private initializeGeneralTab(databases: string[]) {
		this.generalTab.registerContent(async view => {
			this.nameTextBox = view.modelBuilder.inputBox().component();

			this.enabledCheckBox = view.modelBuilder.checkBox()
				.withProperties({
					label: AlertDialog.EnabledCheckboxLabel
				}).component();

			this.databaseDropDown = view.modelBuilder.dropDown()
				.withProperties({
					value: databases[0],
					values: databases
				}).component();

			this.typeDropDown = view.modelBuilder.dropDown()
				.withProperties({
					value: AlertDialog.AlertTypes[0],
					values: AlertDialog.AlertTypes
				}).component();

			this.severityDropDown = view.modelBuilder.dropDown()
				.withProperties({
					value: AlertDialog.AlertSeverities[0],
					values: AlertDialog.AlertSeverities
				}).component();

			this.raiseAlertMessageCheckBox = view.modelBuilder.checkBox()
				.withProperties({
					label: AlertDialog.RaiseIfMessageContainsLabel
				}).component();

			this.raiseAlertMessageTextBox = view.modelBuilder.inputBox().component();

			let formModel = view.modelBuilder.formContainer()
				.withFormItems([{
					component: this.nameTextBox,
					title: AlertDialog.NameLabel
				}, {
					component: this.enabledCheckBox,
					title: ''
				}, {
					component: this.typeDropDown,
					title: AlertDialog.TypeLabel
				}, {
					component: this.databaseDropDown,
					title: AlertDialog.DatabaseLabel
				}, {
					component: this.severityDropDown,
					title: AlertDialog.SeverityLabel
				}, {
					component: this.raiseAlertMessageCheckBox,
					title: AlertDialog.RaiseIfMessageContainsLabel
				}, {
					component: this.raiseAlertMessageTextBox,
					title: AlertDialog.MessageTextLabel
				}
			]).withLayout({ width: '100%' }).component();

			await view.initializeModel(formModel);
		});
	}

	private initializeResponseTab() {
		this.responseTab.registerContent(async view => {
			this.executeJobCheckBox = view.modelBuilder.checkBox()
				.withProperties({
					label: AlertDialog.ExecuteJobCheckBoxLabel
				}).component();

			this.executeJobTextBox = view.modelBuilder.inputBox().component();

			this.newJobButton = view.modelBuilder.button().withProperties({
					label: AlertDialog.NewJobButtonLabel,
					width: 80
				}).component();

			this.notifyOperatorsCheckBox = view.modelBuilder.checkBox()
				.withProperties({
					label: AlertDialog.NotifyOperatorsTextBoxLabel
				}).component();

			this.operatorsTable = view.modelBuilder.table()
				.withProperties({
					columns: [
						AlertDialog.OperatorNameColumnLabel,
						AlertDialog.OperatorEmailColumnLabel,
						AlertDialog.OperatorPagerColumnLabel
					],
					data: [],
					height: 500
				}).component();

			this.newOperatorButton = view.modelBuilder.button().withProperties({
					label: this.newOperatorButton,
					width: 80
				}).component();

			let formModel = view.modelBuilder.formContainer()
				.withFormItems([{
					component: this.executeJobCheckBox,
					title: ''
				}, {
					component: this.executeJobTextBox,
					title: AlertDialog.ExecuteJobTextBoxLabel
				}, {
					component: this.newJobButton,
					title: AlertDialog.NewJobButtonLabel
				}, {
					component: this.notifyOperatorsCheckBox,
					title: ''
				}, {
					component: this.operatorsTable,
					title: AlertDialog.OperatorListLabel,
					actions: [this.newOperatorButton]
				}]).withLayout({ width: '100%' }).component();

			await view.initializeModel(formModel);
		});
	}

	private initializeOptionsTab() {
		this.optionsTab.registerContent(async view => {

			this.includeErrorInEmailTextBox = view.modelBuilder.checkBox()
				.withProperties({
					label: AlertDialog.IncludeErrorInEmailCheckBoxLabel
				}).component();

			this.includeErrorInPagerTextBox = view.modelBuilder.checkBox()
				.withProperties({
					label: AlertDialog.IncludeErrorInPagerCheckBoxLabel
				}).component();

			this.additionalMessageTextBox = view.modelBuilder.inputBox().component();

			this.delayMinutesTextBox = view.modelBuilder.inputBox().component();

			this.delaySecondsTextBox = view.modelBuilder.inputBox().component();

			let formModel = view.modelBuilder.formContainer()
				.withFormItems([{
					component: this.includeErrorInEmailTextBox,
					title: ''
				}, {
					component: this.includeErrorInPagerTextBox,
					title: ''
				}, {
					component: this.additionalMessageTextBox,
					title: AlertDialog.AdditionalMessageTextBoxLabel
				}, {
					component: this.delayMinutesTextBox,
					title: AlertDialog.DelayMinutesTextBoxLabel
				}, {
					component: this.delaySecondsTextBox,
					title: AlertDialog.DelaySecondsTextBoxLabel
				}]).withLayout({ width: '100%' }).component();

			await view.initializeModel(formModel);
		});
	}

	private getSeverityNumber(): number {
		let selected = this.getDropdownValue(this.severityDropDown);
		let severityNumber: number = 0;
		if (selected) {
			let index = AlertDialog.AlertSeverities.indexOf(selected);
			if (index >= 0) {
				severityNumber = index;
			}
		}
		return severityNumber;
	}

	protected updateModel() {
		this.model.name = this.nameTextBox.value;
		this.model.isEnabled = this.enabledCheckBox.checked;

		this.model.alertType = this.getDropdownValue(this.typeDropDown);
		this.model.databaseName = this.getDropdownValue(this.databaseDropDown);
		this.model.severity = this.getSeverityNumber();

		let raiseIfError = this.raiseAlertMessageCheckBox.checked;
		if (raiseIfError) {
			let messageText = this.raiseAlertMessageTextBox.value;
		}
	}
}
