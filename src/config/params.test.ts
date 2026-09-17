import { describe, expect, it } from 'vitest';
import { readParams } from '@/config/params';

describe('readParams', () => {
  it('cai nos defaults quando a query esta vazia', () => {
    const params = readParams('');

    expect(params.theme).toBe('dark');
    expect(params.integration).toBe('startbet');
    expect(params.mobilePaddingInline).toBe('');
    expect(params.debug).toBe(false);
  });

  it('le os parametros informados na url', () => {
    const params = readParams(
      '?theme=light&integration=vupi&mobilePaddingInline=16px&debug=1'
    );

    expect(params.theme).toBe('light');
    expect(params.integration).toBe('vupi');
    expect(params.mobilePaddingInline).toBe('16px');
    expect(params.debug).toBe(true);
  });

  it('ignora tema desconhecido', () => {
    expect(readParams('?theme=neon').theme).toBe('dark');
  });

  it('ignora integration vazia', () => {
    expect(readParams('?integration=%20').integration).toBe('startbet');
  });
});
