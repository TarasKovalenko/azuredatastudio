/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as azdata from 'azdata';
import * as fs from 'fs';
import * as cp from 'promisify-child-process';
import * as sudo from 'sudo-prompt';
import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
import { OsType } from '../interfaces';
import { getErrorMessage } from '../utils';

const localize = nls.loadMessageBundle();
const extensionOutputChannel = localize('resourceDeployment.outputChannel', "Deployments");
const sudoPromptTitle = 'AzureDataStudio';
/**
 * Abstract of platform dependencies
 */
export interface IPlatformService {
	osType(): OsType;
	platform(): string;
	storagePath(): string;
	copyFile(source: string, target: string): Promise<void>;
	fileExists(file: string): Promise<boolean>;
	openFile(filePath: string): void;
	showErrorMessage(error: Error | string): void;
	logToOutputChannel(data: string | Buffer, header?: string): void;
	outputChannelName(): string;
	showOutputChannel(preserveFocus?: boolean): void;
	isNotebookNameUsed(title: string): boolean;
	makeDirectory(path: string): Promise<void>;
	ensureDirectoryExists(directory: string): Promise<void>;
	readTextFile(filePath: string): Promise<string>;
	runCommand(command: string, options?: CommandOptions): Promise<string>;
	saveTextFile(content: string, path: string): Promise<void>;
	deleteFile(path: string, ignoreError?: boolean): Promise<void>;
}

interface CommandOutput {
	stdout: string;
	stderr: string;
}

export interface CommandOptions {
	workingDirectory?: string;
	additionalEnvironmentVariables?: NodeJS.ProcessEnv;
	sudo?: boolean;
	commandTitle?: string;
	ignoreError?: boolean;
}

/**
 * A class that provides various services to interact with the platform on which the code runs
 */
export class PlatformService implements IPlatformService {

	private _outputChannel: vscode.OutputChannel = vscode.window.createOutputChannel(extensionOutputChannel);

	constructor(private _storagePath: string = '') {
	}

	storagePath(): string {
		return this._storagePath;
	}

	platform(): string {
		return process.platform;
	}

	outputChannelName(): string {
		return this._outputChannel.name;
	}

	showOutputChannel(preserveFocus?: boolean): void {
		this._outputChannel.show(preserveFocus);
	}

	osType(platform: string = this.platform()): OsType {
		if (Object.values(OsType).includes(<OsType>platform)) {
			return <OsType>platform;
		} else {
			return OsType.others;
		}
	}

	async copyFile(source: string, target: string): Promise<void> {
		return await fs.promises.copyFile(source, target);
	}

	async fileExists(file: string): Promise<boolean> {
		try {
			await fs.promises.access(file);
			return true;
		} catch (error) {
			if (error && error.code === 'ENOENT') {
				return false;
			}
			throw error;
		}
	}

	openFile(filePath: string): void {
		vscode.commands.executeCommand('vscode.open', vscode.Uri.file(filePath));
	}

	showErrorMessage(error: Error | string): void {
		vscode.window.showErrorMessage(getErrorMessage(error));
	}

	isNotebookNameUsed(title: string): boolean {
		return (azdata.nb.notebookDocuments.findIndex(doc => doc.isUntitled && doc.fileName === title) > -1);
	}

	async makeDirectory(path: string): Promise<void> {
		await fs.promises.mkdir(path);
	}

	/**
	 *This function ensures that the given {@link directory} does not exist it creates it. It creates only the most leaf folder so if any ancestor folders are missing then this command throws an error.
	 * @param directory - the path to ensure
	 */
	async ensureDirectoryExists(directory: string): Promise<void> {
		if (!await this.fileExists(directory)) {
			await this.makeDirectory(directory);
		}
	}

	async readTextFile(filePath: string): Promise<string> {
		return await fs.promises.readFile(filePath, 'utf8');
	}

	public logToOutputChannel(data: string | Buffer, header?: string): void {
		//input data is localized by caller
		data.toString().split(/\r?\n/)
			.forEach(line => {
				this._outputChannel.appendLine(header ? header + line : line);
			});
	}

	private outputDataChunk(data: string | Buffer, outputChannel: vscode.OutputChannel, header: string): void {
		data.toString().split(/\r?\n/)
			.forEach(line => {
				outputChannel.appendLine(header + line);
			});
	}

