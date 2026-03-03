import * as fs from 'node:fs/promises';
import * as path from 'node:path';

import { Candle, Timeframe } from '../types';
import { DataAdapter, DataFetchError, FetchOptions } from './adapters/adapter';

// 캐시 파일에 저장되는 단위
// "데이터 + 만료 정보"를 한 파일에 보관
export interface CacheEntry {
  createdAt: number;
  expiresAt: number;
  candles: Candle[];
}

export interface CacheOptions {
  // 캐시 저장 디렉토리 (Default: .cache/tradecli 또는 프로젝트 루트의 .cache)
  dir?: string;
  // TTL(Time-to-Live) in milliseconds (Default: 1 hour)
  ttl?: number;
}

const DEFAULT_TTL = 60 * 60 * 1000; // 1 hour
const DEFAULT_DIR = '.cache/tradecli';

// 캐시 키 생성: pair:timeframe:from:to 조합
// 동일한 요청은 항상 동일한 키를 가짐
function buildCacheKey(options: FetchOptions): string {
  const { pair, timeframe, from = 0, to = 0, limit = 0 } = options;
  return `${pair}:${timeframe}:${from}:${to}:${limit}`;
}

// 파일 이름에 사용 불가능한 특수문자를 "_"로 치환
function sanitizeKey(key: string): string {
  return key.replace(/[/:]/g, '_');
}

// 파일 기반 캐시 클래스
// One request = One JSON
export class FileCache {
  private readonly dir: string;
  private readonly ttl: number;

  constructor(options: CacheOptions = {}) {
    this.dir = options.dir ?? DEFAULT_DIR;
    this.ttl = options.ttl ?? DEFAULT_TTL;
  }

  // 캐시에서 읽기 -> miss 면 null 반환
  async get(options: FetchOptions): Promise<Candle[] | null> {
    const filePath = this.resolvePath(options);

    try {
      const raw = await fs.readFile(filePath, 'utf-8');
      const entry: CacheEntry = JSON.parse(raw) as CacheEntry;

      // TTL 만료 확인 -> 만료 시 null 반환 (miss 처리)
      if (Date.now() > entry.expiresAt) {
        // 만료 파일은 비동기 삭제 (await 생략: 실패해도 상관 x)
        void fs.unlink(filePath).catch(() => undefined);
        return null;
      }

      return entry.candles;
    } catch {
      // 파일 없음 (ENOENT) 또는 파싱 오류 -> miss
      return null;
    }
  }

  // 캐시에 쓰기
  async set(options: FetchOptions, candles: Candle[]): Promise<void> {
    // 디렉토리가 없으면 생성 (recursive: 중첩 폴더도 OK)
    await fs.mkdir(this.dir, { recursive: true });

    const entry: CacheEntry = {
      createdAt: Date.now(),
      expiresAt: Date.now() + this.ttl,
      candles,
    };

    const filePath = this.resolvePath(options);
    await fs.writeFile(filePath, JSON.stringify(entry), 'utf-8');
  }

  // 캐시 전체 클리어 (디렉토리 삭제 후 재생성)
  async clear(): Promise<void> {
    await fs.rm(this.dir, { recursive: true, force: true });
  }

  // 절대 경로 계산
  private resolvePath(options: FetchOptions): string {
    const key = sanitizeKey(buildCacheKey(options));
    return path.join(this.dir, `${key}.json`);
  }
}

// CachedDataAdapter: 기존 DataAdapter를 감싸는 데코레이터
// 바깥에서는 DataAdapter처럼 쓰고, 내부에서만 캐시 사용
export class CachedDataAdapter implements DataAdapter {
  readonly name: string;

  private readonly inner: DataAdapter;
  private readonly cache: FileCache;

  constructor(inner: DataAdapter, cacheOptions: CacheOptions = {}) {
    this.inner = inner;
    // 캐시 이름에 inner adapter 이름을 포함해서 구분 가능하게
    this.name = `cached(${inner.name})`;
    this.cache = new FileCache(cacheOptions);
  }

  async fetchCandles(options: FetchOptions): Promise<Candle[]> {
    // 1. 캐시 hit 확인
    const cached = await this.cache.get(options);
    if (cached !== null) {
      return cached; // 캐시 hit -> 즉시 반환
    }

    // 2. 캐시 miss -> 실제 어댑터 호출
    try {
      const candles = await this.inner.fetchCandles(options);

      // 3. 성공한 응답만 캐시에 저장
      await this.cache.set(options, candles);
      return candles;
    } catch (err) {
      // DataFetchError는 그대로 re-throw
      if (err instanceof DataFetchError) throw err;
      throw new DataFetchError('Cache fallback failed', this.name, err);
    }
  }

  getSupportedPairs(): Promise<string[]> {
    // 페어 목록은 캐시 불필요 -> inner에 위임
    return this.inner.getSupportedPairs();
  }

  getSupportedTimeframes(): Timeframe[] {
    return this.inner.getSupportedTimeframes();
  }

  // 테스트나 CLI에서 직접 클리어할 수 있도록 노출
  async clearCache(): Promise<void> {
    await this.cache.clear();
  }
}
