// 개별 함수 — 특정 모듈만 필요할 때
export { detectSwingPoints } from './swing';
export { analyzeStructure } from './structure';
export { detectOrderBlocks } from './orderblock';
export { detectFVG } from './fvg';

// 통합 분석기 — 전체 파이프라인 한번에 실행
export { SMCAnalyzer } from './analyzer';
