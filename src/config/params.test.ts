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

  it('usa surface-2 como default e aceita os tokens conhecidos', () => {
    expect(readParams('').surface).toBe('2');
    expect(readParams('?surface=0').surface).toBe('0');
    expect(readParams('?surface=primary').surface).toBe('primary');
  });

  // Quem preenche e o back office, sem validacao do outro lado: token
  // desconhecido cai no default em vez de deixar o widget sem fundo.
  it('ignora surface desconhecida', () => {
    expect(readParams('?surface=9').surface).toBe('2');
    expect(readParams('?surface=roxo').surface).toBe('2');
  });

  it('ignora integration vazia', () => {
    expect(readParams('?integration=%20').integration).toBe('startbet');
  });
});
