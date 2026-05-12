# Kvitto — Udgiftsstyring

Selvhostet udgiftsstyring med React frontend, Node.js API og MariaDB.

## Funktioner
- Udgifter med valuta og kvitteringsbilleder
- Rapporter med status-flow (igangværende → til godkendelse → godkendt)
- PDF og Excel eksport
- Invite-baseret brugeradministration
- Tilbagevendende udgifter
- PWA — installerbar på iPhone/Android
- Offline-support med automatisk synkronisering
- Mørkt/lyst tema
- E-mail notifikationer ved udgifter

## Installation

Se den fulde installationsguide i `kvitto_install_guide.docx` eller følg nedenstående:

```bash
git clone https://github.com/dit-brugernavn/kvitto.git
cd kvitto
chmod +x install.sh
bash install.sh
```

## Miljøvariabler

Kopiér `backend/.env.example` til `backend/.env` og udfyld:

```
DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME
JWT_SECRET
SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
APP_URL
GITHUB_REPO=dit-brugernavn/kvitto
APP_DIR=/opt/kvitto
```

## Tech stack

| Lag | Teknologi |
|---|---|
| Frontend | React 18 + Vite (PWA) |
| Backend | Node.js 20 + Express |
| Database | MariaDB |
| Auth | JWT + bcrypt |
| E-mail | Nodemailer |
| PDF | PDFKit |
| Excel | SheetJS (xlsx) |
| Procesmanager | PM2 |

## Licens

MIT
