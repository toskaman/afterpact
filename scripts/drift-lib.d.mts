/* Type declarations for ./drift-lib.mjs (kept in sync by hand; tsc -p tests
 * fails the build if these drift from the import surface used in tests). */

export declare const COUNT_DOCS: string[];
export declare const WORDING_DOCS: string[];
export declare const BANNED: [string[], string, string, string][];
export declare const RENDER_DOC: string;
export declare const RENDER_OLD_TITLE: string;
export declare const REQUIRED: [string, string, string, string][];

export declare type FileReader = (rel: string) => string | null;

export declare function checkStalePatterns(read: FileReader): string[];
export declare function checkRequiredMarkers(read: FileReader): string[];
export declare function checkChannel3Grade(manifest: any, read: FileReader): string[];
export declare function checkTestCounts(manifest: any, read: FileReader): string[];
export declare function checkWording(manifest: any, read: FileReader): string[];
export declare function isDocsOnlyPath(path: string): boolean;

export declare function checkLineage(input: {
  verifiedCommit: string;
  headSha: string;
  isAncestor: boolean;
  changedFiles?: string[];
  gitAvailable: boolean;
}): string[];
