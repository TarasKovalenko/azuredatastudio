/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as should from 'should';
import * as TypeMoq from 'typemoq';
import * as path from 'path';
import { nb } from 'sqlops';

import URI from 'vs/base/common/uri';
import * as tempWrite from 'temp-write';
import { LocalContentManager } from 'sql/services/notebook/localContentManager';
import * as testUtils from '../../../utils/testUtils';
import { CellTypes } from 'sql/parts/notebook/models/contracts';

let expectedNotebookContent: nb.INotebookContents = {
    cells: [{
        cell_type: CellTypes.Code,
        source: 'insert into t1 values (c1, c2)',
        metadata: { language: 'python' },
        execution_count: 1
    }],
    metadata: {
        kernelspec: {
            name: 'mssql',
            language: 'sql'
        }
    },
    nbformat: 5,
    nbformat_minor: 0
};
let notebookContentString = JSON.stringify(expectedNotebookContent);

function verifyMatchesExpectedNotebook(notebook: nb.INotebookContents): void {
    should(notebook.cells).have.length(1, 'Expected 1 cell');
    should(notebook.cells[0].cell_type).equal(CellTypes.Code);
    should(notebook.cells[0].source).equal(expectedNotebookContent.cells[0].source);
    should(notebook.metadata.kernelspec.name).equal(expectedNotebookContent.metadata.kernelspec.name);
    should(notebook.nbformat).equal(expectedNotebookContent.nbformat);
    should(notebook.nbformat_minor).equal(expectedNotebookContent.nbformat_minor);
}

describe('Local Content Manager', function(): void {
    let contentManager = new LocalContentManager();

    it('Should return undefined if path is undefined', async function(): Promise<void> {
        let content = await contentManager.getNotebookContents(undefined);
        should(content).be.undefined();
        // tslint:disable-next-line:no-null-keyword
        content = await contentManager.getNotebookContents(null);
        should(content).be.undefined();
    });

    it('Should throw if file does not exist', async function(): Promise<void> {
        await testUtils.assertThrowsAsync(async () => await contentManager.getNotebookContents(URI.file('/path/doesnot/exist.ipynb')), undefined);
    });
    it('Should return notebook contents parsed as INotebook when valid notebook file parsed', async function(): Promise<void> {
        // Given a file containing a valid notebook
        let localFile = tempWrite.sync(notebookContentString, 'notebook.ipynb');
        // when I read the content
        let notebook = await contentManager.getNotebookContents(URI.file(localFile));
        // then I expect notebook format to match
        verifyMatchesExpectedNotebook(notebook);
    });
    it('Should ignore invalid content in the notebook file', async function(): Promise<void> {
        // Given a file containing a notebook with some garbage properties
        let invalidContent = notebookContentString + '\\nasddfdsafasdf';
        let localFile = tempWrite.sync(invalidContent, 'notebook.ipynb');
        // when I read the content
        let notebook = await contentManager.getNotebookContents(URI.file(localFile));
        // then I expect notebook format to still be valid
        verifyMatchesExpectedNotebook(notebook);
    });
});
