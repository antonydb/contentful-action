import * as core from '@actions/core';
import { createClient } from 'contentful-management';
import { runAction } from './action';
import { managementApiKey, spaceId } from './constants';
import { Logger } from './utils';

(async () => {
  const client = createClient({
    accessToken: managementApiKey,
  });
  const space = await client.getSpace(spaceId);
  try {
    await runAction(space);
  } catch (error) {
    Logger.error(error);
    core.setFailed(error.message);
  }
})();
