/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { GlobalNewProfilerAction } from './profilerWorkbenchActions';

import { TaskRegistry } from 'sql/platform/tasks/common/tasks';
import { NewProfilerAction } from './profilerActions';

import { Registry } from 'vs/platform/registry/common/platform';
import { IWorkbenchActionRegistry, Extensions as ActionExtensions } from 'vs/workbench/common/actions';
import { CommandsRegistry } from 'vs/platform/commands/common/commands';
import { SyncActionDescriptor } from 'vs/platform/actions/common/actions';
import { ServicesAccessor, IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import * as nls from 'vs/nls';
import { IJSONSchema } from 'vs/base/common/jsonSchema';
import { IWorkbenchEditorService } from 'vs/workbench/services/editor/common/editorService';
import { IConnectionManagementService } from 'sql/parts/connection/common/connectionManagement';
import { IConnectionProfile } from 'sql/parts/connection/common/interfaces';
import { IObjectExplorerService } from '../../objectExplorer/common/objectExplorerService';
import { ProfilerInput } from 'sql/parts/profiler/editor/profilerInput';
import { TPromise } from 'vs/base/common/winjs.base';
import * as TaskUtilities from 'sql/workbench/common/taskUtilities';

// Contribute Global Actions
const category = nls.localize('profilerCategory', "Profiler");

const newProfilerSchema: IJSONSchema = {
	description: nls.localize('carbon.actions.newProfiler', 'Open up a new profiler window'),
	type: 'null',
	default: null
};

CommandsRegistry.registerCommand({
	id: 'profiler.newProfiler',
	handler: (accessor: ServicesAccessor) => {
		let editorService: IWorkbenchEditorService = accessor.get(IWorkbenchEditorService);
		let instantiationService: IInstantiationService = accessor.get(IInstantiationService);
		let connectionService: IConnectionManagementService = accessor.get(IConnectionManagementService);
		let objectExplorerService: IObjectExplorerService = accessor.get(IObjectExplorerService);

		let connectionProfile = TaskUtilities.getCurrentGlobalConnection(objectExplorerService, connectionService, editorService);
		let profilerInput = instantiationService.createInstance(ProfilerInput, connectionProfile);
		return editorService.openEditor(profilerInput, { pinned: true }, false).then(() => TPromise.as(true));
	}
});
