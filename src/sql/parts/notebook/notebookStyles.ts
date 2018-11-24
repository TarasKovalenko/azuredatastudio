/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import 'vs/css!./notebook';

import { registerThemingParticipant, ITheme, ICssStyleCollector } from 'vs/platform/theme/common/themeService';
import { SIDE_BAR_BACKGROUND } from 'vs/workbench/common/theme';
import { activeContrastBorder, buttonBackground } from 'vs/platform/theme/common/colorRegistry';

registerThemingParticipant((theme: ITheme, collector: ICssStyleCollector) => {

	// Active border
	const activeBorder = theme.getColor(buttonBackground);
	if (activeBorder) {
		collector.addRule(`
			.notebookEditor .notebook-cell.active {
				border-color: ${activeBorder};
				border-width: 2px;
			}
		`);
	}

	// Inactive border
	const inactiveBorder = theme.getColor(SIDE_BAR_BACKGROUND);
	if (inactiveBorder) {
		collector.addRule(`
			.notebookEditor .notebook-cell {
				border-color: ${inactiveBorder};
				border-width: 1px;
			}
		`);
	}

	// Styling with Outline color (e.g. high contrast theme)
	const outline = theme.getColor(activeContrastBorder);
	if (outline) {
		collector.addRule(`
			.notebookEditor .notebook-cell.active {
				outline-color: ${outline};
				outline-width: 1px;
				outline-style: solid;
			}

			.notebookEditor .notebook-cell:hover:not(.active) {
				outline-style: dashed;
			}
		`);
	}
});
