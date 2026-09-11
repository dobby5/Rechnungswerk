# Rechnungswerk

Produktionsorientierte Multi-User-Webanwendung zum Erstellen, Verwalten, Versionieren, Archivieren und Exportieren von Rechnungen. Die Oberfläche ist mobile-first und wechselt auf kleinen Bildschirmen bewusst von Tabellen zu Card-Workflows.

## Funktionsumfang

- sichere Anmeldung mit Argon2id, rotierenden Refresh-Tokens, HttpOnly-Cookies, CSRF- und Rate-Limit-Schutz
- relationale Rollen und Berechtigungen mit serverseitiger Autorisierung und Ownership-Checks
- Kundenverwaltung mit archivierten Stammdaten und unveränderlichen Rechnungssnapshots
- Rechnungs-CRUD, Duplikate, Statusworkflow, Suche, Filter, Sortierung und Pagination
- centgenaue Berechnung über ganzzahlige Minor Units, Basis-Punkte und deterministische Rundung
- vollständige Versionen, Vergleich, Benutzer-/Zeitnachweis und Restore-as-new-version
- Soft Delete, 30-Tage-Papierkorb, Wiederherstellung und täglicher Purge-Job
- echte Dashboard-Kennzahlen aus PostgreSQL
- serverseitige PDF- und DOCX-Erzeugung aus einem gemeinsamen Dokumentmodell
- Einzel- und Mehrfach-Export als ZIP
- Audit Log für Authentifizierung, Stammdaten, Rechnungen, Dokumente und Exporte
- responsives Vuetify-UI, Dark Mode, Skeletons, Empty States, Undo und Tastaturfokus

Die verbindlichen Architekturentscheidungen stehen in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), der Phasenplan in [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md).

## Architektur

```text
Browser ── HTTPS ── Nginx/Vue 3 + Vuetify 4
                       │ /api/v1
                       ▼
                 NestJS 11 API
                       │ ACID / TypeORM
                       ▼
                  PostgreSQL 17
```

Das System ist als modularer Monolith aufgebaut. Fachmodule teilen eine Transaktionsgrenze, bleiben aber getrennt genug, um Dokumentjobs oder Audit-Verarbeitung später auszulagern. Geldbeträge werden nie als JavaScript-Floating-Point persistiert.

## Voraussetzungen

Empfohlen ist ausschließlich Docker:

- Docker Engine 27+
- Docker Compose 2.30+
- mindestens 2 GB freier RAM

Für lokale Entwicklung ohne Container:

- Node.js 24+
- pnpm 11+
- PostgreSQL 17 mit den Extensions `pgcrypto` und `pg_trgm`

## Schnellstart mit Docker

```bash
cp .env.example .env
# JWT_SECRET, POSTGRES_PASSWORD und ADMIN_PASSWORD in .env unbedingt ändern
docker compose up --build
```

Danach ist die Anwendung unter <http://localhost:8080> erreichbar. Beim ersten Start werden Migration und idempotenter Seed automatisch ausgeführt. Der Seed-Administrator verwendet `ADMIN_EMAIL` und `ADMIN_PASSWORD` aus `.env`.

Status prüfen:

```bash
docker compose ps
curl http://localhost:8080/healthz
curl http://localhost:8080/api/v1/health
```

Stoppen, Daten aber behalten:

```bash
docker compose down
```

`docker compose down -v` löscht das Datenbank-Volume dauerhaft und sollte nur für bewusstes Zurücksetzen einer lokalen Umgebung verwendet werden.

## Development Setup

Container mit Hot Reload:

```bash
cp .env.example .env
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

Oder Prozesse lokal starten:

```bash
corepack enable
pnpm install
cp .env.example .env
# DATABASE_URL in .env auf localhost anpassen
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Web läuft lokal auf Port 5173, die API auf Port 3000. Vite leitet `/api` an die API weiter.

## Environment-Variablen

| Variable | Bedeutung | Production-Hinweis |
| --- | --- | --- |
| `NODE_ENV` | `development`, `test` oder `production` | `production` |
| `DATABASE_URL` | PostgreSQL-Verbindungs-URL | separates DB-Konto, Secret Store |
| `POSTGRES_*` | Initialisierung des Compose-Datenbankcontainers | lange zufällige Werte |
| `JWT_SECRET` | Signatur des Access-Tokens | mindestens 32 zufällige Zeichen, besser 64 |
| `ACCESS_TOKEN_TTL` | Gültigkeit des Access-Tokens | Standard `15m` |
| `REFRESH_TOKEN_TTL_DAYS` | maximale Sitzungsdauer | Standard `7` |
| `APP_ORIGIN` | exakt erlaubte Browser-Origin | öffentliche HTTPS-Origin |
| `COOKIE_SECURE` | `Secure`-Attribut für Cookies | unter HTTPS zwingend `true` |
| `ADMIN_EMAIL` | initiales Administratorkonto | organisationsbezogene Adresse |
| `ADMIN_PASSWORD` | initiales Administratorpasswort | nach erster Anmeldung wechseln/rotieren |
| `TRASH_RETENTION_DAYS` | technische Papierkorb-Frist | Standard `30` |
| `WEB_PORT` | veröffentlichter Web-Port | Standard `8080` |
| `VITE_API_BASE_URL` | API-Basispfad im Browser-Build | Standard `/api/v1` |

