// Composition et démonstration (le seul endroit qui assemble les objets).
import { createChannel } from './notifications/channels.js';
import './notifications/slack.js'; // enregistre le canal « slack » sans toucher à channels.js
import { MessageBuilder } from './notifications/MessageBuilder.js';
import { ColissimoApi, DhlClient } from '../tp4/carrierApis.js';
import { ColissimoAdapter, DhlAdapter } from './shipping/adapters.js';
import { RetryQuote, CachedQuote } from './shipping/decorators.js';
import { ShippingService } from './shipping/ShippingService.js';

const shipping = new ShippingService([
  new CachedQuote(new RetryQuote(new ColissimoAdapter(new ColissimoApi()))),
  // DHL tombe en panne au 1er appel : le Retry l'absorbe, le cache évite de le rappeler ensuite
  new CachedQuote(new RetryQuote(new DhlAdapter(new DhlClient({ failFirst: 1 })))),
]);

const email = createChannel('email');
for (const weightKg of [2, 10]) {
  const best = await shipping.bestQuote({ weightKg, zip: '75011' });
  const message = new MessageBuilder()
    .to('alice@exemple.fr')
    .template('Bonjour {{nom}}, votre colis de {{poids}} kg part avec {{transporteur}} ({{prix}} €).')
    .with('nom', 'Alice')
    .with('poids', weightKg)
    .with('transporteur', best.carrier)
    .with('prix', best.price.toFixed(2))
    .build();
  console.log(email.send(message));
}

const info = new MessageBuilder().to('logistique').template('Tarifs mis à jour').build();
console.log(createChannel('slack').send(info));
