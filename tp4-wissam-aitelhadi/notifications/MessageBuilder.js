// Builder : on construit le message pas à pas (interface fluide) ;
// TOUTES les règles sont vérifiées une seule fois, dans build().
const PRIORITIES = ['basse', 'normale', 'haute'];

export class MessageBuilder {
  #to;
  #template;
  #vars = {};
  #priority = 'normale';

  to(address) {
    this.#to = address;
    return this;
  }

  template(text) {
    this.#template = text;
    return this;
  }

  with(name, value) {
    this.#vars[name] = value;
    return this;
  }

  priority(level) {
    this.#priority = level;
    return this;
  }

  build() {
    if (!this.#to) throw new Error('Destinataire obligatoire');
    if (!this.#template) throw new Error('Gabarit obligatoire');
    if (!PRIORITIES.includes(this.#priority)) {
      throw new Error(`Priorité invalide : ${this.#priority}`);
    }
    const body = this.#template.replace(/\{\{(\w+)\}\}/g, (_, name) => {
      if (!(name in this.#vars)) throw new Error(`Variable manquante : ${name}`);
      return this.#vars[name];
    });
    return Object.freeze({ to: this.#to, body, priority: this.#priority });
  }
}
