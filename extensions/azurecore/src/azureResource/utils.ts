/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as nls from 'vscode-nls';
import { azureResource } from 'azureResource';
import { GetResourceGroupsResult, GetSubscriptionsResult, ResourceQueryResult } from 'azurecore';
import { isArray } from 'util';
import { AzureResourceGroupService } from './providers/resourceGroup/resourceGroupService';
import { TokenCredentials } from '@azure/ms-rest-js';
import { AppContext } from '../appContext';
import { IAzureResourceSubscriptionService } from './interfaces';
import { AzureResourceServiceNames } from './constants';
import { ResourceGraphClient } from '@azure/arm-resourcegraph';

const localize = nls.loadMessageBundle();

function getErrorMessage(error: Error | string): string {
	return (error instanceof Error) ? error.message : error;
}

export class AzureResourceErrorMessageUtil {
	public static getErrorMessage(error: Error | string): string {
		return localize('azure.resource.error', "Error: {0}", getErrorMessage(error));
	}
}

export function generateGuid(): string {
	let hexValues: string[] = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'A', 'B', 'C', 'D', 'E', 'F'];
	// c.f. rfc4122 (UUID version 4 = xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx)
	let oct: string = '';
	let tmp: number;
	/* tslint:disable:no-bitwise */
	for (let a: number = 0; a < 4; a++) {
		tmp = (4294967296 * Math.random()) | 0;
		oct += hexValues[tmp & 0xF] +
			hexValues[tmp >> 4 & 0xF] +
			hexValues[tmp >> 8 & 0xF] +
			hexValues[tmp >> 12 & 0xF] +
			hexValues[tmp >> 16 & 0xF] +
			hexValues[tmp >> 20 & 0xF] +
			hexValues[tmp >> 24 & 0xF] +
			hexValues[tmp >> 28 & 0xF];
	}

	// 'Set the two most significant bits (bits 6 and 7) of the clock_seq_hi_and_reserved to zero and one, respectively'
	let clockSequenceHi: string = hexValues[8 + (Math.random() * 4) | 0];
	return oct.substr(0, 8) + '-' + oct.substr(9, 4) + '-4' + oct.substr(13, 3) + '-' + clockSequenceHi + oct.substr(16, 3) + '-' + oct.substr(19, 12);
	/* tslint:enable:no-bitwise */
}

export function equals(one: any, other: any): boolean {
	if (one === other) {
		return true;
	}
	if (one === null || one === undefined || other === null || other === undefined) {
		return false;
	}
	if (typeof one !== typeof other) {
		return false;
	}
	if (typeof one !== 'object') {
		return false;
	}
	if ((Array.isArray(one)) !== (Array.isArray(other))) {
		return false;
	}

	let i: number;
	let key: string;

	if (Array.isArray(one)) {
		if (one.length !== other.length) {
			return false;
		}
		for (i = 0; i < one.length; i++) {
			if (!equals(one[i], other[i])) {
				return false;
			}
		}
	} else {
		const oneKeys: string[] = [];

		for (key in one) {
			oneKeys.push(key);
		}
		oneKeys.sort();
		const otherKeys: string[] = [];
		for (key in other) {
			otherKeys.push(key);
		}
		otherKeys.sort();
		if (!equals(oneKeys, otherKeys)) {
			return false;
		}
		for (i = 0; i < oneKeys.length; i++) {
			if (!equals(one[oneKeys[i]], other[oneKeys[i]])) {
				return false;
			}
		}
	}
	return true;
}

export async function getResourceGroups(appContext: AppContext, account?: azdata.Account, subscription?: azureResource.AzureResourceSubscription, ignoreErrors: boolean = false): Promise<GetResourceGroupsResult> {
	const result: GetResourceGroupsResult = { resourceGroups: [], errors: [] };
	if (!account?.properties?.tenants || !isArray(account.properties.tenants) || !subscription) {
		const error = new Error(localize('azure.accounts.getResourceGroups.invalidParamsError', "Invalid account or subscription"));
		if (!ignoreErrors) {
			throw error;
		}
		result.errors.push(error);
		return result;
	}
	const service = appContext.getService<AzureResourceGroupService>(AzureResourceServiceNames.resourceGroupService);
	await Promise.all(account.properties.tenants.map(async (tenant: { id: string; }) => {
		try {
			const tokenResponse = await azdata.accounts.getAccountSecurityToken(account, tenant.id, azdata.AzureResource.ResourceManagement);
			const token = tokenResponse.token;
			const tokenType = tokenResponse.tokenType;

			result.resourceGroups.push(...await service.getResources([subscription], new TokenCredentials(token, tokenType), account));
		} catch (err) {
			const error = new Error(localize('azure.accounts.getResourceGroups.queryError', "Error fetching resource groups for account {0} ({1}) subscription {2} ({3}) tenant {4} : {5}",
				account.displayInfo.displayName,
				account.displayInfo.userId,
				subscription.id,
				subscription.name,
				tenant.id,
				err instanceof Error ? err.message : err));
			console.warn(error);
			if (!ignoreErrors) {
				throw error;
			}
			result.errors.push(error);
		}
	}));
	return result;
}

