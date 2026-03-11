# CustomsClear System

CustomsClear is a **role-based formal entry validation platform** designed to support customs brokers, customs officers, and administrators in managing customs documentation workflows.

The system integrates **document submission, AI-assisted OCR extraction, validation, tax preview computation, and audit logging** to help streamline customs document review processes.

This project was developed as part of an academic system development project focusing on improving **digital document processing and validation workflows in customs operations**.

---

# Project Background

Customs processing involves reviewing large volumes of document-heavy shipment declarations such as airway bills, invoices, and goods descriptions.

Manual validation of these documents can be time-consuming and prone to inconsistencies.

CustomsClear was designed to assist this process by combining:

* automated **document data extraction**
* **rule-based validation**
* **role-based workflow management**
* **audit logging and tracking**

The system helps support structured review of customs entries while maintaining traceability of actions performed by brokers, officers, and administrators.

---

# Key Features

### Role-Based Access

Separate portals are provided for:

* **Broker Portal**
* **Customs Officer Portal**
* **Admin Portal**

Each role has specific permissions and workflow responsibilities.

---

### Broker Submission Workflow

Brokers can:

* submit formal entry documents
* upload shipment documentation
* trigger AI-assisted data extraction
* track submission status and history

---

### AI-Assisted OCR Extraction

The system uses **Google Gemini AI** to extract structured information from uploaded documents, including:

* airway bill numbers
* shipment information
* consignee details
* goods description
* tariff references

If needed, **PDF parsing fallback mechanisms** are used for extraction.

---

### Officer Validation Workflow

Customs officers can:

* review broker submissions
* inspect extracted document fields
* validate shipment information
* compute tax previews
* apply official actions (proceed, reject, send back)

---

### Tax Preview and Forex Integration

The system integrates API endpoints to compute estimated duties and taxes based on:

* shipment values
* HS code classification
* foreign exchange rates

---

### Administrative Oversight

Admin users can:

* approve broker accounts
* monitor activity logs
* review operational actions
* track system activity

---

# Technology Stack

Frontend

* Next.js 16 (App Router)
* React 19
* TypeScript

Backend

* Supabase (Database, Auth, Storage)

AI Processing

* Google Gemini (`@google/generative-ai`)

Document Parsing

* pdf-parse

Styling

* Global CSS
* Tailwind tooling

Deployment

* Vercel

---

# Project Structure

```
app/
  api/                        Route handlers (OCR, tax preview, forex, logging)
  admin/                      Admin screens
  broker/                     Broker submission and tracking pages
  officer/                    Officer review and workflow pages
  auth/                       Authentication flows
  components/                 Shared UI components
  lib/                        Supabase clients and utilities

scripts/
  load-env.js                 Environment loader
  seed-accounts.js            Seeds broker/officer/admin accounts
  clear-submissions.js        Clears submission records for reset

middleware.ts                 Auth/session middleware
```

---

# Core Application Workflows

### Broker

* Register or login
* Submit formal entry with supporting documents
* Trigger OCR extraction
* Review extracted document fields
* Track submission status

---

### Customs Officer

* Review submitted entries
* Inspect extracted data
* Fetch forex rates
* Compute tax preview
* Apply officer decision (approve / reject / send back)

---

### Admin

* Approve broker accounts
* Monitor system activity logs
* Track operational actions

---

# Environment Setup

Create a `.env.local` file in the project root:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
GEMINI_API_KEY=
```

Do **not commit real API keys or secrets** to the repository.

---

# Local Development Setup

Install dependencies:

```
npm install
```

Start the development server:

```
npm run dev
```

Open the application in your browser:

```
http://localhost:3000
```

---

# Available Scripts

`npm run dev`
Start development server.

`npm run build`
Build production version.

`npm run start`
Run production build.

`npm run lint`
Run ESLint checks.

`npm run seed`
Seed default role-based accounts in Supabase.

`npm run clear-db`
Remove submission records and reset data.

---

# API Endpoints (Representative)

```
/api/ocr-gemini
/api/ocr-extract
/api/tax-preview
/api/compute-tax-preview
/api/forex-rate
/api/log-activity
/api/officer-action
/api/broker/submit-entry
```

These endpoints support OCR extraction, tax preview computation, activity logging, and workflow actions.

---

# Deployment

This project is designed for deployment on **Vercel**, with **Supabase** used as the backend service.

Deployment configuration and workflow details are available in:

* `DEPLOYMENT_GUIDE.md`
* `DEPLOYMENT_CHECKLIST.md`

---

# Author

Brianne Leigh S. Baltazar
Information Technology Student – Mapúa University

GitHub
https://github.com/belsbee0017
