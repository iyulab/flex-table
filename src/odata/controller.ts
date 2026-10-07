// src/odata/controller.ts
import type { ReactiveController, ReactiveControllerHost } from 'lit';
import { createODataSource, type ODataSource, type ODataSourceOptions, type ODataSourceState } from './source.js';

/**
 * Lit 어댑터 — 프레임워크 중립 OData 소스를 호스트의 연결 수명에 묶는다. React 의 `useODataSource` 와 같은 소스다.
 *
 * 연결되면 구독하고(첫 조회가 나간다) 끊기면 해지한다(진행 중 요청을 거둔다). 상태가 바뀌면 호스트를 다시 그린다.
 *
 * ```ts
 * class OrdersPage extends LitElement {
 *   private orders = new ODataSourceController<Order>(this, '/odata/Orders', { pageSize: 25 });
 *   render() {
 *     const { data, loading, error } = this.orders.state;
 *     return html`<flex-table .data=${data} .loading=${loading} data-mode="server"
 *       @sort-change=${(e: CustomEvent) => this.orders.source.setSort(e.detail.criteria)}></flex-table>`;
 *   }
 * }
 * ```
 */
export class ODataSourceController<T = Record<string, unknown>> implements ReactiveController {
  /** 소스 — 조작(`setPage`·`setSort`·`setSearch`·`refresh`·`update`)은 이것으로 한다. */
  readonly source: ODataSource<T>;
  private unsubscribe?: () => void;

  constructor(private readonly host: ReactiveControllerHost, url: string, options: ODataSourceOptions = {}) {
    this.source = createODataSource<T>(url, options);
    host.addController(this);
  }

  /** 현재 상태. */
  get state(): ODataSourceState<T> {
    return this.source.getState();
  }

  hostConnected(): void {
    this.unsubscribe ??= this.source.subscribe(() => this.host.requestUpdate());
  }

  hostDisconnected(): void {
    this.unsubscribe?.();
    this.unsubscribe = undefined;
  }
}
