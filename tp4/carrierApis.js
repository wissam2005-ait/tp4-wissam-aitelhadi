// API des transporteurs (simulées). Elles sont FOURNIES et NON MODIFIABLES : formats différents.
export class ColissimoApi { // synchrone, grammes, centimes
  tarif({ poidsGrammes, codePostal }) {
    if (!/^\d{5}$/.test(codePostal)) throw new Error('Code postal invalide');
    return { prixCentimes: 495 + Math.round(poidsGrammes * 0.25), delaiJours: 2 };
  }
}
export class DhlClient { // asynchrone, kilos, montant en texte, parfois indisponible
  calls = 0;
  constructor({ failFirst = 0 } = {}) { this.failFirst = failFirst; }
  async getRate(weightKg, zip) {
    this.calls++;
    if (this.calls <= this.failFirst) throw new Error('503 Service Unavailable');
    return { amount: (8 + weightKg * 1.5).toFixed(2), currency: 'EUR', transitDays: 1, zip };
  }
}
