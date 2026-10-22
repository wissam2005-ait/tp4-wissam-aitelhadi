# TP 4 · Patterns créationnels et structuraux — parcours Dev (ShopLite)

Architecture Logicielle · Master 1 · INGETIS · Séance 4

Notifications multicanaux et client de transporteurs résilient.
**Auteurs :** NOM1 Prénom1, NOM2 Prénom2

```bash
node --test tp4.test.js   # 16 tests
node main.js              # démonstration
```
(Depuis la racine du projet : `node --test seance4-patterns/tp4-nom1-nom2/tp4.test.js`.)

| Étape | Pattern | Fichiers |
|---|---|---|
| 1 | Factory Method + registre (OCP) | `notifications/channels.js`, `notifications/slack.js` |
| 2 | Builder | `notifications/MessageBuilder.js` |
| 3a | Adapter | `shipping/adapters.js` |
| 3b | Decorator (retry, cache) | `shipping/decorators.js` |
| 4 | Facade | `shipping/ShippingService.js` |

`main.js` assemble le tout. `PATTERNS.md` justifie chaque pattern et l'alternative écartée.
Les API des transporteurs (`../tp4/carrierApis.js`) sont fournies et non modifiées.
