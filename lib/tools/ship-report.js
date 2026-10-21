export const SHIP_MODES = ['commit', 'push', 'pr', 'pages', 'skipped'];
export const SHIP_CHECKS = ['identity', 'message', 'project', 'readback'];
export const CHECK_STATUSES = ['pass', 'fail', 'skip'];
export const MAX_COMMIT_TITLES = 8;
export const MAX_UNEXECUTED_ITEMS = 8;
export const MAX_TITLE_LENGTH = 160;
const TOP_KEYS = new Set(['mode', 'executed', 'branch', 'commits', 'remote', 'checks', 'unexecuted']);
const REMOTE_KEYS = new Set(['name', 'local_sha', 'remote_sha', 'matches']);
const SHA_RE = /^[0-9a-f]{7,40}$/i;
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function assertNoUnknownKeys(value, allowed, where) {
    const unknown = Object.keys(value).filter((key) => !allowed.has(key));
    if (unknown.length > 0)
        throw new Error(`${where} 不接受字段：${unknown.join(', ')}。`);
}
function requireString(value, name, max) {
    if (typeof value !== 'string')
        throw new Error(`${name} 必须是字符串。`);
    const trimmed = value.trim();
    if (trimmed === '')
        throw new Error(`${name} 不能为空。`);
    if (/[\r\n]/.test(trimmed))
        throw new Error(`${name} 不能包含换行。`);
    if (trimmed.length > max)
        throw new Error(`${name} 最长 ${max} 个字符。`);
    return trimmed;
}
function optionalSha(value, name) {
    if (value === undefined)
        return undefined;
    if (typeof value !== 'string' || !SHA_RE.test(value.trim())) {
        throw new Error(`${name} 必须是 7–40 位十六进制 SHA。`);
    }
    return value.trim().toLowerCase();
}
function stringList(value, name, maxItems, maxLength) {
    if (value === undefined)
        return [];
    if (!Array.isArray(value))
        throw new Error(`${name} 必须是字符串数组。`);
    if (value.length > maxItems)
        throw new Error(`${name} 最多 ${maxItems} 项。`);
    return value.map((item, index) => requireString(item, `${name}[${index}]`, maxLength));
}
export function buildShipReport(input) {
    if (!isRecord(input))
        throw new Error('git_ship_report 入参必须是对象。');
    assertNoUnknownKeys(input, TOP_KEYS, 'git_ship_report');
    if (typeof input.mode !== 'string' || !SHIP_MODES.includes(input.mode)) {
        throw new Error(`mode 必须是 ${SHIP_MODES.join('、')} 之一。`);
    }
    const mode = input.mode;
    if (typeof input.executed !== 'boolean')
        throw new Error('executed 必须是布尔值。');
    const executed = input.executed;
    if (mode === 'skipped' && executed)
        throw new Error('mode=skipped 时 executed 必须为 false。');
    const branch = requireString(input.branch, 'branch', 200);
    const commits = stringList(input.commits, 'commits', MAX_COMMIT_TITLES, MAX_TITLE_LENGTH);
    const unexecuted = stringList(input.unexecuted, 'unexecuted', MAX_UNEXECUTED_ITEMS, MAX_TITLE_LENGTH);
    if (!isRecord(input.checks))
        throw new Error('checks 必须是对象。');
    assertNoUnknownKeys(input.checks, new Set(SHIP_CHECKS), 'checks');
    const checks = {};
    for (const key of SHIP_CHECKS) {
        const value = input.checks[key];
        if (typeof value !== 'string' || !CHECK_STATUSES.includes(value)) {
            throw new Error(`checks.${key} 必须是 ${CHECK_STATUSES.join('、')} 之一。`);
        }
        checks[key] = value;
    }
    let remote;
    if (input.remote !== undefined) {
        if (!isRecord(input.remote))
            throw new Error('remote 必须是对象。');
        assertNoUnknownKeys(input.remote, REMOTE_KEYS, 'remote');
        if (typeof input.remote.matches !== 'boolean' && input.remote.matches !== null) {
            throw new Error('remote.matches 必须是布尔值或 null。');
        }
        remote = {
            matches: input.remote.matches,
            ...(input.remote.name !== undefined
                ? { name: requireString(input.remote.name, 'remote.name', 80) }
                : {}),
            ...(input.remote.local_sha !== undefined
                ? { local_sha: optionalSha(input.remote.local_sha, 'remote.local_sha') }
                : {}),
            ...(input.remote.remote_sha !== undefined
                ? { remote_sha: optionalSha(input.remote.remote_sha, 'remote.remote_sha') }
                : {}),
        };
    }
    const lines = [`git_ship_report · mode=${mode} · executed=${executed ? 'true' : 'false'}`];
    lines.push(`branch: ${branch}`);
    if (commits.length === 0) {
        lines.push('commits: none');
    }
    else {
        lines.push(`commits: ${commits.length}`);
        lines.push(...commits.map((title, index) => `${index + 1}. ${title}`));
    }
    lines.push(`checks: ${SHIP_CHECKS.map((key) => `${key}=${checks[key]}`).join(' · ')}`);
    if (remote === undefined) {
        lines.push('remote: not reported');
    }
    else {
        const parts = [`matches=${remote.matches === null ? 'unknown' : String(remote.matches)}`];
        if (remote.name)
            parts.unshift(remote.name);
        if (remote.local_sha)
            parts.push(`local=${remote.local_sha.slice(0, 8)}`);
        if (remote.remote_sha)
            parts.push(`remote=${remote.remote_sha.slice(0, 8)}`);
        lines.push(`remote: ${parts.join(' · ')}`);
    }
    if (unexecuted.length === 0) {
        lines.push('not done: none');
    }
    else {
        lines.push('not done:');
        lines.push(...unexecuted.map((item) => `- ${item}`));
    }
    return { receipt: lines.join('\n') };
}
const RESULT_SCHEMA = {
    type: 'object',
    additionalProperties: false,
    properties: { receipt: { type: 'string' } },
    required: ['receipt'],
};
const CHECK_PROPERTIES = Object.fromEntries(SHIP_CHECKS.map((key) => [key, { type: 'string', enum: [...CHECK_STATUSES] }]));
export function registerShipReportTool(tools) {
    tools.register({
        name: 'git_ship_report',
        description: '渲染一张闭集交付回执，作为交付任务的最后一步。字段只接受 mode（commit/push/pr/pages/skipped）、executed、branch、最多 8 条提交标题、远端 SHA 是否一致、identity/message/project/readback 四项检查的 pass/fail/skip、未做项。不写文件、不执行 git；未知字段或超出闭集直接报错。正常情况下整次交付只调用一次，不要用它替代真实检查。',
        parameters: {
            type: 'object',
            additionalProperties: false,
            properties: {
                mode: {
                    type: 'string',
                    enum: [...SHIP_MODES],
                    description: '本次交付停在哪个动作：commit、push、pr、pages 或 skipped（用户撤回/无法执行）。',
                },
                executed: { type: 'boolean', description: '该动作是否真的执行了。' },
                branch: { type: 'string', description: '实际操作的本地分支。' },
                commits: {
                    type: 'array',
                    items: { type: 'string' },
                    maxItems: MAX_COMMIT_TITLES,
                    description: '本次交付涉及的提交标题，最多 8 条；省略表示没有提交。',
                },
                remote: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                        name: { type: 'string', description: '远端名，例如 origin。' },
                        local_sha: { type: 'string', description: '本地 HEAD SHA（7–40 位十六进制）。' },
                        remote_sha: { type: 'string', description: 'git ls-remote 读回的远端 SHA（7–40 位十六进制）。' },
                        matches: {
                            oneOf: [{ type: 'boolean' }, { type: 'null' }],
                            description: '远端 SHA 是否与本地一致；未核对时用 null。',
                        },
                    },
                    required: ['matches'],
                    description: '远端核对结果；只做本地提交时可省略。',
                },
                checks: {
                    type: 'object',
                    additionalProperties: false,
                    properties: CHECK_PROPERTIES,
                    required: [...SHIP_CHECKS],
                    description: '四项检查结果；未做该项用 skip，不要用 pass 代替。',
                },
                unexecuted: {
                    type: 'array',
                    items: { type: 'string' },
                    maxItems: MAX_UNEXECUTED_ITEMS,
                    description: '明确未执行的项，例如“未打标签”“未创建 PR”，最多 8 条。',
                },
            },
            required: ['mode', 'executed', 'branch', 'checks'],
        },
        output: {
            schema: RESULT_SCHEMA,
            render: (_args, value) => [{ type: 'text', text: value.receipt }],
        },
        async execute(args, _exec) {
            return buildShipReport(args);
        },
        presentCall(args) {
            const mode = isRecord(args) && typeof args.mode === 'string' ? args.mode : 'unknown';
            return {
                card: 'generic',
                title: '交付回执',
                kind: 'execute',
                locations: [{ path: '.' }],
                rawInput: `mode=${mode}`,
                content: [{ type: 'text', text: `交付回执：${mode}` }],
            };
        },
        presentResult(_args, result) {
            return { card: 'generic', title: '交付回执', content: result.content };
        },
    });
}
