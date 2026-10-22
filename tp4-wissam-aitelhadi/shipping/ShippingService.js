// Facade : une seule méthode simple pour le reste de l'application.
// Elle cache : appels en parallèle, gestion des pannes, comparaison des devis.
export class ShippingService {
  constructor(carriers) {
    this.carriers = carriers;
  }

  async bestQuote(parcel) {
    const results = await Promise.allSettled(
      // Promise.resolve().then(...) : une exception synchrone devient aussi un rejet
      this.carriers.map(c => Promise.resolve().then(() => c.getQuote(parcel))),
    );
    const quotes = results.filter(r => r.status === 'fulfilled').map(r => r.value);
    if (quotes.length === 0) throw new Error('Aucun transporteur disponible');

    // le moins cher ; à prix égal, le plus rapide
    return quotes.reduce((best, q) =>
      q.price < best.price || (q.price === best.price && q.days < best.days) ? q : best,
    );
  }
}
