// Tests de la lógica del Cookie Clicker.
// El juego vive en un solo index.html, así que extraemos el bloque marcado
// con CLICKER_LOGIC_START / CLICKER_LOGIC_END y lo evaluamos en Node.
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const html = readFileSync(join(root, 'index.html'), 'utf8');
const match = html.match(/\/\/ CLICKER_LOGIC_START[\s\S]*?\n([\s\S]*?)\/\/ CLICKER_LOGIC_END/);
assert.ok(match, 'no se encontró el bloque CLICKER_LOGIC en index.html');

const exported = [
  'CLICKER_FIXED', 'CLICKER_CHAIN', 'CLICKER_ITEMS', 'clickerItem', 'clickerCount',
  'clickerSanitize', 'clickerCost', 'clickerMultiplier', 'clickerProduction',
  'clickerClickPower', 'clickerNextUnique', 'clickerVisibleItems', 'clickerOwnedUniques',
  'clickerBuy', 'clickerFmt', 'clickerShort'
];
const logic = new Function(`${match[1]}\nreturn {${exported.join(',')}};`)();
const {
  CLICKER_FIXED, CLICKER_CHAIN, CLICKER_ITEMS, clickerItem, clickerCount, clickerSanitize,
  clickerCost, clickerMultiplier, clickerProduction, clickerClickPower, clickerNextUnique,
  clickerVisibleItems, clickerOwnedUniques, clickerBuy, clickerFmt, clickerShort
} = logic;

const ids = owned => clickerVisibleItems(owned).map(i => i.id);

test('los ítems fijos son cursor, abuela y fábrica y son repetibles', () => {
  assert.deepEqual(CLICKER_FIXED.map(i => i.id), ['cursor', 'grandma', 'factory']);
  CLICKER_FIXED.forEach(item => assert.equal(item.unique, undefined));
});

test('todas las mejoras de la cadena son de compra única y con ids sin repetir', () => {
  CLICKER_CHAIN.forEach(item => assert.equal(item.unique, true));
  assert.equal(new Set(CLICKER_ITEMS.map(i => i.id)).size, CLICKER_ITEMS.length);
});

test('la cadena incluye cyborg y reactor, en orden de precio creciente', () => {
  const chainIds = CLICKER_CHAIN.map(i => i.id);
  assert.ok(chainIds.includes('cyborg'));
  assert.ok(chainIds.includes('reactor'));
  assert.ok(chainIds.indexOf('cyborg') < chainIds.indexOf('reactor'));
  CLICKER_CHAIN.forEach((item, i) => {
    if (i > 0) assert.ok(item.baseCost > CLICKER_CHAIN[i - 1].baseCost, `${item.id} debe costar más que ${CLICKER_CHAIN[i - 1].id}`);
  });
});

test('la tienda muestra los fijos más una sola mejora única', () => {
  assert.deepEqual(ids({}), ['cursor', 'grandma', 'factory', 'hat']);
  assert.deepEqual(ids({ hat: 1 }), ['cursor', 'grandma', 'factory', 'laserEyes']);
});

test('comprar una mejora única la reemplaza por la siguiente', () => {
  const state = { cookies: 30000, owned: { hat: 1, laserEyes: 1 } };
  assert.deepEqual(ids(state.owned), ['cursor', 'grandma', 'factory', 'cyborg']);
  const after = clickerBuy(state, 'cyborg');
  assert.equal(after.cookies, 5000);
  assert.equal(after.owned.cyborg, 1);
  assert.deepEqual(ids(after.owned), ['cursor', 'grandma', 'factory', 'golden']);
});

test('el cyborg no se puede comprar dos veces', () => {
  const owned = {};
  CLICKER_CHAIN.forEach(item => { if (item.id !== 'cyborg') owned[item.id] = 1; });
  owned.cyborg = 1;
  assert.equal(clickerBuy({ cookies: 1e9, owned }, 'cyborg'), null);
  assert.equal(clickerCount(owned, 'cyborg'), 1);
});

test('el reactor de cookies no se puede comprar dos veces', () => {
  const owned = { hat: 1, laserEyes: 1, cyborg: 1, golden: 1, mega: 1, reactor: 1 };
  assert.equal(clickerBuy({ cookies: 1e12, owned }, 'reactor'), null);
});

test('una mejora única todavía bloqueada no se puede comprar', () => {
  assert.equal(clickerBuy({ cookies: 1e12, owned: {} }, 'reactor'), null);
  assert.equal(clickerBuy({ cookies: 1e12, owned: {} }, 'cyborg'), null);
});

