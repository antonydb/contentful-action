import * as github from '@actions/github';
import chalk from 'chalk';
import { Environment } from 'contentful-management';
import { Space } from 'contentful-management/dist/typings/entities/space';
import {
  CONTENTFUL_ALIAS,
  FEATURE_PATTERN,
  logLevel,
  MASTER_PATTERN,
} from './constants';
import {
  BranchNames,
  EnvironmentProps,
  EventNames,
  NameFromPatternArgs,
} from './types';

// Force colors on github
chalk.level = 3;

const stringifyObject = (obj) => JSON.stringify(obj, null, 2);

export const Logger = {
  log(message: string) {
    console.log(chalk.white(message));
  },
  success(message: string) {
    console.log('✅', chalk.green(message));
  },
  error(message: string) {
    console.log('💩', chalk.red(message));
  },
  warn(message: string) {
    console.log('⚠️', chalk.yellow(message));
  },
  info(message: string) {
    console.log('ℹ️', chalk.blue(message));
  },
  verbose(message: string) {
    if (logLevel === 'verbose') {
      console.log(chalk.white(message));
    }
  },
};

/**
 * Promise based delay
 * @param time
 */
export const delay = (time = 3000): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, time));

/**
 * Convert a branchName to a valid environmentName
 * @param branchName
 */
export const branchNameToEnvironmentName = (branchName: string): string => {
  Logger.success(`branchNameToEnvironmentName function`);
  Logger.info(`branchName: ${branchName}`);
  try {
    const newBranchName = branchName.replace(/[\/_.]/g, '-');
    return newBranchName;
  } catch (e) {
    console.trace('branchNameToEnvironmentName error', e);
    throw new Error(e);
  }
};

export enum Matcher {
  YY = 'YY',
  YYYY = 'YYYY',
  MM = 'MM',
  DD = 'DD',
  hh = 'hh',
  mm = 'mm',
  ss = 'ss',
  branch = 'branch',
}

export const matchers = {
  [Matcher.ss]: (date: Date): string =>
    `${date.getUTCSeconds()}`.padStart(2, '0'),
  [Matcher.hh]: (date: Date): string =>
    `${date.getUTCHours()}`.padStart(2, '0'),
  [Matcher.mm]: (date: Date): string =>
    `${date.getUTCMinutes()}`.padStart(2, '0'),
  [Matcher.YYYY]: (date: Date): string => `${date.getUTCFullYear()}`,
  [Matcher.YY]: (date: Date): string => `${date.getUTCFullYear()}`.substr(2, 2),
  [Matcher.MM]: (date: Date): string =>
    `${date.getUTCMonth() + 1}`.padStart(2, '0'),
  [Matcher.DD]: (date: Date): string => `${date.getDate()}`.padStart(2, '0'),
  [Matcher.branch]: (branchName: string): string => {
    Logger.success('matchers[Matcher.branch]');
    Logger.info(`Matcher.branch ${Matcher.branch}`);
    Logger.info(`branchName: ${branchName}`);
    return branchNameToEnvironmentName(branchName);
  },
};

/**
 *
 * @param pattern
 * @param branchName
 */
export const getNameFromPattern = (
  pattern: string,
  { branchName }: NameFromPatternArgs = {}
): string => {
  Logger.success(`getNameFromPattern function`);
  Logger.info(`pattern: ${pattern}`);
  Logger.info(`branchName: ${branchName}`);
  const date = new Date();
  return pattern.replace(
    /\[(YYYY|YY|MM|DD|hh|mm|ss|branch)]/g,
    (substring, match: Matcher) => {
      switch (match) {
        case Matcher.branch:
          return matchers[Matcher.branch](branchName);
        case Matcher.YYYY:
        case Matcher.YY:
        case Matcher.MM:
        case Matcher.DD:
        case Matcher.hh:
        case Matcher.mm:
        case Matcher.ss:
          return matchers[match](date);
        default:
          return substring;
      }
    }
  );
};

/**
 * Get the branchNames based on the eventName
 */
