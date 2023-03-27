import * as core from '@actions/core';
import * as github from '@actions/github';
import { runMigration } from 'contentful-migration/built/bin/cli';
import path from 'path';

import {
  CONTENTFUL_ALIAS,
  DELETE_FEATURE,
  SET_ALIAS,
  FEATURE_PATTERN,
  spaceId,
} from './constants';
import {
  getBranchNames,
  getEnvironment,
  getEnvironmentStatus,
  getNameFromPattern,
  Logger,
  retryAsync,
} from './utils';
import { Space } from 'contentful-management';

const defaults = {
  migrationDir: 'migrations',
};

const githubWorkspace = process.env.GITHUB_WORKSPACE;
const managementApiKey = process.env.INPUT_MANAGEMENT_API_KEY;
const migrationDirName =
  process.env.INPUT_MIGRATIONS_DIR || defaults.migrationDir;
const migrationDirPath = path.join(githubWorkspace, migrationDirName);

export const maxRetries = 10;

/**
 *
 * @param space
 */
export const runAction = async (space: Space): Promise<void> => {
  const branchNames = getBranchNames();
  const context = github.context;

  // Get list of changed files in the commit
  const githubToken = core.getInput('github_token');

  const octokit = github.getOctokit(githubToken);

  let response;

  try {
    response = await octokit.repos.compareCommits({
      owner: context.repo.owner,
      repo: context.repo.repo,
      head: branchNames.headRef,
      base: branchNames.baseRef,
    });
  } catch (error) {
    throw new Error(error, { cause: error });
  }

  const changedFiles = response.data.files.map((file) => file.filename);

  Logger.info(`Changed files: ${JSON.stringify(changedFiles)}`);

  const { environmentId, environment, environmentType } = await getEnvironment(
    space,
    branchNames
  );

  const { status } = await retryAsync<ReturnType<typeof getEnvironmentStatus>>(
    () => getEnvironmentStatus(space, environment),
    maxRetries
  );

  if (status === 'ready') {
    Logger.success(
      `Successfully processed new environment: "${environmentId}"`
    );
  } else {
    Logger.warn('Environment creation failed');
  }

  Logger.verbose('Update API Keys to allow access to new environment');
  const newEnv = {
    sys: {
      type: 'Link',
      linkType: 'Environment',
      id: environmentId,
    },
  };

  const { items: keys } = await space.getApiKeys();
  await Promise.all(
    keys.map((key) => {
      Logger.verbose(`Updating: "${key.sys.id}"`);
      key.environments.push(newEnv);
      return key.update();
    })
  );

  Logger.verbose('Read all the available migrations from the file system');
  const migrationOptions = {
    spaceId,
    environmentId,
    accessToken: managementApiKey,
    yes: true,
  };

  const filesToMigrate = changedFiles.filter(
    (file) => file.indexOf(`${migrationDirName}/`) === 0
  );

  // Allow mutations
  for (let filePath of filesToMigrate) {
    Logger.verbose(`Running ${filePath}`);
    await runMigration({ ...migrationOptions, filePath: path.resolve(filePath) });
    Logger.success(`Migration script ${filePath}.js succeeded`);
  }

  Logger.log(`Checking if we need to update ${CONTENTFUL_ALIAS} alias`);
  // If the environmentType is ${CONTENTFUL_ALIAS} ("master")
  // Then set the alias to the new environment
  // Else inform the user

  if (environmentType === CONTENTFUL_ALIAS && SET_ALIAS) {
    Logger.log(`Running on ${CONTENTFUL_ALIAS}.`);
    Logger.log(`Updating ${CONTENTFUL_ALIAS} alias.`);
    await space
      .getEnvironmentAlias(CONTENTFUL_ALIAS)
      .then((alias) => {
        alias.environment.sys.id = environmentId;
        return alias.update();
      })
      .then((alias) => Logger.success(`alias ${alias.sys.id} updated.`))
      .catch(Logger.error);
  } else {
    Logger.verbose('Running on feature branch');
    Logger.verbose('No alias changes required');
  }

  // If the sandbox environment should be deleted
  // And the baseRef is the repository default_branch (master|main ...)
  // And the Pull Request has been merged
  // Then delete the sandbox environment
  if (
    DELETE_FEATURE &&
    branchNames.baseRef === branchNames.defaultBranch &&
    github.context.payload.pull_request?.merged
  ) {
    try {
      const environmentIdToDelete = getNameFromPattern(FEATURE_PATTERN, {
        branchName: branchNames.headRef,
      });
      Logger.log(`Delete the environment: ${environmentIdToDelete}`);
      const environment = await space.getEnvironment(environmentIdToDelete);
      await environment?.delete();
      Logger.success(`Deleted the environment: ${environmentIdToDelete}`);
    } catch (error) {
      Logger.error('Cannot delete the environment');
    }
  }

  // Set the outputs for further actions
  core.setOutput(
    'environment_url',
    `https://app.contentful.com/spaces/${space.sys.id}/environments/${environmentId}`
  );
  core.setOutput('environment_name', environmentId);
  Logger.success('🚀 All done 🚀');
};
