// Workspace evidence for dsh-git-workflow.
//
// Git and GitHub work is meaningful in every checkout, so the provider's gate
// is deliberately simple: the session cwd must sit inside a git working tree.
// A plain directory, a docs folder outside version control, or a path above the
// repository root never sees the skill. A `.git` file counts as well, because
// linked worktrees and submodules use a file instead of a directory.
import { access, stat } from 'node:fs/promises';
import path from 'node:path';
export const MAX_ASCENT = 64;
async function exists(target) {
    try {
        await access(target);
        return true;
    }
    catch {
        return false;
    }
}
/** Nearest enclosing git checkout, including a worktree's `.git` file. */
export async function findGitRoot(cwd) {
    if (typeof cwd !== 'string' || cwd.trim() === '')
        return undefined;
    let cursor;
    try {
        cursor = path.resolve(cwd);
        if (!(await stat(cursor)).isDirectory())
            return undefined;
    }
    catch {
        return undefined;
    }
    for (let depth = 0; depth < MAX_ASCENT; depth += 1) {
        if (await exists(path.join(cursor, '.git')))
            return cursor;
        const parent = path.dirname(cursor);
        if (parent === cursor)
            return undefined;
        cursor = parent;
    }
    return undefined;
}
export async function isGitWorkflowWorkspace(cwd) {
    return (await findGitRoot(cwd)) !== undefined;
}
