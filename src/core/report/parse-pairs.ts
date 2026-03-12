/**
 * 쉼표 구분 페어 문자열 -> 정규화된 배열
 * 순수 함수 - trim, 빈 문자열 제가, 대문자 변환, 중복 제거
 */
export function parsePairs(input: string): string[] {
  const pairs = input
    .split(',')
    .map((p) => p.trim().toUpperCase())
    .filter((p) => p.length > 0);

  // Set으로 중복 제거 - 삽입 순서 유지
  return [...new Set(pairs)];
}
