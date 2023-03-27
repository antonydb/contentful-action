import * as core from '@actions/core';
import * as github from '@actions/github';
import { runMigration } from 'contentful-migration/built/bin/cli';
import path from 'path';

import {
  CONTENTFUL_ALIAS,
  DELETE_FEATURE,
  SET_ALIAS,
  FEATURE_PATTERN,
  SPACE_ID,
  MANAGEMENT_API_KEY,
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

const migrationDir = process.env.INPUT_MIGRATIONS_DIR || 'migrations';

const { error: err, info, log, success, verbose, warn }  = Logger

/**
 *
 * @param space
 */
export const runAction = async (space: Space): Promise<void> => {
  const branchNames = getBranchNames();
  const context = github.context;

  const githubToken = core.getInput('github_token');
  const octokit = github.getOctokit(githubToken);

  // Get list of changed files in the commit
  let changedFiles: string[] = [];
  try {
    const response = await octokit.repos.compareCommits({
      owner: context.repo.owner,
      repo: context.repo.repo,
      head: branchNames.headRef,
      base: branchNames.baseRef,
    });

    changedFiles = response.data.files.map((file) => file.filename);
  } catch (error) {
    throw new Error(error);
  }

  info(`Changed files: ${JSON.stringify(changedFiles)}`);

  const { environmentId, environment, environmentType } = await getEnvironment(
    space,
    branchNames
  );

  const { status } = await retryAsync<ReturnType<typeof getEnvironmentStatus>>(
    () => getEnvironmentStatus(space, environment),
    10
  );

  if (status === 'ready') {
    success(`Successfully created new environment: "${environmentId}"`);
  } else {
    warn('Environment creation failed');
  }

  verbose('Update API Keys to allow access to new environment');
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
      verbose(`Updating: "${key.sys.id}"`);
      key.environments.push(newEnv);
      return key.update();
    })
  );

  verbose('Read all the available migrations from the file system');
  const migrationOptions = {
    spaceId: SPACE_ID,
    environmentId,
    accessToken: MANAGEMENT_API_KEY,
    yes: true,
  };

  const filesToMigrate = changedFiles.filter(
    (file) => file.indexOf(`${migrationDir}/`) === 0
  );

  for (let filePath of filesToMigrate) {
    verbose(`Running ${filePath}`);
    await runMigration({
      ...migrationOptions,
      filePath: path.resolve(filePath),
    });
    success(`Migration script ${filePath}.js succeeded`);
  }

  log(`Checking if we need to update ${CONTENTFUL_ALIAS} alias`);
  // If the environmentType is ${CONTENTFUL_ALIAS} ("master")
  // Then set the alias to the new environment
  // Else inform the user

  if (environmentType === CONTENTFUL_ALIAS && SET_ALIAS) {
    log(`Running on ${CONTENTFUL_ALIAS}.`);
    log(`Updating ${CONTENTFUL_ALIAS} alias.`);

    try {
      const alias = await space.getEnvironmentAlias(CONTENTFUL_ALIAS);
      alias.environment.sys.id = environmentId;
      await alias.update();
      success(`alias ${alias.sys.id} updated.`);
    } catch (error) {
      err(error);
    }
  } else {
    verbose('Running on feature branch');
    verbose('No alias changes required');
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
      log(`Delete the environment: ${environmentIdToDelete}`);
      const environment = await space.getEnvironment(environmentIdToDelete);
      await environment?.delete();
      success(`Deleted the environment: ${environmentIdToDelete}`);
    } catch (error) {
      err('Cannot delete the environment');
    }
  }

  // Set the outputs for further actions
  core.setOutput(
    'environment_url',
    `https://app.contentful.com/spaces/${space.sys.id}/environments/${environmentId}`
  );
  core.setOutput('environment_name', environmentId);
  success('🚀 All done 🚀');
};
