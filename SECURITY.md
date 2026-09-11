# Security Policy

## Unterstützte Version

Sicherheitskorrekturen werden für den aktuellen Stand des `main`-Branches bereitgestellt.

## Schwachstellen melden

Bitte Sicherheitslücken nicht in einem öffentlichen Issue veröffentlichen. Nutze GitHubs **Private vulnerability reporting** im Security-Bereich des Repositorys und beschreibe:

- betroffene Version oder Commit
- reproduzierbare Schritte
- erwartete und tatsächliche Auswirkung
- vorhandenen Proof of Concept ohne echte personenbezogene Daten
- mögliche Abhilfe, falls bekannt

Ziel ist eine erste Rückmeldung innerhalb von drei Werktagen. Zugangsdaten, Rechnungen, Tokens und andere vertrauliche Daten dürfen nicht Teil eines Reports oder Logs sein.

## Betriebsanforderungen

- `JWT_SECRET`, Datenbank- und Administratorpasswort vor dem ersten Start ersetzen
- in Production `COOKIE_SECURE=true`, HTTPS und HSTS verwenden
- PostgreSQL und API nicht öffentlich exponieren
- Backups verschlüsseln und Restore regelmäßig testen
- `pnpm audit --prod` und Container-Scans in den Release-Prozess aufnehmen
