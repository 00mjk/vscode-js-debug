/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as vscode from 'vscode';
import {
  extensionHostConfigDefaults,
  IExtensionHostConfiguration,
  ResolvingExtensionHostConfiguration,
} from '../../configuration';
import { BaseConfigurationResolver } from './baseConfigurationResolver';
import { injectable } from 'inversify';
import { DebugType } from '../../common/contributionUtils';

/**
 * Configuration provider for Extension host debugging.
 */
@injectable()
export class ExtensionHostConfigurationResolver
  extends BaseConfigurationResolver<IExtensionHostConfiguration>
  implements vscode.DebugConfigurationProvider {
  protected async resolveDebugConfigurationAsync(
    _folder: vscode.WorkspaceFolder | undefined,
    config: ResolvingExtensionHostConfiguration,
  ): Promise<IExtensionHostConfiguration | undefined> {
    return Promise.resolve({
      ...extensionHostConfigDefaults,
      ...config,
    });
  }

  protected getType() {
    return DebugType.ExtensionHost as const;
  }
}