export const getBranchNames = (): BranchNames => {
  const { eventName, payload } = github.context;
  const { default_branch: defaultBranch } = payload.repository;

  // Check the eventName
  Logger.success('getBranchNames function');
  Logger.info(`eventName: ${eventName}`);
  Logger.info(`payload: ${stringifyObject(payload)}`);
  switch (eventName) {
    // If pullRequest we need to get the head and base
    case EventNames.pullRequest:
      return {
        baseRef: payload.pull_request.base.ref,
        headRef: payload.pull_request.head.ref,
        defaultBranch,
      };
    // If not pullRequest we need work on the baseRef therefore head is null
    default:
      return {
        headRef: null,
        baseRef: payload.ref.replace(/^refs\/heads\//, ''),
        defaultBranch,
      };
  }
};

/**
 * Get the environment from a space
 * Checks if an environment already exists and then flushes it
 * @param space
 * @param branchNames
 */
export const getEnvironment = async (
  space: Space,
  branchNames: BranchNames
): Promise<EnvironmentProps> => {
  Logger.success('getEnvironment function');
  Logger.info(`space ${stringifyObject(space)}`);
  Logger.info(`branchNames ${stringifyObject(branchNames)}`);
  const environmentNames = {
    base: branchNameToEnvironmentName(branchNames.baseRef),
    head: branchNames.headRef
      ? branchNameToEnvironmentName(branchNames.headRef)
      : null,
  };
  // If the Pull Request is merged and the base is the repository default_name (master|main, ...)
  // Then create an environment name for the given master_pattern
  // Else create an environment name for the given feature_pattern
  Logger.info(
    `MASTER_PATTERN: ${MASTER_PATTERN} | FEATURE_PATTERN: ${FEATURE_PATTERN}`
  );
  Logger.info(`branchNames.baseRef: ${branchNames.baseRef}`);
  Logger.info(`branchNames.defaultBranch: ${branchNames.defaultBranch}`);
  Logger.info(
    `github.context.payload: ${stringifyObject(github.context.payload)}`
  );
  // github.context.payload.pull_request?.merged... however for testing we're pushing directly to main...
  const environmentType =
    branchNames.baseRef === branchNames.defaultBranch &&
    github.context.payload.pull_request?.merged
      ? CONTENTFUL_ALIAS
      : 'feature';
  Logger.info(`environmentType: ${environmentType}`);
  Logger.info(`CONTENTFUL_ALIAS: ${CONTENTFUL_ALIAS}`);
  const isEnvTypeAlias = environmentType === CONTENTFUL_ALIAS;
  Logger.info(`isEnvTypeAlias: ${isEnvTypeAlias}`);
  Logger.info(`MASTER_PATTERN: ${MASTER_PATTERN}`);
  Logger.info(`FEATURE_PATTERN: ${FEATURE_PATTERN}`);
  Logger.info(`branchNames.headRef: ${branchNames.headRef}`);
  const environmentId =
    environmentType === CONTENTFUL_ALIAS
      ? getNameFromPattern(MASTER_PATTERN)
      : getNameFromPattern(FEATURE_PATTERN, {
          branchName: branchNames.headRef,
        });
  Logger.info(`environmentId: "${environmentId}"`);

  // If environment matches ${CONTENTFUL_ALIAS} ("master")
  // Then return it without further actions
  if (environmentType === CONTENTFUL_ALIAS) {
    return {
      environmentType,
      environmentNames,
      environmentId,
      environment: await space.createEnvironmentWithId(environmentId, {
        name: environmentId,
      }),
    };
  }
  // Else we need to check for an existing environment and flush it
  Logger.log(
    `Checking for existing versions of environment: "${environmentId}"`
  );

  try {
    const environment = await space.getEnvironment(environmentId);
    await environment?.delete();
    Logger.success(`Environment deleted: "${environmentId}"`);
  } catch (e) {
    Logger.log(`Environment not found: "${environmentId}"`);
  }

  Logger.log(`Creating environment ${environmentId}`);

  return {
    environmentType,
    environmentNames,
    environmentId,
    environment: await space.createEnvironmentWithId(environmentId, {
      name: environmentId,
    }),
  };
};

export async function getEnvironmentStatus(
  space: Space,
  environment: Environment
): Promise<{ status: 'ready' | 'failed' }> {
  const status = (await space.getEnvironment(environment.sys.id)).sys.status.sys
    .id;

  if (status === 'ready') {
    return Promise.resolve({ status });
  }

  if (status === 'failed') {
    return Promise.reject({ status });
  }

  return Promise.reject({ status: 'waiting' });
}

export function retryAsync<T>(
  asyncFunc: () => T,
  maxRetries: number
): Promise<T> {
  return new Promise((resolve, reject) => {
    let retryCount = 0;

    async function tryAsyncFunc() {
      try {
        const result = await asyncFunc();
        resolve(result);
      } catch (error) {
        if (retryCount >= maxRetries) {
          reject(error);
        } else {
          retryCount++;
          Logger.log(`Retrying (${retryCount}/${maxRetries})...`);
          await delay();
          tryAsyncFunc();
        }
      }
    }

    tryAsyncFunc();
  });
}
