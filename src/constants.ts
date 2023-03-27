export const logLevel = process.env.LOG_LEVEL;
export const spaceId = process.env.INPUT_SPACE_ID;
export const managementApiKey = process.env.INPUT_MANAGEMENT_API_KEY;

const booleanOr = (str: string, fallback: boolean): boolean => {
  switch (str) {
    case 'true':
      return true;
    case 'false':
      return false;
    default:
      return fallback;
  }
};

export const DEFAULT_DELETE_FEATURE = false;
export const DEFAULT_SET_ALIAS = false;

export const FEATURE_PATTERN = process.env.INPUT_FEATURE_PATTERN || 'GH-[branch]';
export const MASTER_PATTERN = process.env.INPUT_MASTER_PATTERN || 'master-[YYYY]-[MM]-[DD]-[mm][ss]';
export const DELETE_FEATURE = booleanOr(
  process.env.INPUT_DELETE_FEATURE,
  DEFAULT_DELETE_FEATURE
);
export const SET_ALIAS = booleanOr(process.env.INPUT_SET_ALIAS, DEFAULT_SET_ALIAS);

export const CONTENTFUL_ALIAS = 'master';
