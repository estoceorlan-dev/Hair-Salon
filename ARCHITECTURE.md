# Romel Hair Salon Management System
## System Architecture Documentation

> Phases 0-2 implementation: the React/Express foundation and PostgreSQL schema/migrations/fixtures are available, while business definitions remain placeholders. The UI still uses sample records and preview access; real authentication and business API integration are later phases. Cash, GCash, Maya, and card remain display-only disabled options. Historical cash database fixtures do not process payments. See [database model](docs/database-model.md), [requirements](docs/requirements.md), and [business-rule placeholders](docs/business-rules.md).

## 1. Project Overview

The Romel Hair Salon Management System is an integrated web-based management system designed to digitalize and simplify the daily operations of Romel Hair Salon.

The system replaces manual processes such as appointment logbooks, handwritten inventory records, manual payroll and commission computation, and manually prepared sales reports.

The system integrates the following major business functions:

- User and Role Management
- Dashboard
- Customer Management
- Appointment Management
- Service Management
- Point of Sale (POS)
- Payment Management
- Inventory Management
- Employee Management
- Payroll and Commission Management
- Reports and Analytics
- System Settings
- Activity Logs

The application will initially operate in a localhost environment and use PostgreSQL as its relational database.

---

# 2. Technology Stack

## Frontend

- React
- Vite
- Custom CSS (retained for Phase 1; Tailwind adoption deferred)
- React Router
- Axios
- Recharts or Chart.js
- Lucide React

### Purpose

The frontend provides the user interface for the Manager, Receptionist/Cashier, Stylists, and Beauticians.

React is used for reusable and interactive UI components. Existing custom CSS provides styling; retaining it preserves the current interface during the foundation phase.

---

## Backend

- Node.js
- Express.js
- REST API
- JSON Web Token (JWT)
- bcrypt
- PostgreSQL database driver (`pg`)
- dotenv

### Purpose

The backend handles:

- Authentication
- Authorization
- Business logic
- Database operations
- Transaction processing
- Inventory updates
- Appointment validation
- Payroll calculations
- Commission calculations
- Report generation
- Analytics

---

## Database

- PostgreSQL
- Local PostgreSQL Server

### Purpose

PostgreSQL stores all persistent system information including:

- Users
- Employees
- Customers
- Services
- Appointments
- Transactions
- Payments
- Inventory
- Inventory movements
- Payroll
- Commissions
- Reports-related data
- System logs

---

# 3. High-Level Architecture

The system follows a three-tier architecture.

```text
┌─────────────────────────────────────┐
│          PRESENTATION LAYER         │
│                                     │
│       React + Custom CSS            │
│                                     │
│ Dashboard / POS / Appointments      │
│ Inventory / Payroll / Reports       │
└──────────────────┬──────────────────┘
                   │
                   │ HTTP / REST API
                   │ JSON
                   ▼
┌─────────────────────────────────────┐
│          APPLICATION LAYER          │
│                                     │
│        Node.js + Express.js         │
│                                     │
│ Controllers                         │
│ Services / Business Logic           │
│ Authentication / Authorization      │
│ Validation                          │
└──────────────────┬──────────────────┘
                   │
                   │ SQL Queries
                   ▼
┌─────────────────────────────────────┐
│             DATA LAYER              │
│                                     │
│            PostgreSQL               │
│          Local Database             │
│                                     │
│ Customers / Appointments            │
│ Sales / Inventory / Payroll         │
└─────────────────────────────────────┘
```
