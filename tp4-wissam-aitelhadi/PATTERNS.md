# PATTERNS — TP 4 · binôme NOM1 Prénom1 / NOM2 Prénom2 · parcours Dev

## Tableau des patterns

| Pattern | Problème résolu (dans ShopLite) | Alternative écartée | Pourquoi écartée |
|---|---|---|---|
| **Factory Method** (+ registre `Map`) — `createChannel`, `registerChannel` | ShopLite prévient ses clients par e-mail, SMS, push, et bientôt Slack pour la logistique. Le code appelant ne doit pas connaître les classes concrètes, et un nouveau canal ne doit pas obliger à rouvrir du code testé. | Un `switch (type)` / des `new EmailChannel()` répartis dans l'application. | Chaque nouveau canal obligerait à modifier la fabrique et tous les `switch` : violation de l'OCP et risque de régression. Avec le registre, Slack s'ajoute dans `slack.js` sans toucher `channels.js`. |
| **Builder** — `MessageBuilder` | Un message a un destinataire, un gabarit à variables `{{nom}}`, une priorité facultative. On veut le construire pas à pas, sans oublier de champ, et obtenir un objet fiable. | Un constructeur à nombreux paramètres positionnels, ou un simple objet littéral `{ to, body, priority }`. | Le constructeur à paramètres est illisible et fragile (ordre, valeurs optionnelles) ; l'objet littéral n'est validé nulle part et peut être modifié après coup. Le Builder valide une seule fois dans `build()` et renvoie un objet gelé (`Object.freeze`). |
| **Adapter** — `ColissimoAdapter`, `DhlAdapter` | Colissimo est synchrone, en grammes et centimes ; DHL est asynchrone, en kilos, avec un montant en texte. L'application veut comparer les deux avec un seul contrat `getQuote({ weightKg, zip })`. Les API sont fournies et non modifiables. | Des `if (carrier === 'dhl')` dans le code qui compare les tarifs, ou modifier les API. | Les conversions d'unités se retrouveraient dispersées dans le métier, à dupliquer pour chaque nouveau transporteur. Modifier les API est interdit (code fourni). L'adaptateur isole la conversion à un seul endroit. |
| **Decorator** — `RetryQuote`, `CachedQuote` | DHL est parfois indisponible (503) et chaque appel a un coût. Il faut de la résilience (nouvelle tentative) et un cache, sans alourdir les adaptateurs. | Mettre la logique de retry et de cache dans chaque adaptateur, ou une **sous-classe par combinaison** (`CachedRetryDhlAdapter`…). | La logique serait dupliquée dans chaque transporteur. Avec l'héritage, les combinaisons explosent (retry seul, cache seul, les deux, dans les deux ordres). Les décorateurs gardent la même interface `getQuote` et se composent à volonté. |
| **Facade** — `ShippingService.bestQuote` | Le reste de l'application veut seulement « le meilleur tarif » : elle ne doit pas gérer l'interrogation en parallèle, les pannes d'un transporteur, ni la règle « moins cher, puis plus rapide ». | Laisser chaque appelant boucler sur les transporteurs et comparer lui-même. | La gestion des pannes (`Promise.allSettled`) et la règle de choix seraient dupliquées et incohérentes d'un endroit à l'autre. La façade offre une seule méthode simple et robuste. |

## Pourquoi le cache doit-il envelopper le retry (et pas l'inverse) ?

On compose `cache(retry(transporteur))`.

- Le **retry rend l'appel fiable** : il absorbe les pannes passagères et ne laisse sortir qu'un résultat final (un devis, ou une erreur après 3 échecs). Le cache, placé à l'extérieur, ne voit donc que ce résultat final et ne mémorise que ce qui vaut la peine : un devis valide.
- Si l'on inversait (`retry(cache(transporteur))`), le cache serait au contact direct des appels instables. Selon l'implémentation, il risquerait de **mémoriser une panne** (par exemple en gardant la promesse en échec) : chaque nouvelle tentative du retry relirait alors la même erreur sans jamais rappeler le transporteur, et le retry deviendrait inutile. Pire, on pourrait servir une erreur pendant toute la durée du TTL.
- Dans notre implémentation, `CachedQuote` ne met jamais une erreur en cache (test dédié). Mais l'ordre `cache(retry(...))` reste le bon choix : lors d'un **cache hit**, on court-circuite tout, y compris la boucle de retry (aucun appel réseau, aucune latence).
- Résumé : le **cache** concerne les *résultats*, le **retry** concerne la *fiabilité du transport* ; on place le plus proche de la source ce qui concerne l'appel, et à l'extérieur ce qui concerne la réutilisation du résultat.

## Autres choix à expliquer à l'oral

- **Promise.allSettled** (façade) plutôt que `Promise.all` : `Promise.all` échoue dès qu'un transporteur échoue, alors qu'on veut ignorer les pannes. L'appel est enveloppé dans `Promise.resolve().then(...)` pour qu'une exception synchrone d'un transporteur soit aussi ignorée.
- **`now` injectable** (cache) : on teste l'expiration du TTL sans attendre.
- **Pas de modification de `channels.js` ni de `carrierApis.js`** : l'OCP est respecté (Slack s'ajoute dans un autre fichier ; les API sont importées).
