# Matched-company Firebase audit import

Reads the supplied workbook without modifying it. Uses exact string `companyCode` matches against existing Firestore `documents` records. Unmatched companies are reported and skipped, as requested. Ambiguous matches abort the import. Existing company documents are not changed.

Use Python with openpyxl and Node with this service's firebase-admin/dotenv dependencies:

```sh
python3 scripts/promoter-audit/read_workbook.py /path/to/workbook.xlsx /tmp/audit.json 2026-09-22.v1
node scripts/promoter-audit/import-matched.js --input /tmp/audit.json --env-file /path/to/private.env --report reports/dry-run.json
node scripts/promoter-audit/import-matched.js --input /tmp/audit.json --env-file /path/to/private.env --report reports/import.json --publish
```

Storage is exclusively Cloud Firestore:
- `promoterAuditReleases/{releaseId}` contains import metadata, date, version, methodology, retained editorial Top 10 and verification state.
- `promoterAuditReleases/{releaseId}/audits/{companyCode}` contains each full matched audit with existing `companyId`.
- `promoterAuditReleases/{releaseId}/sources/{hash}` contains separate linked sources.
- `promoterAuditState/current` points to the completed release.

The importer stages immutable records in batches, reads back and compares every field, then atomically publishes the pointer in a Firestore transaction. Failed staging is removed and never becomes active. An abruptly killed process may leave an inactive STAGING release. Repeating an identical active import is a no-op. Previous completed releases are retained for rollback; readers must follow only the current READY release. No public import endpoint is created.

JSON reports include skipped companies and planned/actual counts. JSON avoids spreadsheet formula execution. Credentials and workbook contents must not be committed. Existing Firebase security rules and frontend/API integration are separate from this data import; this command does not deploy the website.
