// src/core/source-error.ts
import { t } from '../locale.js';

/** OData v4 오류 봉투의 `error.details` 항목 — 필드별 검증 실패 상세. */
export interface SourceErrorDetail {
  code: string;
  message: string;
  target?: string;
}

/**
 * 데이터 소스 훅(`useODataSource`/`useArraySource`)의 실패 값.
 *
 * 문자열 하나가 아니라 구조로 싣는 이유: 소비자는 «어떤 실패인가» 로 갈라야 한다 — 403 중에서도
 * 서버가 코드로 구분한 거절(«비밀번호를 바꿔야 한다»), 404(지워진 행), 409(동시성), 429(제한).
 * 메시지만 남기면 그 정보가 소스 경계에서 사라지고, 소비자는 전송(`fetcher`)을 감싸 상태를
 * 엿보는 것 말고는 길이 없다.
 */
export interface SourceError {
  /**
   * 보여 줄 문장 — 서버가 준 메시지가 있으면 그것. 없으면 이 패키지가 채우는 문장이고 로케일(`flexTableLocale`)을
   * 따른다: 응답은 있었으면 `requestFailed`(`Request failed ({status})`), 응답이 없었으면 `networkFailed`.
   */
  message: string;
  /** HTTP 상태. 응답이 없던 실패(네트워크 오류 · `@odata.nextLink` 검사)에는 없다. */
  status?: number;
  /** 서버가 정한 거절 코드 — OData 오류 봉투의 `error.code`(또는 최상위 `code`). */
  code?: string;
  /** 오류 봉투의 `error.details` 중 `code`·`message` 가 둘 다 문자열인 항목. */
  details?: SourceErrorDetail[];
  /** 응답 본문 — JSON 이면 파싱한 값, 아니면 텍스트. 비어 있으면 없다. */
  body?: unknown;
  /** 응답이 없던 실패에서 전송(`fetcher`)이 던진 예외 — 진단용. 화면에는 `message` 를 그린다. */
  cause?: unknown;
}

/** 실패 응답을 `SourceError` 로 읽는다. 본문을 읽을 수 없어도 상태와 기본 문장은 남긴다. */
export async function readFailedResponse(res: Response): Promise<SourceError> {
  const text = await res.text().catch(() => '');
  // 서버가 아무 말도 하지 않은 때 이 패키지가 채우는 문장 — 서버 문장(서버의 언어)이 있으면 그쪽이 이기고, 없으면
  // 표 chrome 과 같은 로케일을 따른다. 소비자가 `error.message` 를 그대로 그리라고 안내하는 자리라서다.
  const failure: SourceError = { message: t('requestFailed', { status: res.status }), status: res.status };
  if (!text) return failure;

  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch { /* 텍스트 본문 그대로 */ }
  failure.body = body;
  if (!body || typeof body !== 'object') return failure;

  const record = body as Record<string, unknown>;
  const envelope = record.error && typeof record.error === 'object'
    ? record.error as Record<string, unknown>
    : record;
  if (typeof envelope.message === 'string' && envelope.message) failure.message = envelope.message;
  else if (typeof record.message === 'string' && record.message) failure.message = record.message;
  if (typeof envelope.code === 'string' && envelope.code) failure.code = envelope.code;
  const details = readDetails(envelope.details);
  if (details) failure.details = details;
  return failure;
}

function readDetails(raw: unknown): SourceErrorDetail[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const details = raw.filter((d): d is SourceErrorDetail => {
    if (!d || typeof d !== 'object') return false;
    const rec = d as Record<string, unknown>;
    return typeof rec.code === 'string' && typeof rec.message === 'string';
  });
  return details.length > 0 ? details : undefined;
}

/**
 * 소스 요청의 실패 — `failure` 가 `SourceError`(상태 · 거절 코드 · 상세)다. `fetchAll` 은 이것으로 거절한다(상한을 넘으면
 * 하위 `RowLimitError`). 화면에는 `failure.message`. 상태로 드러나는 실패(`error`)는 이 `failure` 그대로다.
 */
export class SourceRequestError extends Error {
  readonly failure: SourceError;
  constructor(failure: SourceError) {
    super(failure.message);
    this.name = 'SourceRequestError';
    this.failure = failure;
  }
}

/**
 * 조회 결과가 «전부 읽기» 의 상한(`maxRows`)을 넘었다 — 잘라서 주지 않고 거절한 것이다. 화면에는 `failure.message` 를
 * 그린다(로케일 `tooManyRows`). `total` 은 서버가 센 행 수(`@odata.count`)이고, 서버가 세지 않았으면 없다.
 */
export class RowLimitError extends SourceRequestError {
  readonly total: number | undefined;
  readonly maxRows: number;
  constructor(maxRows: number, total?: number) {
    super({ message: t('tooManyRows', { maxRows }) });
    this.name = 'RowLimitError';
    this.total = total;
    this.maxRows = maxRows;
  }
}

/** 전송이 응답 없이 던진 실패(네트워크 · 오프라인)를 `SourceError` 로 — 브라우저마다 다른 예외 문구 대신 로케일 문장. */
export function networkFailure(cause: unknown): SourceRequestError {
  return new SourceRequestError({ message: t('networkFailed'), cause });
}

/** 잡힌 예외를 `SourceError` 로 — 응답이 있던 실패는 그 구조 그대로, 나머지는 메시지만. */
export function toSourceError(err: unknown): SourceError {
  if (err instanceof SourceRequestError) return err.failure;
  if (err instanceof Error) return { message: err.message };
  return { message: String(err) };
}
