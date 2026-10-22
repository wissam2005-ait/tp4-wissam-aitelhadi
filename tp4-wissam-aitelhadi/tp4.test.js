import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createChannel, registerChannel, Channel, EmailChannel, SmsChannel, PushChannel }
  from './notifications/channels.js';
import { MessageBuilder } from './notifications/MessageBuilder.js';
import { ColissimoApi, DhlClient } from '../tp4/carrierApis.js';
import { ColissimoAdapter, DhlAdapter } from './shipping/adapters.js';
import { RetryQuote, CachedQuote } from './shipping/decorators.js';
import { ShippingService } from './shipping/ShippingService.js';

const parcel = { weightKg: 2, zip: '75011' };
const msg = { to: 'alice@exemple.fr', body: 'Bonjour', priority: 'normale' };

// ---------------- Étape 1 : Factory ----------------
test('Factory : un canal par type, erreur si inconnu', () => {
  assert.ok(createChannel('email') instanceof EmailChannel);
  assert.ok(createChannel('sms') instanceof SmsChannel);
  assert.ok(createChannel('push') instanceof PushChannel);
  assert.equal(createChannel('email').send(msg), '[EMAIL → alice@exemple.fr] Bonjour');
  assert.equal(createChannel('push').send(msg), '[PUSH → alice@exemple.fr] Bonjour');
  assert.equal(createChannel('sms').send({ ...msg, body: 'x'.repeat(200) }).length,
    '[SMS → alice@exemple.fr] '.length + 160);
  assert.throws(() => createChannel('fax'), /Canal inconnu : fax/);
  assert.throws(() => new Channel().send(msg), /méthode abstraite/);
});

test('Factory (OCP) : Slack ajouté sans modifier channels.js', async () => {
  assert.throws(() => createChannel('slack'), /Canal inconnu/); // pas encore importé
  await import('./notifications/slack.js');
  assert.equal(createChannel('slack').send({ to: 'logistique', body: 'Tarifs mis à jour' }),
    '[SLACK #logistique] Tarifs mis à jour');
});

test('Factory : une classe qui n’hérite pas de Channel est refusée', () => {
  assert.throws(() => registerChannel('x', class {}), /doit hériter de Channel/);
  assert.throws(() => registerChannel('y', 'pas une classe'), /doit hériter de Channel/);
});

// ---------------- Étape 2 : Builder ----------------
const valid = () => new MessageBuilder().to('a@b.fr').template('Bonjour {{nom}}').with('nom', 'Alice');

test('Builder : un message valide', () => {
  const m = new MessageBuilder()
    .to('alice@exemple.fr')
    .template('Bonjour {{nom}}, votre colis part avec {{transporteur}}.')
    .with('nom', 'Alice').with('transporteur', 'Colissimo')
    .priority('haute').build();
  assert.deepEqual({ ...m }, {
    to: 'alice@exemple.fr', body: 'Bonjour Alice, votre colis part avec Colissimo.', priority: 'haute',
  });
  assert.equal(valid().build().priority, 'normale'); // valeur par défaut
});

test('Builder : les 4 erreurs sont levées par build()', () => {
  assert.throws(() => new MessageBuilder().template('x').build(), /Destinataire obligatoire/);
  assert.throws(() => new MessageBuilder().to('a@b.fr').build(), /Gabarit obligatoire/);
  assert.throws(() => valid().priority('urgente').build(), /Priorité invalide : urgente/);
  assert.throws(() => new MessageBuilder().to('a@b.fr').template('Bonjour {{nom}}').build(),
    /Variable manquante : nom/);
});

test('Builder : message immuable et interface fluide', () => {
  const b = new MessageBuilder();
  assert.equal(b.to('a@b.fr'), b);
  assert.equal(b.template('x'), b);
  assert.equal(b.with('k', 1), b);
  assert.equal(b.priority('basse'), b);
  const m = valid().build();
  assert.ok(Object.isFrozen(m));
  assert.throws(() => { 'use strict'; m.to = 'pirate@evil.com'; }, TypeError);
});

// ---------------- Étape 3a : Adapter ----------------
test('Adapter : deux API, un seul contrat', async () => {
  assert.deepEqual(await new ColissimoAdapter(new ColissimoApi()).getQuote(parcel),
    { carrier: 'Colissimo', price: 9.95, days: 2 });
  assert.deepEqual(await new DhlAdapter(new DhlClient()).getQuote(parcel),
    { carrier: 'DHL', price: 11, days: 1 });
});

