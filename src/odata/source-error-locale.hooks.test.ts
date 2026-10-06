import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createElement, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Locale } from '@iyulab/components/dist/utilities/Locale.js';
import { useODataSource } from './use-odata-source.js';

/**
 * 서버가 아무 말도 하지 않은 실패의 `SourceError.message` 는 이 패키지가 채우는 문장이고, **로케일을 따른다**.
 *
 * 결함: 응답은 있으나 메시지가 없으면 고정 영어 `Request failed (<status>)`, 응답이 없으면 브라우저마다 다른 예외 문구
 * (`Failed to fetch` …)가 그대로였다 — 한국어 앱에서도 영어가 그려졌고, 소비자는 문자열 모양을 보고 갈라야 했다.
 * 서버 문장이 있으면 그것이 이긴다(서버의 언어).
 */
describe('useODataSource — 기본 오류 문장의 로케일', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    Locale.set('en');
  });

  type Options = Parameters<typeof useODataSource>[1];
  async function mount(options: Options) {
    let latest: ReturnType<typeof useODataSource> | undefined;
    const Probe = (props: { options: Options }) => {
      latest = useODataSource('/api/orders', props.options);
      return null;
    };
    await act(async () => {
      root.render(createElement(Probe, { options }));
    });
    return { get current() { return latest!; } };
  }
  const failed = (status: number, body = '') => () =>
    Promise.resolve({ ok: false, status, json: () => Promise.resolve({}), text: () => Promise.resolve(body) } as unknown as Response);
  const offline = () => Promise.reject(new TypeError('Failed to fetch'));

  it('응답은 있으나 메시지가 없으면 requestFailed — 영어', async () => {
    const view = await mount({ fetcher: failed(503) });
    expect(view.current.error?.message).toBe('Request failed (503)');
    expect(view.current.error?.status).toBe(503);
  });

  it('같은 실패 — 한국어 로케일', async () => {
    Locale.set('ko');
    const view = await mount({ fetcher: failed(503) });
    expect(view.current.error?.message).toBe('요청이 실패했습니다 (503)');
  });

  it('응답이 없으면 networkFailed — 예외 문구가 아니라 로케일 문장, 예외는 cause 에', async () => {
    Locale.set('ko');
    const view = await mount({ fetcher: offline });
    expect(view.current.error?.message).toBe('서버에 연결하지 못했습니다.');
    expect(view.current.error?.status).toBeUndefined();
    expect((view.current.error?.cause as Error)?.message).toBe('Failed to fetch');
  });

  it('NEGATIVE — 서버 문장이 있으면 그것이 이긴다', async () => {
    Locale.set('ko');
    const view = await mount({ fetcher: failed(500, '{"error":{"message":"Database is down"}}') });
    expect(view.current.error?.message).toBe('Database is down');
  });

  it('NEGATIVE — 거둔 요청은 실패가 아니다', async () => {
    const view = await mount({ fetcher: () => Promise.reject(Object.assign(new Error('aborted'), { name: 'AbortError' })) });
    expect(view.current.error).toBeNull();
  });
});