export async function runResourceQuery<T extends azureResource.AzureGraphResource>(
	account: azdata.Account,
	subscriptions: azureResource.AzureResourceSubscription[],
	ignoreErrors: boolean = false,
	query: string): Promise<ResourceQueryResult<T>> {
	const result: ResourceQueryResult<T> = { resources: [], errors: [] };
	if (!account?.properties?.tenants || !isArray(account.properties.tenants)) {
		const error = new Error(localize('azure.accounts.runResourceQuery.errors.invalidAccount', "Invalid account"));
		if (!ignoreErrors) {
			throw error;
		}
		result.errors.push(error);
		return result;
	}

	// Check our subscriptions to ensure we have valid ones
	subscriptions.forEach(subscription => {
		if (!subscription.tenant) {
			const error = new Error(localize('azure.accounts.runResourceQuery.errors.noTenantSpecifiedForSubscription', "Invalid tenant for subscription"));
			if (!ignoreErrors) {
				throw error;
			}
			result.errors.push(error);
		}
	});
	if (result.errors.length > 0) {
		return result;
	}

	// We need to get a different security token for each tenant to query the resources for the subscriptions on
	// that tenant
	for (let i = 0; i < account.properties.tenants.length; ++i) {
		const tenant = account.properties.tenants[i];
		const tenantSubscriptions = subscriptions.filter(subscription => subscription.tenant === tenant.id);
		if (tenantSubscriptions.length < 1) {
			// We may not have all subscriptions or the tenant might not have any subscriptions - just ignore these ones
			continue;
		}

		let resourceClient: ResourceGraphClient;
		try {
			const tokenResponse = await azdata.accounts.getAccountSecurityToken(account, tenant.id, azdata.AzureResource.ResourceManagement);
			const token = tokenResponse.token;
			const tokenType = tokenResponse.tokenType;
			const credential = new TokenCredentials(token, tokenType);

			resourceClient = new ResourceGraphClient(credential, { baseUri: account.properties.providerSettings.settings.armResource.endpoint });
		} catch (err) {
			console.error(err);
			const error = new Error(localize('azure.accounts.runResourceQuery.errors.unableToFetchToken', "Unable to get token for tenant {0}", tenant.id));
			result.errors.push(error);
			continue;
		}

		const allResources: T[] = [];
		let totalProcessed = 0;

		const doQuery = async (skipToken?: string) => {
			const response = await resourceClient.resources({
				subscriptions: tenantSubscriptions.map(subscription => subscription.id),
				query,
				options: {
					resultFormat: 'objectArray',
					skipToken: skipToken
				}
			});
			const resources: T[] = response.data;
			totalProcessed += resources.length;
			allResources.push(...resources);
			if (response.skipToken && totalProcessed < response.totalRecords) {
				await doQuery(response.skipToken);
			}
		};
		try {
			await doQuery();
		} catch (err) {
			console.error(err);
			const error = new Error(localize('azure.accounts.runResourceQuery.errors.invalidQuery', "Invalid query"));
			result.errors.push(error);
		}
		result.resources.push(...allResources);
	}
	return result;
}

export async function getSubscriptions(appContext: AppContext, account?: azdata.Account, ignoreErrors: boolean = false): Promise<GetSubscriptionsResult> {
	const result: GetSubscriptionsResult = { subscriptions: [], errors: [] };
	if (!account?.properties?.tenants || !isArray(account.properties.tenants)) {
		const error = new Error(localize('azure.accounts.getSubscriptions.invalidParamsError', "Invalid account"));
		if (!ignoreErrors) {
			throw error;
		}
		result.errors.push(error);
		return result;
	}

	const subscriptionService = appContext.getService<IAzureResourceSubscriptionService>(AzureResourceServiceNames.subscriptionService);
	await Promise.all(account.properties.tenants.map(async (tenant: { id: string; }) => {
		try {
			const response = await azdata.accounts.getAccountSecurityToken(account, tenant.id, azdata.AzureResource.ResourceManagement);
			const token = response.token;
			const tokenType = response.tokenType;

			result.subscriptions.push(...await subscriptionService.getSubscriptions(account, new TokenCredentials(token, tokenType), tenant.id));
		} catch (err) {
			const error = new Error(localize('azure.accounts.getSubscriptions.queryError', "Error fetching subscriptions for account {0} tenant {1} : {2}",
				account.displayInfo.displayName,
				tenant.id,
				err instanceof Error ? err.message : err));
			console.warn(error);
			if (!ignoreErrors) {
				throw error;
			}
			result.errors.push(error);
		}
	}));
	return result;
}
