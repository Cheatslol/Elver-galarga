import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const html = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'index.html'), 'utf8');

const gameIds = [...html.matchAll(/\{\s*id:\s*'([a-z0-9]+)'\s*,\s*title:/g)].map(m => m[1]);
const launchers = new Map(
  [...html.matchAll(/id === '([a-z0-9]+)'\)\s*(start[A-Za-z0-9]+)\(body\)/g)].map(m => [m[1], m[2]])
);

test('la lista de juegos no está vacía y no tiene ids repetidos', () => {
  assert.ok(gameIds.length >= 20, 'se esperaban al menos 20 juegos, hay ' + gameIds.length);
  assert.equal(new Set(gameIds).size, gameIds.length, 'ids duplicados en games');
});

test('cada juego de la lista se puede abrir desde openGame', () => {
  const missing = gameIds.filter(id => !launchers.has(id));
  assert.deepEqual(missing, [], 'juegos sin rama en openGame: ' + missing.join(', '));
});

test('openGame no llama a funciones start inexistentes', () => {
  const undefined_ = [...launchers.values()].filter(fn => !html.includes('function ' + fn + '('));
  assert.deepEqual(undefined_, [], 'funciones no definidas: ' + undefined_.join(', '));
});

test('makeCanvas se usa como elemento, nunca desestructurado', () => {
  // makeCanvas devuelve el <canvas>; desestructurar { canvas, ctx } deja ctx undefined
  // y rompe el juego en el primer frame (bug de Piso Traidor).
  assert.equal(html.match(/(?:const|let|var)\s*\{[^}]*\}\s*=\s*makeCanvas\(/), null);
});

test('cada canvas obtiene su contexto 2d o 3d', () => {
  const calls = html.match(/= makeCanvas\(/g) || [];
  const contexts = html.match(/\.getContext\(/g) || [];
  assert.ok(calls.length > 0);
  assert.ok(contexts.length >= calls.length, 'hay canvas sin getContext');
});

test('los bucles con requestAnimationFrame comprueban currentGame antes de seguir', () => {
  const rafLoops = html.match(/animId = requestAnimationFrame\(/g) || [];
  const guards = html.match(/if \(currentGame !== '[a-z0-9]+'\)/g) || [];
  assert.ok(guards.length >= 10, 'faltan guardas de currentGame');
  assert.ok(rafLoops.length > 0);
});

test('todo el JS del sitio vive dentro del documento', () => {
  const afterHtml = html.slice(html.lastIndexOf('</html>') + '</html>'.length).trim();
  assert.equal(afterHtml, '', 'hay contenido después de </html>: ' + afterHtml.slice(0, 80));
});
