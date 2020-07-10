/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { injectable } from 'inversify';
import { basename, isAbsolute } from 'path';
import { EnvironmentVars } from '../../common/environmentVars';
import { findInPath } from '../../common/pathUtils';
import { spawnAsync } from '../../common/processUtils';
import { cannotFindNodeBinary, ErrorCodes, nodeBinaryOutOfDate } from '../../dap/errors';
import { ProtocolError } from '../../dap/protocolError';

export const INodeBinaryProvider = Symbol('INodeBinaryProvider');

/**
 * DTO returned from the NodeBinaryProvider.
 */
export class NodeBinary {
  public get canUseSpacesInRequirePath() {
    return this.majorVersion ? this.majorVersion >= 12 : true;
  }

  constructor(public readonly path: string, public majorVersion: number | undefined) {}
}

/**
 * Utility that resolves a path to Node.js and validates
 * it's a debuggable version./
 */
@injectable()
export class NodeBinaryProvider {
  /**
   * A set of binary paths we know are good and which can skip additional
   * validation. We don't store bad mappings, because a user might reinstall
   * or upgrade node in-place after we tell them it's outdated.
   */
  private readonly knownGoodMappings = new Map<string, NodeBinary>();

  /**
   * Validates the path and returns an absolute path to the Node binary to run.
   */
  public async resolveAndValidate(
    env: EnvironmentVars,
    executable = 'node',
    explicitVersion?: number,
  ): Promise<NodeBinary> {
    const location =
      executable && isAbsolute(executable) ? executable : findInPath(executable, env.value);
    if (!location) {
      throw new ProtocolError(cannotFindNodeBinary(executable));
    }

    if (explicitVersion) {
      return new NodeBinary(location, explicitVersion);
    }

    // If the runtime executable doesn't look like Node.js (could be a shell
    // script that boots Node by itself, for instance) try to find Node itself
    // on the path as a fallback.
    if (!/^node(64)?(\.exe)?$/.test(basename(location))) {
      try {
        const realBinary = await this.resolveAndValidate(env, 'node');
        return new NodeBinary(location, realBinary.majorVersion);
      } catch (e) {
        // if we verified it's outdated, still throw the error. If it's not
        // found, at least try to run it since the package manager exists.
        if ((e as ProtocolError).cause.id === ErrorCodes.NodeBinaryOutOfDate) {
          throw e;
        }

        return new NodeBinary(location, undefined);
      }
    }

    const knownGood = this.knownGoodMappings.get(location);
    if (knownGood) {
      return knownGood;
    }

    // match the "12" in "v12.34.56"
    const version = await this.getVersionText(location);
    const majorVersion = /^v([0-9]+)\./.exec(version);
    if (!majorVersion || Number(majorVersion[1]) < 8) {
      throw new ProtocolError(nodeBinaryOutOfDate(version.trim(), location));
    }

    const entry = new NodeBinary(location, Number(majorVersion[1]));
    this.knownGoodMappings.set(location, entry);
    return entry;
  }

  public async getVersionText(binary: string) {
    try {
      const { stdout } = await spawnAsync(binary, ['--version']);
      return stdout;
    } catch {
      throw new ProtocolError(cannotFindNodeBinary(binary));
    }
  }
}
