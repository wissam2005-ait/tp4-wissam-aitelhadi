// Factory Method (forme idiomatique JS) : une fonction fabrique + un registre (Map).
// Ce fichier n'est JAMAIS modifié pour ajouter un canal (OCP) : on appelle registerChannel().
export class Channel {
  send(message) {
    throw new Error('méthode abstraite');
  }
}

export class EmailChannel extends Channel {
  send({ to, body }) {
    return `[EMAIL → ${to}] ${body}`;
  }
}

export class SmsChannel extends Channel {
  send({ to, body }) {
    return `[SMS → ${to}] ${body.slice(0, 160)}`;
  }
}

export class PushChannel extends Channel {
  send({ to, body }) {
    return `[PUSH → ${to}] ${body}`;
  }
}

const registry = new Map([
  ['email', EmailChannel],
  ['sms', SmsChannel],
  ['push', PushChannel],
]);

export function createChannel(type) {
  const Ctor = registry.get(type);
  if (!Ctor) throw new Error(`Canal inconnu : ${type}`);
  return new Ctor();
}

export function registerChannel(type, Ctor) {
  if (typeof Ctor !== 'function' || !(Ctor.prototype instanceof Channel)) {
    throw new Error(`Le canal « ${type} » doit hériter de Channel`);
  }
  registry.set(type, Ctor);
}
