/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as nls from 'vscode-nls';
import * as sqlops from 'sqlops';
import * as vscode from 'vscode';
import { AlertDialog } from './dialogs/alertDialog';
import { JobDialog } from './dialogs/jobDialog';
import { OperatorDialog } from './dialogs/operatorDialog';
import { ProxyDialog } from './dialogs/proxyDialog';
import { JobStepDialog } from './dialogs/jobStepDialog';
import { PickScheduleDialog } from './dialogs/pickScheduleDialog';

const localize = nls.loadMessageBundle();

/**
 * The main controller class that initializes the extension
 */
export class MainController {
    protected _context: vscode.ExtensionContext;

    // PUBLIC METHODS //////////////////////////////////////////////////////
    public constructor(context: vscode.ExtensionContext) {
        this._context = context;
    }

    public static showNotYetImplemented(): void {
        vscode.window.showInformationMessage(
            localize('mainController.notImplemented', "This feature is under development.  Check-out the latest insiders build if you'd like to try out the most recent changes!"));
    }

    /**
     * Activates the extension
     */
    public activate(): void {
        vscode.commands.registerCommand('agent.openJobDialog', (ownerUri: string, jobInfo: sqlops.AgentJobInfo) => {
            let dialog = new JobDialog(ownerUri, jobInfo);
            dialog.openDialog();
        });
        vscode.commands.registerCommand('agent.openNewStepDialog', (ownerUri: string, jobId: string, server: string, stepId: number) => {
			let dialog = new JobStepDialog(ownerUri, jobId, server, stepId);
			dialog.openNewStepDialog();
        });
        vscode.commands.registerCommand('agent.openPickScheduleDialog', (ownerUri: string) => {
            let dialog = new PickScheduleDialog(ownerUri);
            dialog.showDialog();
        });
        vscode.commands.registerCommand('agent.openAlertDialog', (ownerUri: string, alertInfo: sqlops.AgentAlertInfo, jobs: string[]) => {
            let dialog = new AlertDialog(ownerUri, alertInfo, jobs);
            dialog.openDialog();
        });
        vscode.commands.registerCommand('agent.openOperatorDialog', (ownerUri: string, operatorInfo: sqlops.AgentOperatorInfo) => {
            let dialog = new OperatorDialog(ownerUri, operatorInfo);
            dialog.openDialog();
        });
        vscode.commands.registerCommand('agent.openProxyDialog', (ownerUri: string, proxyInfo: sqlops.AgentProxyInfo, credentials: sqlops.CredentialInfo[]) => {
            //@TODO: reenable create proxy after snapping July release (7/14/18)
            // let dialog = new ProxyDialog(ownerUri, proxyInfo, credentials);
            // dialog.openDialog();
            MainController.showNotYetImplemented();
        });
    }

    /**
     * Deactivates the extension
     */
    public deactivate(): void {
    }
}
