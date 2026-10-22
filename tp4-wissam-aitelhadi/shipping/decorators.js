// Decorator : mêmes méthode getQuote(parcel) que l'objet enveloppé -> composables à volonté.

export class RetryQuote {
  constructor(inner, { attempts = 3 } = {}) {
    this.inner = inner;
    this.attempts = attempts;
  }

  async getQuote(parcel) {
    let lastError;
    for (let i = 0; i < this.attempts; i++) {
      try {
        return await this.inner.getQuote(parcel);
      } catch (err) {
        lastError = err;
      }
    }
    throw lastError; // la dernière erreur, après `attempts` échecs
  }
}

export class CachedQuote {
  #cache = new Map(); // clé -> { value, expiresAt }

  constructor(inner, { ttlMs = 60_000, now = Date.now } = {}) {
    this.inner = inner;
    this.ttlMs = ttlMs;
    this.now = now; // injectable : on teste l'expiration sans attendre
  }

  async getQuote(parcel) {
    const key = `${parcel.weightKg}|${parcel.zip}`;
    const hit = this.#cache.get(key);
    if (hit && hit.expiresAt > this.now()) return hit.value;

    const value = await this.inner.getQuote(parcel); // une erreur n'est JAMAIS mise en cache
    this.#cache.set(key, { value, expiresAt: this.now() + this.ttlMs });
    return value;
  }
}
