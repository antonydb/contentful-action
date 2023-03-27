import { Environment } from 'contentful-management';
import { Space } from 'contentful-management/dist/typings/entities/space';
import { BranchNames, EnvironmentProps, NameFromPatternArgs } from './types';
export declare const Logger: {
    log(message: string): void;
    success(message: string): void;
    error(message: string): void;
    warn(message: string): void;
    info(message: string): void;
    verbose(message: string): void;
};
/**
 * Promise based delay
 * @param time
 */
export declare const delay: (time?: number) => Promise<void>;
/**
 * Convert a branchName to a valid environmentName
 * @param branchName
 */
export declare const branchNameToEnvironmentName: (branchName: string) => string;
export declare enum Matcher {
    YY = "YY",
    YYYY = "YYYY",
    MM = "MM",
    DD = "DD",
    hh = "hh",
    mm = "mm",
    ss = "ss",
    branch = "branch"
}
export declare const matchers: {
    ss: (date: Date) => string;
    hh: (date: Date) => string;
    mm: (date: Date) => string;
    YYYY: (date: Date) => string;
    YY: (date: Date) => string;
    MM: (date: Date) => string;
    DD: (date: Date) => string;
    branch: (branchName: string) => string;
};
/**
 *
 * @param pattern
 * @param branchName
 */
export declare const getNameFromPattern: (pattern: string, { branchName }?: NameFromPatternArgs) => string;
/**
 * Get the branchNames based on the eventName
 */
export declare const getBranchNames: () => BranchNames;
/**
 * Get the environment from a space
 * Checks if an environment already exists and then flushes it
 * @param space
 * @param branchNames
 */
export declare const getEnvironment: (space: Space, branchNames: BranchNames) => Promise<EnvironmentProps>;
export declare function getEnvironmentStatus(space: Space, environment: Environment): Promise<{
    status: 'ready' | 'failed';
}>;
export declare function retryAsync<T>(asyncFunc: () => T, maxRetries: number): Promise<T>;
