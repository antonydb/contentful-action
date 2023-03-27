function stringToBoolean(booleanAsString: string, fallback: boolean) {
  if (booleanAsString.toLowerCase() === 'true') return true;
  if (booleanAsString.toLowerCase() === 'false') return false;

  return fallback;
}

export const LOG_LEVEL = process.env.LOG_LEVEL;
export const SPACE_ID = process.env.INPUT_SPACE_ID;
export const MANAGEMENT_API_KEY = process.env.INPUT_MANAGEMENT_API_KEY;

export const FEATURE_PATTERN =
  process.env.INPUT_FEATURE_PATTERN || 'GH-[branch]';
export const MASTER_PATTERN =
  process.env.INPUT_MASTER_PATTERN || 'master-[YYYY]-[MM]-[DD]-[mm][ss]';

export const DEFAULT_DELETE_FEATURE = false;
export const DELETE_FEATURE = stringToBoolean(
  process.env.INPUT_DELETE_FEATURE,
  DEFAULT_DELETE_FEATURE
);

export const DEFAULT_SET_ALIAS = false;
export const SET_ALIAS = stringToBoolean(
  process.env.INPUT_SET_ALIAS,
  DEFAULT_SET_ALIAS
);

export const CONTENTFUL_ALIAS = 'master';
