# Implementierungsplan

Jede Phase endet mit einem start- und testbaren Stand.

1. **Foundation** – Monorepo, striktes TypeScript, gemeinsame Verträge, Compose-Netze/Volumes, Healthchecks und Umgebungsvalidierung.
2. **Identity & Data** – TypeORM-Modell, Migration/Seed, Auth-Cookies, CSRF, RBAC, Benutzerverwaltung und Audit-Grundlage.
3. **Billing Core** – Kunden, Geldberechnung, Rechnungs-CRUD, Nummernvergabe, Positionen, Statushistorie, Versionen und optimistische Sperre.
4. **Archive & Lifecycle** – Suche/Filter/Sortierung/Pagination, Duplikat, Soft Delete, Undo/Wiederherstellung und Purge-Job.
5. **Documents** – kanonisches Dokumentmodell, PDF/DOCX, Einzel-ZIP und Batch-ZIP.
6. **Business UI** – App Shell, Login, Dashboard, responsive Archivansichten, Editor, Kunden, Versionen, Papierkorb und Administration.
7. **Hardening** – Unit-/Integrationstests, A11y-relevante Zustände, Docker-Builds, Produktionsprofil, Backup-/Restore-Anleitung und End-to-End-Smoketest.

## Abnahmekriterien

- `docker compose up --build` startet Datenbank, API und Web mit bestandenen Healthchecks.
- Der Seed-Administrator kann sich anmelden und Benutzer verwalten.
- Eine Rechnung kann erstellt, berechnet, versioniert, finalisiert, exportiert, gelöscht und wiederhergestellt werden.
- Listen liefern echte paginierte Backend-Daten und wechseln mobil zu Cards.
- Kritische Rechen-, Auth-, RBAC-, Versionierungs-, Lösch- und Dokumenttests bestehen.
- Secrets sind nicht eingecheckt; `.env.example` dokumentiert jeden benötigten Wert.
