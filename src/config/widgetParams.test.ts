import { describe, expect, it } from 'vitest';
import {
  booleanParam,
  enumParam,
  numberListParam,
  numberParam,
  readWidgetParams,
  stringParam
} from '@/config/widgetParams';

describe('readWidgetParams', () => {
  const schema = {
    betCardListId: numberParam(915),
    sportId: numberParam(null),
    title: stringParam('Odds turbinadas'),
    compact: booleanParam(),
    layout: enumParam(['horizontal', 'vertical'] as const, 'horizontal'),
    champIds: numberListParam()
  };

  it('devolve os defaults quando a query esta vazia', () => {
    expect(readWidgetParams(schema, '')).toEqual({
      betCardListId: 915,
      sportId: null,
      title: 'Odds turbinadas',
      compact: false,
      layout: 'horizontal',
      champIds: []
    });
  });

  it('le os valores informados', () => {
    expect(
      readWidgetParams(
        schema,
        '?betCardListId=42&sportId=66&title=Principais%20ligas&compact=1&layout=vertical&champIds=1,2,3'
      )
    ).toEqual({
      betCardListId: 42,
      sportId: 66,
      title: 'Principais ligas',
      compact: true,
      layout: 'vertical',
      champIds: [1, 2, 3]
    });
  });

  // O back office preenche esses campos a mao, sem validacao do outro lado.
  // Lixo tem que virar default, nao excecao — o widget esta num iframe e
  // ninguem veria o erro.
  it('cai no default quando o valor e lixo', () => {
    expect(
      readWidgetParams(
        schema,
        '?betCardListId=abc&sportId=&title=%20%20&compact=talvez&layout=diagonal&champIds=a,b'
      )
    ).toEqual({
      betCardListId: 915,
      sportId: null,
      title: 'Odds turbinadas',
      compact: false,
      layout: 'horizontal',
      champIds: []
    });
  });

  it('ignora parametros que o widget nao declarou', () => {
    const params = readWidgetParams({ sportId: numberParam(null) }, '?foo=bar');

    expect(params).toEqual({ sportId: null });
  });
});

describe('leitores', () => {
  it('numberParam aceita negativo e decimal, mas nao Infinity', () => {
    const read = numberParam(0);

    expect(read('-3')).toBe(-3);
    expect(read('2.5')).toBe(2.5);
    expect(read('Infinity')).toBe(0);
  });

  it('booleanParam entende as duas grafias, nos dois sentidos', () => {
    const read = booleanParam(true);

    expect(read('1')).toBe(true);
    expect(read('TRUE')).toBe(true);
    expect(read('0')).toBe(false);
    expect(read('false')).toBe(false);
    // Ausente e desconhecido caem no default, que aqui e `true`.
    expect(read(null)).toBe(true);
    expect(read('talvez')).toBe(true);
  });

  it('numberListParam descarta os itens invalidos e mantem os validos', () => {
    expect(numberListParam()('1, x ,3')).toEqual([1, 3]);
  });

  it('numberListParam usa o default quando sobra lista vazia', () => {
    expect(numberListParam([7])('x,y')).toEqual([7]);
  });

  it('stringParam preserva espacos internos e apara as bordas', () => {
    expect(stringParam()('  Copa  do  Brasil  ')).toBe('Copa  do  Brasil');
  });
});
