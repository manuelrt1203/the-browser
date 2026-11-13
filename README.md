# The Browser

Discover. Watch. Enjoy.

Catalogue Next.js de films et séries, synchronisé avec le canal public [@TheBrowser365](https://t.me/TheBrowser365), avec recherche, filtres, tri alphabétique et accès aux publications/épisodes Telegram.

Site : https://the-browser-one.vercel.app/

## Références du projet

- [Mémoire complète et décisions en vigueur](PROJECT_MEMORY.md)
- [Fonctionnement et exploitation de Telegram](docs/telegram.md)
- [Paiements : décisions confirmées et sujets reportés](docs/payments.md)
- [Consignes de développement](AGENTS.md)

## Développement

Utiliser Node.js 24 et le verrou npm existant :

```sh
npm ci
npm run dev
```

Voir `.env.example` pour les noms des variables. En production Vercel, les publications sont conservées dans Upstash Redis. Les polices Geist sont fournies localement par le paquet `geist`.

## Vérification

```sh
npm test
npm run lint
npm run build
```

Les scripts d’import et de contrôle du webhook sont documentés dans [docs/telegram.md](docs/telegram.md). Les secrets restent dans les paramètres sécurisés ou des fichiers `.env` ignorés par Git.

## Évolution retenue

Le propriétaire souhaite un abonnement mensuel à un canal privé, avec le canal public conservé pour la découverte. Prix, devises, prestataire et renouvellement seront discutés à une prochaine session. Le lecteur vidéo intégré est retiré du périmètre et Rust est mis de côté. Les paiements et comptes clients ne sont pas encore implémentés.
