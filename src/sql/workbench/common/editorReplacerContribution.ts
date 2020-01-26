/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IWorkbenchContribution } from 'vs/workbench/common/contributions';
import { IDisposable, dispose } from 'vs/base/common/lifecycle';
import { IEditorService, IOpenEditorOverride } from 'vs/workbench/services/editor/common/editorService';
import { IEditorInput } from 'vs/workbench/common/editor';
import { IEditorOptions, ITextEditorOptions } from 'vs/platform/editor/common/editor';
import { IEditorGroup } from 'vs/workbench/services/editor/common/editorGroupsService';
import { IModeService } from 'vs/editor/common/services/modeService';
import { FileEditorInput } from 'vs/workbench/contrib/files/common/editors/fileEditorInput';
import { Registry } from 'vs/platform/registry/common/platform';
import * as path from 'vs/base/common/path';

import { ILanguageAssociationRegistry, Extensions as LanguageAssociationExtensions } from 'sql/workbench/common/languageAssociation';
import { UntitledTextEditorInput } from 'vs/workbench/common/editor/untitledTextEditorInput';

const languageAssociationRegistry = Registry.as<ILanguageAssociationRegistry>(LanguageAssociationExtensions.LanguageAssociations);

export class EditorReplacementContribution implements IWorkbenchContribution {
	private editorOpeningListener: IDisposable;

	constructor(
		@IEditorService private readonly editorService: IEditorService,
		@IModeService private readonly modeService: IModeService
	) {
		this.editorOpeningListener = this.editorService.overrideOpenEditor((editor, options, group) => this.onEditorOpening(editor, options, group));
	}

	private onEditorOpening(editor: IEditorInput, options: IEditorOptions | ITextEditorOptions | undefined, group: IEditorGroup): IOpenEditorOverride | undefined {
		// If the resource was already opened before in the group, do not prevent
		// the opening of that resource. Otherwise we would have the same settings
		// opened twice (https://github.com/Microsoft/vscode/issues/36447)
		// if (group.isOpened(editor)) {
		// 	return undefined;
		// }

		if (!(editor instanceof FileEditorInput) && !(editor instanceof UntitledTextEditorInput)) {
			return undefined;
		}

		let language: string;
		if (editor instanceof FileEditorInput) {
			language = editor.getPreferredMode();
		} else if (editor instanceof UntitledTextEditorInput) {
			language = editor.getMode();
		}

		if (!language) { // in the case the input doesn't have a preferred mode set we will attempt to guess the mode from the file path
			language = this.modeService.getModeIdByFilepathOrFirstLine(editor.getResource());
		}

		if (!language) {
			// just use the extension
			language = path.extname(editor.getResource().toString()).slice(1); // remove the .
		}

		if (!language) {
			const defaultInputCreator = languageAssociationRegistry.defaultAssociation;
			if (defaultInputCreator) {
				editor.setMode(defaultInputCreator[0]);
				const newInput = defaultInputCreator[1].convertInput(editor);
				if (newInput) {
					return { override: this.editorService.openEditor(newInput, options, group) };
				}
			}
		} else {
			const inputCreator = languageAssociationRegistry.getAssociationForLanguage(language);
			if (inputCreator) {
				const newInput = inputCreator.convertInput(editor);
				if (newInput) {
					return { override: this.editorService.openEditor(newInput, options, group) };
				}
			}
		}

		return undefined;
	}

	dispose(): void {
		dispose(this.editorOpeningListener);
	}
}