	async runCommand(command: string, options?: CommandOptions): Promise<string> {
		if (options && options.commandTitle !== undefined && options.commandTitle !== null) {
			this._outputChannel.appendLine(`\t[ ${options.commandTitle} ]`); // commandTitle inputs are localized by caller
		}

		try {
			if (options && options.sudo) {
				return await this.runSudoCommand(command, this._outputChannel, options);
			} else {
				return await this.runStreamedCommand(command, this._outputChannel, options);
			}
		} catch (error) {
			this._outputChannel.append(localize('platformService.RunCommand.ErroredOut', "\t>>> {0}   … errored out: {1}", command, getErrorMessage(error))); //errors are localized in our code where emitted, other errors are pass through from external components that are not easily localized
			if (!(options && options.ignoreError)) {
				throw error;
			} else {
				this._outputChannel.append(localize('platformService.RunCommand.IgnoringError', "\t>>> Ignoring error in execution and continuing tool deployment"));
				return '';
			}
		}
	}

	private sudoExec(command: string, options: sudo.SudoOptions): Promise<CommandOutput> {
		return new Promise<CommandOutput>((resolve, reject) => {
			sudo.exec(command, options, (error, stdout, stderr) => {
				if (error) {
					reject(error);
				} else {
					resolve({ stdout, stderr });
				}
			});
		});
	}

	private async runSudoCommand(command: string, outputChannel: vscode.OutputChannel, options?: CommandOptions): Promise<string> {
		outputChannel.appendLine(`    sudo> ${command}`);

		if (options && options.workingDirectory) {
			process.chdir(options.workingDirectory);
		}

		// Workaround for https://github.com/jorangreef/sudo-prompt/issues/111
		// DevNote: The environment variable being excluded from getting passed to sudo will never exist on a 'unixy' box. So this affects windows only.
		// On my testing on windows machine for our usage the environment variables being excluded were not important for the process execution being used here.
		// If one is trying to use this code elsewhere, one should test on windows thoroughly unless the above issue is fixed.
		const origEnv: NodeJS.ProcessEnv = Object.assign({}, process.env, options && options.additionalEnvironmentVariables);
		const env: NodeJS.ProcessEnv = {};

		Object.keys(origEnv).filter(key => /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)).forEach((key) => {
			env[key] = origEnv[key];
		});
		// Workaround for  https://github.com/jorangreef/sudo-prompt/issues/111 done

		const sudoOptions = {
			name: sudoPromptTitle,
			env: env
		};

		try {
			const { stdout, stderr } = await this.sudoExec(command, sudoOptions);
			this.outputDataChunk(stdout, outputChannel, localize('platformService.RunCommand.stdout', "    stdout: "));
			this.outputDataChunk(stderr, outputChannel, localize('platformService.RunCommand.stderr', "    stderr: "));
			return stdout;
		} catch (error) {
			this.outputDataChunk(error, outputChannel, localize('platformService.RunCommand.stderr', "    stderr: "));
			throw error;
		}
	}

	private async runStreamedCommand(command: string, outputChannel: vscode.OutputChannel, options?: CommandOptions): Promise<string> {
		const stdoutData: string[] = [];
		outputChannel.appendLine(`    > ${command}`);

		const spawnOptions = {
			cwd: options && options.workingDirectory,
			env: Object.assign({}, process.env, options && options.additionalEnvironmentVariables),
			encoding: 'utf8',
			maxBuffer: 10 * 1024 * 1024, // 10 Mb of output can be captured.
			shell: true,
			detached: false,
			windowsHide: true
		};
		const child = cp.spawn(command, [], spawnOptions);

		// Add listeners to print stdout and stderr and exit code
		child.on('exit', (code: number | null, signal: string | null) => {
			if (code !== null) {
				outputChannel.appendLine(localize('platformService.RunStreamedCommand.ExitedWithCode', "    >>> {0}    … exited with code: {1}", command, code));
			} else {
				outputChannel.appendLine(localize('platformService.RunStreamedCommand.ExitedWithSignal', "    >>> {0}   … exited with signal: {1}", command, signal));
			}
		});
		child.stdout.on('data', (data: string | Buffer) => {
			stdoutData.push(data.toString());
			this.outputDataChunk(data, outputChannel, localize('platformService.RunCommand.stdout', "    stdout: "));
		});
		child.stderr.on('data', (data: string | Buffer) => { this.outputDataChunk(data, outputChannel, localize('platformService.RunCommand.stderr', "    stderr: ")); });

		await child;
		return stdoutData.join('');
	}

	saveTextFile(content: string, path: string): Promise<void> {
		return fs.promises.writeFile(path, content, 'utf8');
	}

	async deleteFile(path: string, ignoreError: boolean = true): Promise<void> {
		try {
			const exists = await this.fileExists(path);
			if (exists) {
				fs.promises.unlink(path);
			}
		}
		catch (error) {
			if (ignoreError) {
				console.error('Error occurred deleting file: ', getErrorMessage(error));
			} else {
				throw error;
			}
		}
	}
}
