## Fundly Structure Blueprint

### 1. Project Overview
- **What Fundly Is:** A Solana-based incubator where early-stage startups can create tokenized project offerings and investors can back them using familiar crypto wallets.
- **Problem It Solves:** Startups often struggle to access early capital, while investors lack curated, transparent access to pre-seed deals. Fundly bridges both sides with a regulated, on-chain marketplace.
- **Core User Groups:**
  - **Startups** seeking funding and visibility.
  - **Investors** looking for vetted early opportunities.
  - **Fundly Admins** curating projects, handling compliance, and overseeing platform health.

### 2. High-Level System Architecture
- **Frontend Web App:** Browser-based interface built for clarity and trust; interacts with users’ Solana wallets.
- **Backend Service Layer:** REST or GraphQL API managing business logic, user profiles, analytics, permissions, and compliance workflows.
- **Solana Programs (Smart Contracts):** Handle token minting, ownership rights, escrow logic, and transaction recording on-chain.
- **Database & Storage:** Secure off-chain storage for project details, documents, and metadata linked to on-chain records.
- **Wallet & Payment Integrations:** Connectors for Solana wallets (e.g., Phantom) plus fiat on-ramps/off-ramps through approved partners.
- **Observability & Admin Tools:** Dashboards for Fundly staff to monitor activity, flag risks, and manage support.
- **Communication Flow:**
  1. Users interact with the frontend via browser/wallet.
  2. Frontend calls the backend for account tasks and data.
  3. Backend coordinates with Solana programs for token or transaction actions.
  4. Results are stored in the database and reflected back to the user.

### 3. Key User Flows
**Startup Journey**
1. **Onboarding:** Submit company details, founders, pitch deck, and compliance documents. Backend triggers KYC/KYB checks.
2. **Project Creation:** Define token economics (supply, pricing, vesting) and milestone roadmap in the dashboard.
3. **Review & Approval:** Fundly admins vet the submission, request edits, and schedule launch.
4. **Token Preparation:** Backend compiles parameters and interacts with Solana program to set up a project token mint and escrow PDA (Program Derived Address) for funds.
5. **Launch & Promotion:** Project goes live on the marketplace with campaign page, media, and updates. Startups can publish announcements and progress logs.
6. **Post-Launch Management:** Track investors, funds released per milestone, and deliver updates. Backend enforces vesting and release schedules.

**Investor Journey**
1. **Discovery:** Browse curated projects via search, filters, and featured highlights. View key metrics, founder info, roadmap, and risks.
2. **Due Diligence:** Access documents, team bios, audits, and community discussions. Optionally participate in AMAs or due diligence calls.
3. **Investment Prep:** Connect Solana wallet, pass KYC/AML checks, understand token terms, and acknowledge risk disclosures.
4. **Token Purchase:** Initiate a buy; the frontend generates a transaction for the investor’s wallet; the Solana program records token allocation and moves funds to the project’s escrow PDA.
5. **Portfolio Management:** Track holdings, vesting unlocks, and secondary liquidity options. Receive startup updates and vote on milestone releases if governance features exist.

### 4. Smart Contract Layer (Conceptual)
- **Project Registry Program:** Each accepted startup gets a unique on-chain record with metadata pointing to off-chain documents. PDAs store official state (e.g., total funds raised, milestones, admin status).
- **Token Minting Program:** Creates project-specific SPL tokens representing participation rights or revenue-sharing claims. Controls supply, distribution rules, and vesting schedules.
- **Escrow & Release Program:** Holds investor funds in PDAs until conditions are met (launch milestone, quorum approval, time-based unlock). Releases payments to startups based on backend signals and on-chain votes.
- **Governance & Voting Program (future-ready):** Allows token holders to vote on milestone releases or strategic decisions using weighted ballots.
- **PDAs Explained:** Program Derived Addresses are deterministic Solana accounts controlled by the program, not individuals. They safely store project state, escrow balances, and configuration data without private keys.
- **Transaction Flow:** Frontend signs instructions; backend assists with parameter preparation; Solana programs validate, update PDAs, and emit events for syncing back to the database.

### 5. Frontend vs Backend Responsibilities
- **Frontend Duties:**
  - Present onboarding forms, dashboards, marketplace listings, and analytics in an intuitive UI.
  - Manage wallet connections, transaction previews, and status messaging.
  - Guide startups through token setup via wizards and templates.
  - Provide investors with comparison tools, bookmarking, alerts, and investment confirmation steps.
- **Backend Duties:**
  - Store user profiles, compliance status, and project metadata.
  - Integrate third-party KYC/AML providers and handle document verification.
  - Orchestrate token launch workflows, ensuring data consistency between database and Solana.
  - Maintain activity logs, notifications, and investor statements.
  - Provide analytics for startups and admins (funding progress, engagement metrics, risk flags).

### 6. Data & Tokenomics Layer
- **Core Entities:** Users, Projects, Project Tokens, Investment Orders, Milestones, Compliance Records, Support Tickets.
- **Tokenomics Inputs:** Supply, price tiers, vesting cliffs, lockups, founder reserve, Fundly fee (e.g., percentage of funds raised, plus recurring platform fee).
- **Storage Strategy:**
  - On-chain: Token supply, investor balances, escrow amounts, milestone approvals.
  - Off-chain: Pitch materials, legal docs, marketing assets, aggregated analytics.
- **Revenue Model:** Potential combination of listing fees, percentage of successful raises, secondary market fees, and premium analytics subscriptions.
- **Reward Logic:** Consider loyalty points for active investors, reputation scores for startups, or referral bonuses tracked off-chain but redeemable via on-chain credits.

### 7. Security & Compliance Considerations
- **KYC/KYB:** Mandatory identity verification for investors and startups through certified providers; status stored in backend.
- **AML Monitoring:** Continuous transaction screening, suspicious activity reports, and limit alerts embedded in backend workflows.
- **Smart Contract Audits:** External security reviews for each Solana program plus on-chain monitoring for anomalies.
- **Regulatory Alignment:** Work with legal advisors to align offerings with securities regulations (Reg CF, Reg D, etc.) depending on jurisdiction.
- **Data Protection:** Enforce encryption at rest/in transit, role-based access, and incident response playbooks.

### 8. Future Roadmap
- **Secondary Marketplace:** Enable trading of project tokens post-launch with escrowed settlement and compliance checks.
- **Community Governance:** Token-holder forums, milestone voting, and DAO-style decision-making for fund releases.
- **Reputation & Scoring:** On-chain and off-chain metrics to rate startup performance and investor reliability.
- **NFT-Based Perks:** Offer limited-edition NFTs granting access to events, mentorship sessions, or premium reports.
- **AI-Powered Due Diligence:** Automated risk scoring, trend analysis, and recommendation engine to surface promising projects.
- **Cross-Chain Expansion:** Support wrapped assets or bridges for investors outside Solana while keeping core records on Solana.

---
Fundly’s structure balances user-friendly onboarding, rigorous compliance, and secure on-chain execution. This blueprint prepares the team to break down each component into detailed technical specifications and implementation tasks.

