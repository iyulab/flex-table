// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkManifest } from '@iyulab/components/plugins/cem-check.js';

/**
 * `custom-elements.json` 이 소스와 같은 말을 하는가 — `npm run analyze` 와 같은 명령을 임시 폴더로 돌려 소스에서 도출한 기대
 * (등록된 태그 · 설명 · 이벤트)와 대조한다. 검사 규칙은 `@iyulab/components` 가 게시하는 `checkManifest` 이고, 대상은 손으로 적지 않는다.
 */
const root = fileURLToPath(new URL('../', import.meta.url));
const OUT = join('node_modules', '.cache', 'cem-test');

let manifest: Parameters<typeof checkManifest>[0]['manifest'];

beforeAll(() => {
  const cem = createRequire(import.meta.url).resolve('@custom-elements-manifest/analyzer/cem.js');
  execFileSync(process.execPath, [cem, 'analyze', '--outdir', OUT], { cwd: root, stdio: 'pipe' });
  manifest = JSON.parse(readFileSync(join(root, OUT, 'custom-elements.json'), 'utf8'));
}, 120_000);

describe('custom-elements.json', () => {
  it('says what the source says: registered elements, descriptions, no invented events, every fired event listed', () => {
    expect(checkManifest({ root, manifest })).toEqual([]);
  });
});
