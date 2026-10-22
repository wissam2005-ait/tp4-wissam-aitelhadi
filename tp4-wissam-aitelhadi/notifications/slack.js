// Nouveau canal ajouté SANS modifier channels.js : une classe + une ligne d'enregistrement.
import { Channel, registerChannel } from './channels.js';

export class SlackChannel extends Channel {
  send({ to, body }) {
    return `[SLACK #${to}] ${body}`;
  }
}

registerChannel('slack', SlackChannel);