// ---------------- Étape 3b : Decorators ----------------
test('Decorator Retry : absorbe 2 pannes sur 3 essais', async () => {
  const client = new DhlClient({ failFirst: 2 });
  const q = await new RetryQuote(new DhlAdapter(client)).getQuote(parcel);
  assert.equal(q.price, 11);
  assert.equal(client.calls, 3);
});

test('Decorator Retry : abandonne après 3 échecs (dernière erreur relancée)', async () => {
  const client = new DhlClient({ failFirst: 5 });
  await assert.rejects(new RetryQuote(new DhlAdapter(client)).getQuote(parcel), /503 Service Unavailable/);
  assert.equal(client.calls, 3);
});

test('Decorator Cache : le 2e appel ne rappelle pas le transporteur', async () => {
  const client = new DhlClient();
  const cached = new CachedQuote(new DhlAdapter(client));
  await cached.getQuote(parcel);
  await cached.getQuote(parcel);
  assert.equal(client.calls, 1);
  await cached.getQuote({ weightKg: 3, zip: '75011' }); // autre clé -> nouvel appel
  assert.equal(client.calls, 2);
});

test('Decorator Cache : le devis expire après le TTL', async () => {
  const client = new DhlClient();
  let t = 1000;
  const cached = new CachedQuote(new DhlAdapter(client), { ttlMs: 60_000, now: () => t });
  await cached.getQuote(parcel);
  t += 59_999;
  await cached.getQuote(parcel);
  assert.equal(client.calls, 1);
  t += 2; // TTL dépassé
  await cached.getQuote(parcel);
  assert.equal(client.calls, 2);
});

test('Decorator : composition cache(retry(dhl))', async () => {
  const client = new DhlClient({ failFirst: 1 });
  const q = new CachedQuote(new RetryQuote(new DhlAdapter(client)));
  assert.equal((await q.getQuote(parcel)).price, 11); // 1 panne + 1 succès
  assert.equal(client.calls, 2);
  await q.getQuote(parcel); // servi par le cache
  assert.equal(client.calls, 2);
});

test('Decorator Cache : une erreur n’est jamais mise en cache', async () => {
  const client = new DhlClient({ failFirst: 1 });
  const cached = new CachedQuote(new DhlAdapter(client));
  await assert.rejects(cached.getQuote(parcel), /503/);
  assert.equal((await cached.getQuote(parcel)).price, 11); // le 2e appel réessaie vraiment
});

// ---------------- Étape 4 : Facade ----------------
const build = (dhlOpts = {}) => new ShippingService([
  new ColissimoAdapter(new ColissimoApi()),
  new DhlAdapter(new DhlClient(dhlOpts)),
]);

test('Facade : le moins cher, puis le plus rapide ; un transporteur en panne est ignoré', async () => {
  assert.equal((await build().bestQuote({ weightKg: 2, zip: '75011' })).carrier, 'Colissimo');
  assert.equal((await build().bestQuote({ weightKg: 10, zip: '75011' })).carrier, 'DHL');
  // DHL en panne -> ignoré, Colissimo répond
  assert.equal((await build({ failFirst: 99 }).bestQuote({ weightKg: 10, zip: '75011' })).carrier, 'Colissimo');
  // à prix égal : le plus rapide
  const same = new ShippingService([
    { getQuote: async () => ({ carrier: 'Lent', price: 5, days: 3 }) },
    { getQuote: async () => ({ carrier: 'Rapide', price: 5, days: 1 }) },
  ]);
  assert.equal((await same.bestQuote(parcel)).carrier, 'Rapide');
});

test('Facade : aucun transporteur disponible -> erreur', async () => {
  await assert.rejects(new ShippingService([]).bestQuote(parcel), /Aucun transporteur disponible/);
  const down = new ShippingService([
    new ColissimoAdapter(new ColissimoApi()),
    new DhlAdapter(new DhlClient({ failFirst: 99 })),
  ]);
  await assert.rejects(down.bestQuote({ weightKg: 2, zip: 'abc' }), /Aucun transporteur disponible/);
});

test('Facade : un transporteur qui lève une exception synchrone est aussi ignoré', async () => {
  const s = new ShippingService([
    { getQuote() { throw new Error('boum'); } },
    { getQuote: async () => ({ carrier: 'OK', price: 1, days: 1 }) },
  ]);
  assert.equal((await s.bestQuote(parcel)).carrier, 'OK');
});