Secrets gehören weder in Git noch in Images. Für Orchestratoren sind Docker Secrets, Kubernetes Secrets oder ein Cloud Secret Manager vorzuziehen.

## Datenbankmigrationen

```bash
pnpm db:migrate
pnpm --filter @rechnungswerk/api migration:revert
```

Production-Container führen ausstehende Migrationen vor dem API-Start aus. Neue Schemaänderungen müssen als explizite, vorwärts und rückwärts lesbare Migration unter `apps/api/src/database/migrations` angelegt werden. `synchronize` bleibt immer deaktiviert.

## Benutzerverwaltung

1. Mit dem Seed-Administrator anmelden.
2. In **Benutzerverwaltung** ein Konto mit Name, E-Mail, initialem Passwort und mindestens einer Rolle anlegen.
3. `Benutzer` verwaltet eigene Kunden und Rechnungen; `Administrator` besitzt zusätzlich Benutzer-, Audit- und systemweite Papierkorbrechte.

Rollen und Berechtigungen liegen in `roles`, `permissions`, `user_roles` und `role_permissions`. Zusätzliche Rollen benötigen keine Änderung am Authentifizierungsmodell.

## Tests und Qualität

```bash
pnpm typecheck
pnpm test
pnpm build
```

Die Suite deckt Geld-/Steuerberechnung und Rundung, Argon2id, Berechtigungs-Guards, Versions-/Concurrency-Policy, 30-Tage-Löschfrist sowie PDF- und DOCX-Erzeugung ab. Das Web wird zusätzlich vollständig mit `vue-tsc` geprüft.

## Production Deployment

1. `.env` aus einem Secret Store bereitstellen; `COOKIE_SECURE=true` und `APP_ORIGIN=https://…` setzen.
2. TLS am Load Balancer oder Reverse Proxy terminieren und HSTS aktivieren.
3. Images reproduzierbar bauen: `docker compose build --pull`.
4. Vor Migrationen ein konsistentes Datenbankbackup erstellen.
5. `docker compose up -d` und beide Healthchecks beobachten.
6. API und Datenbank nur im internen Netz belassen; ausschließlich Nginx veröffentlichen.

Für horizontale Skalierung muss der Purge-Cron durch einen einzelnen Scheduler oder einen verteilten Lock geschützt werden. Dokumentexports sind auf 100 Rechnungen begrenzt; bei größeren Lasten empfiehlt sich später eine Queue mit Object Storage und kurzlebigen Download-URLs.

## Backup und Restore

Verschlüsseltes Zielverzeichnis außerhalb des Hosts bereitstellen. Beispiel für ein Custom-Format-Backup:

```bash
docker compose exec -T db pg_dump \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  --format=custom --compress=9 > backups/rechnungswerk-$(date +%F).dump
```

Restore in eine leere, kompatible Datenbank:

```bash
docker compose stop api
docker compose exec -T db pg_restore \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  --clean --if-exists < backups/rechnungswerk-YYYY-MM-DD.dump
docker compose start api
```

Empfohlene Aufbewahrung: sieben tägliche, vier wöchentliche und zwölf monatliche Backups. Restore-Proben mindestens quartalsweise durchführen. Backup-Dateien enthalten personenbezogene und steuerrelevante Daten und müssen verschlüsselt sowie zugriffsgeschützt sein.

## API-Konventionen

- Basis: `/api/v1`
- Cookies: `access_token`, `refresh_token`, `csrf_token`
- verändernde Requests: Header `X-CSRF-Token` mit dem Wert des CSRF-Cookies
- Pagination: `page`, `pageSize` (maximal 100)
- Listenfilter: `search`, `status`, `dateFrom`, `dateTo`, `customerId`, `invoiceNumber`, `sortBy`, `sortOrder`
- Fehler: `{ statusCode, code, message, details?, requestId, timestamp }`

Wichtige Routen sind in `docs/ARCHITECTURE.md` zusammengefasst. Alle fachlichen Dokument- und Rechnungsrouten prüfen Besitz bzw. Administratorrolle serverseitig.

## Rechtlicher Hinweis

Die Software stellt technische Nachvollziehbarkeit und unveränderliche Versionen bereit. Steuerliche Aufbewahrungsfristen, GoBD-Prozesse, Nummernkreise, Stornologik und Löschsperren müssen vor Produktiveinsatz anhand des konkreten Landes, Unternehmens und Verfahrens geprüft und konfiguriert werden.