test('un id inexistente no rompe la compra', () => {
  assert.equal(clickerBuy({ cookies: 1e12, owned: {} }, 'noExiste'), null);
});

test('cuando ya se compró todo, la tienda queda solo con los fijos', () => {
  const owned = {};
  CLICKER_CHAIN.forEach(item => { owned[item.id] = 1; });
  assert.equal(clickerNextUnique(owned), null);
  assert.deepEqual(ids(owned), ['cursor', 'grandma', 'factory']);
});

test('los ítems fijos suben 25% por unidad y las mejoras únicas tienen precio fijo', () => {
  const cursor = clickerItem('cursor');
  assert.equal(clickerCost(cursor, {}), 15);
  assert.equal(clickerCost(cursor, { cursor: 1 }), 18);
  assert.equal(clickerCost(cursor, { cursor: 2 }), 23);
  const cyborg = clickerItem('cyborg');
  assert.equal(clickerCost(cyborg, {}), cyborg.baseCost);
  assert.equal(clickerCost(cyborg, { cyborg: 1 }), cyborg.baseCost);
});

test('comprar un ítem fijo acumula unidades y cobra el precio escalado', () => {
  let state = { cookies: 200, owned: {} };
  state = clickerBuy(state, 'cursor');
  assert.equal(state.owned.cursor, 1);
  assert.equal(state.cookies, 185);
  state = clickerBuy(state, 'cursor');
  assert.equal(state.owned.cursor, 2);
  assert.equal(state.cookies, 167);
});

test('no se puede comprar sin cookies suficientes', () => {
  assert.equal(clickerBuy({ cookies: 14, owned: {} }, 'cursor'), null);
  assert.deepEqual(clickerBuy({ cookies: 15, owned: {} }, 'cursor'), { cookies: 0, owned: { cursor: 1 } });
});

test('la compra no muta el estado recibido', () => {
  const state = { cookies: 100, owned: { cursor: 1 } };
  clickerBuy(state, 'cursor');
  assert.deepEqual(state, { cookies: 100, owned: { cursor: 1 } });
});

test('la producción suma los aportes y aplica los multiplicadores en cadena', () => {
  assert.equal(clickerProduction({}), 0);
  assert.equal(clickerProduction({ grandma: 3 }), 3);
  assert.equal(clickerMultiplier({}), 1);
  assert.equal(clickerMultiplier({ cyborg: 1 }), 3);
  assert.equal(clickerMultiplier({ cyborg: 1, reactor: 1 }), 15);
  assert.equal(clickerProduction({ grandma: 2, cyborg: 1, reactor: 1 }), 30);
  assert.equal(clickerClickPower({ cyborg: 1, reactor: 1 }), 15);
  assert.equal(clickerClickPower({}), 1);
});

test('un multiplicador no aporta producción por sí solo', () => {
  assert.equal(clickerProduction({ cyborg: 1, reactor: 1 }), 0);
});

test('sanitize limita las mejoras únicas a una y descarta valores inválidos', () => {
  assert.deepEqual(clickerSanitize({ cookies: 50, owned: { cyborg: 7, reactor: 3 } }), {
    cookies: 50, owned: { cyborg: 1, reactor: 1 }
  });
  assert.deepEqual(clickerSanitize({ cookies: -5, owned: { cursor: -2, grandma: 2.9, basura: 5 } }), {
    cookies: 0, owned: { grandma: 2 }
  });
  assert.deepEqual(clickerSanitize({ cookies: 'nada' }), { cookies: 0, owned: {} });
  assert.deepEqual(clickerSanitize(null), { cookies: 0, owned: {} });
  assert.deepEqual(clickerSanitize({ cookies: Infinity }), { cookies: 0, owned: {} });
});

test('las mejoras únicas compradas se listan en orden', () => {
  assert.deepEqual(clickerOwnedUniques({ cyborg: 1, hat: 1 }).map(i => i.id), ['hat', 'cyborg']);
  assert.deepEqual(clickerOwnedUniques({}), []);
});

test('el formato abrevia los números grandes', () => {
  assert.equal(clickerFmt(0), '0');
  assert.equal(clickerFmt(999), '999');
  assert.equal(clickerFmt(1000), '1 K');
  assert.equal(clickerFmt(1500), '1.5 K');
  assert.equal(clickerFmt(1250), '1.25 K');
  assert.equal(clickerFmt(2e6), '2 M');
  assert.equal(clickerFmt(3.25e9), '3.25 B');
  assert.equal(clickerFmt(1e12), '1 billón');
  assert.equal(clickerShort(10.5, ' M'), '10.5 M');
});
