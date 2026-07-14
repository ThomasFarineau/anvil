import { describe, expect, test } from 'bun:test';

import { INSTANCE_ID_RE, safeFileName, safeRelPath } from './storage';

describe('safeFileName', () => {
  test('accepts plain jar names', () => {
    expect(safeFileName('sodium-0.6.jar')).toBe('sodium-0.6.jar');
    expect(safeFileName('My Mod v1.2+build.3.jar')).toBe(
      'My Mod v1.2+build.3.jar',
    );
  });

  test('rejects traversal and separators', () => {
    expect(safeFileName('../evil.jar')).toBeNull();
    expect(safeFileName('a/b.jar')).toBeNull();
    expect(safeFileName('a\\b.jar')).toBeNull();
    expect(safeFileName('.hidden')).toBeNull();
    expect(safeFileName('')).toBeNull();
    expect(safeFileName('a..b.jar')).toBeNull();
  });
});

describe('safeRelPath', () => {
  test('accepts nested config paths', () => {
    expect(safeRelPath('config/mod.toml')).toBe('config/mod.toml');
    expect(safeRelPath('options.txt')).toBe('options.txt');
    expect(safeRelPath('/config/mod.toml')).toBe('config/mod.toml');
    expect(safeRelPath('config\\sub\\mod.cfg')).toBe('config/sub/mod.cfg');
  });

  test('rejects traversal', () => {
    expect(safeRelPath('../secrets')).toBeNull();
    expect(safeRelPath('config/../../etc/passwd')).toBeNull();
    expect(safeRelPath('')).toBeNull();
    expect(safeRelPath('..')).toBeNull();
  });
});

describe('INSTANCE_ID_RE', () => {
  test('validates instance ids', () => {
    expect(INSTANCE_ID_RE.test('server-exemple')).toBe(true);
    expect(INSTANCE_ID_RE.test('survival_2')).toBe(true);
    expect(INSTANCE_ID_RE.test('UPPER')).toBe(false);
    expect(INSTANCE_ID_RE.test('-bad')).toBe(false);
    expect(INSTANCE_ID_RE.test('a b')).toBe(false);
  });
});
