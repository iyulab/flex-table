// src/core/fetch-all.ts
// 두 소스(`createODataSource` · `createArraySource`)와 그 훅이 같은 «전부 읽기» 계약을 갖게 하는 공용 조각.

/** `fetchAll` 의 옵션 — 두 소스가 같은 모양이다. */
export interface FetchAllOptions {
  /**
   * 읽을 수 있는 행의 상한. 기본값 `100000`(`DEFAULT_MAX_ROWS`). 결과가 이보다 크면 **잘라서 주지 않고**
   * `RowLimitError` 로 거절한다 — OData 소스는 서버가 센 개수(`@odata.count`)로 첫 응답에서 알면 더 읽지 않는다.
   */
  maxRows?: number;
  /** 취소. 거두면 `AbortError` 로 거절한다. */
  signal?: AbortSignal;
  /** 페이지를 하나 받을 때마다 — 받은 행 수와 전체(서버가 세지 않았으면 `undefined`). */
  onProgress?: (loaded: number, total: number | undefined) => void;
}

/** «전부 읽기» 의 기본 상한 — 브라우저 메모리와 서버 부하를 지키는 선. 넘으면 조용히 자르지 않고 거절한다. */
export const DEFAULT_MAX_ROWS = 100_000;
