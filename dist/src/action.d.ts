import { Space } from 'contentful-management';
export declare const maxRetries = 10;
/**
 *
 * @param space
 */
export declare const runAction: (space: Space) => Promise<void>;
