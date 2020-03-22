/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as TypeMoq from 'typemoq';
import { ApiWrapper } from '../../common/apiWrapper';

export interface ViewTestContext {
	apiWrapper: TypeMoq.IMock<ApiWrapper>;
	view: azdata.ModelView;
	onClick: vscode.EventEmitter<any>;
}

export function createViewContext(): ViewTestContext {
	let onClick: vscode.EventEmitter<any> = new vscode.EventEmitter<any>();

	let apiWrapper = TypeMoq.Mock.ofType(ApiWrapper);
	let componentBase: azdata.Component = {
		id: '',
		updateProperties: () => Promise.resolve(),
		updateProperty: () => Promise.resolve(),
		updateCssStyles: undefined!,
		onValidityChanged: undefined!,
		valid: true,
		validate: undefined!,
		focus: undefined!
	};
	let button: azdata.ButtonComponent = Object.assign({}, componentBase, {
		onDidClick: onClick.event
	});
	let radioButton: azdata.RadioButtonComponent = Object.assign({}, componentBase, {
		onDidClick: onClick.event
	});
	let container = {
		clearItems: () => { },
		addItems: () => { },
		addItem: () => { },
		removeItem: () => true,
		insertItem: () => { },
		items: [],
		setLayout: () => { }
	};
	let form: azdata.FormContainer = Object.assign({}, componentBase, container, {
	});
	let flex: azdata.FlexContainer = Object.assign({}, componentBase, container, {
	});

	let buttonBuilder: azdata.ComponentBuilder<azdata.ButtonComponent> = {
		component: () => button,
		withProperties: () => buttonBuilder,
		withValidation: () => buttonBuilder
	};
	let radioButtonBuilder: azdata.ComponentBuilder<azdata.ButtonComponent> = {
		component: () => radioButton,
		withProperties: () => radioButtonBuilder,
		withValidation: () => radioButtonBuilder
	};
	let inputBox: () => azdata.InputBoxComponent = () => Object.assign({}, componentBase, {
		onTextChanged: undefined!,
		onEnterKeyPressed: undefined!,
		value: ''
	});
	let dropdown: () => azdata.DropDownComponent = () => Object.assign({}, componentBase, {
		onValueChanged: onClick.event,
		value: {
			name: '',
			displayName: ''
		},
		values: []
	});
	let declarativeTable: () => azdata.DeclarativeTableComponent = () => Object.assign({}, componentBase, {
		onDataChanged: undefined!,
		data: [],
		columns: []
	});

	let loadingComponent: () => azdata.LoadingComponent = () => Object.assign({}, componentBase, {
		loading: false,
		component: undefined!
	});

	let declarativeTableBuilder: azdata.ComponentBuilder<azdata.DeclarativeTableComponent> = {
		component: () => declarativeTable(),
		withProperties: () => declarativeTableBuilder,
		withValidation: () => declarativeTableBuilder
	};

	let loadingBuilder: azdata.LoadingComponentBuilder = {
		component: () => loadingComponent(),
		withProperties: () => loadingBuilder,
		withValidation: () => loadingBuilder,
		withItem: () => loadingBuilder
	};

	let formBuilder: azdata.FormBuilder = Object.assign({}, {
		component: () => form,
		addFormItem: () => { },
		insertFormItem: () => { },
		removeFormItem: () => true,
		addFormItems: () => { },
		withFormItems: () => formBuilder,
		withProperties: () => formBuilder,
		withValidation: () => formBuilder,
		withItems: () => formBuilder,
		withLayout: () => formBuilder
	});

	let flexBuilder: azdata.FlexBuilder = Object.assign({}, {
		component: () => flex,
		withProperties: () => flexBuilder,
		withValidation: () => flexBuilder,
		withItems: () => flexBuilder,
		withLayout: () => flexBuilder
	});

	let inputBoxBuilder: azdata.ComponentBuilder<azdata.InputBoxComponent> = {
		component: () => {
			let r = inputBox();
			return r;
		},
		withProperties: () => inputBoxBuilder,
		withValidation: () => inputBoxBuilder
	};
	let dropdownBuilder: azdata.ComponentBuilder<azdata.DropDownComponent> = {
		component: () => {
			let r = dropdown();
			return r;
		},
		withProperties: () => dropdownBuilder,
		withValidation: () => dropdownBuilder
	};

	let view: azdata.ModelView = {
		onClosed: undefined!,
		connection: undefined!,
		serverInfo: undefined!,
		valid: true,
		onValidityChanged: undefined!,
		validate: undefined!,
		initializeModel: () => { return Promise.resolve(); },
		modelBuilder: {
			radioCardGroup: undefined!,
			navContainer: undefined!,
			divContainer: undefined!,
			flexContainer: () => flexBuilder,
			splitViewContainer: undefined!,
			dom: undefined!,
			card: undefined!,
			inputBox: () => inputBoxBuilder,
			checkBox: undefined!,
			radioButton: () => radioButtonBuilder,
			webView: undefined!,
			editor: undefined!,
			diffeditor: undefined!,
			text: () => inputBoxBuilder,
			image: undefined!,
			button: () => buttonBuilder,
			dropDown: () => dropdownBuilder,
			tree: undefined!,
			listBox: undefined!,
			table: undefined!,
			declarativeTable: () => declarativeTableBuilder,
			dashboardWidget: undefined!,
			dashboardWebview: undefined!,
			formContainer: () => formBuilder,
			groupContainer: undefined!,
			toolbarContainer: undefined!,
			loadingComponent: () => loadingBuilder,
			fileBrowserTree: undefined!,
			hyperlink: undefined!,
			separator: undefined!
		}
	};
	let tab: azdata.window.DialogTab = {
		title: '',
		content: '',
		registerContent: async (handler) => {
			try {
				await handler(view);
			} catch (err) {
				console.log(err);
			}
		},
		onValidityChanged: undefined!,
		valid: true,
		modelView: undefined!
	};

	let dialogButton: azdata.window.Button = {
		label: '',
		enabled: true,
		hidden: false,
		onClick: onClick.event,

	};
	let dialogMessage: azdata.window.DialogMessage = {
		text: '',
	};
	let dialog: azdata.window.Dialog = {
		title: '',
		isWide: false,
		content: [],
		okButton: dialogButton,
		cancelButton: dialogButton,
		customButtons: [],
		message: dialogMessage,
		registerCloseValidator: () => { },
		registerOperation: () => { },
		onValidityChanged: new vscode.EventEmitter<boolean>().event,
		registerContent: () => { },
		modelView: undefined!,
		valid: true
	};
	let wizard: azdata.window.Wizard = {
		title: '',
		pages: [],
		currentPage: 0,
		doneButton: dialogButton,
		cancelButton: dialogButton,
		generateScriptButton: dialogButton,
		nextButton: dialogButton,
		backButton: dialogButton,
		customButtons: [],
		displayPageTitles: true,
		onPageChanged: onClick.event,
		addPage: () => { return Promise.resolve(); },
		removePage: () => { return Promise.resolve(); },
		setCurrentPage: () => { return Promise.resolve(); },
		open: () => { return Promise.resolve(); },
		close: () => { return Promise.resolve(); },
		registerNavigationValidator: () => { },
		message: dialogMessage,
		registerOperation: () => { }
	};
	let wizardPage: azdata.window.WizardPage = {
		title: '',
		content: '',
		customButtons: [],
		enabled: true,
		description: '',
		onValidityChanged: onClick.event,
		registerContent: () => { },
		modelView: undefined!,
		valid: true
	};
	apiWrapper.setup(x => x.createButton(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => dialogButton);
	apiWrapper.setup(x => x.createTab(TypeMoq.It.isAny())).returns(() => tab);
	apiWrapper.setup(x => x.createWizard(TypeMoq.It.isAny())).returns(() => wizard);
	apiWrapper.setup(x => x.createWizardPage(TypeMoq.It.isAny())).returns(() => wizardPage);
	apiWrapper.setup(x => x.createModelViewDialog(TypeMoq.It.isAny())).returns(() => dialog);
	apiWrapper.setup(x => x.openDialog(TypeMoq.It.isAny())).returns(() => { });

	return {
		apiWrapper: apiWrapper,
		view: view,
		onClick: onClick,
	};
}

