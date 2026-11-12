/**
 * Custom Elements Manifest — 소스에서 요소의 속성 · 이벤트 · 슬롯 · CSS 변수 · 파트를 읽어
 * `dist/custom-elements.json` 으로 쓴다(`npm run analyze`, 빌드의 일부). 설정의 몸은 `@iyulab/components` 가
 * 게시하는 공통 헬퍼다.
 */
import { cemConfig } from '@iyulab/components/plugins/cem-config.js';

export default cemConfig();
