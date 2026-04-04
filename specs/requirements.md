# Requirements Document

## Introduction

The Golf Charity Platform is a subscription-driven web application that combines golf performance tracking, charity fundraising, and a monthly draw-based reward engine. Users subscribe to the platform, enter their golf scores in Stableford format, participate in monthly prize draws, and contribute a portion of their subscription to a charity of their choice. The platform is designed to feel emotionally engaging and modern, leading with charitable impact rather than traditional golf aesthetics.

## Glossary

- **Platform**: The Golf Charity Platform web application
- **Visitor**: An unauthenticated user browsing the Platform
- **Subscriber**: A registered user with an active subscription
- **Administrator**: A privileged user with access to the Admin Dashboard
- **Subscription**: A recurring payment plan (monthly or yearly) granting full Platform access
- **Stableford_Score**: A golf score in Stableford format, an integer between 1 and 45 inclusive
- **Score_Entry**: A single Stableford_Score paired with a date, submitted by a Subscriber
- **Score_History**: The rolling collection of the latest 5 Score_Entries for a Subscriber
- **Draw**: A monthly event in which winning numbers are selected and matched against Subscriber scores
- **Draw_Numbers**: The set of numbers selected during a Draw event
- **Jackpot**: The 5-Number Match prize pool tier, which rolls over to the next Draw if unclaimed
- **Prize_Pool**: The total funds allocated for a given Draw, derived from active Subscriber count
- **Charity**: A registered charitable organisation listed on the Platform
- **Charity_Contribution**: The portion of a Subscriber's subscription fee directed to a Charity
- **Winner**: A Subscriber whose Score_History matches 3, 4, or 5 Draw_Numbers
- **Verification**: The process by which a Winner submits proof of scores for Admin review
- **Payment_State**: The current status of a Winner's prize payout (Pending or Paid)
- **Auth_Service**: The authentication and session management component
- **Subscription_Service**: The component managing subscription lifecycle and payment processing
- **Score_Service**: The component managing Score_Entry creation and Score_History maintenance
- **Draw_Engine**: The component responsible for generating Draw_Numbers and evaluating matches
- **Charity_Service**: The component managing Charity listings and Charity_Contributions
- **Notification_Service**: The component responsible for sending email notifications
- **Admin_Dashboard**: The administrative interface for managing users, draws, charities, and payouts
- **User_Dashboard**: The authenticated Subscriber interface for scores, draws, and account management

---

## Requirements

### Requirement 1: User Registration and Authentication

**User Story:** As a Visitor, I want to register and log in securely, so that I can access platform features as a Subscriber.

#### Acceptance Criteria

1. WHEN a Visitor submits a valid registration form, THE Auth_Service SHALL create a Subscriber account and issue an authenticated session.
2. WHEN a Visitor submits an invalid registration form, THE Auth_Service SHALL return a descriptive validation error for each invalid field.
3. WHEN a Subscriber submits valid login credentials, THE Auth_Service SHALL issue an authenticated session token.
4. WHEN a Subscriber submits invalid login credentials, THE Auth_Service SHALL return an authentication error without revealing which field is incorrect.
5. THE Auth_Service SHALL enforce HTTPS on all authentication endpoints.
6. WHEN an authenticated session token expires, THE Auth_Service SHALL require the Subscriber to re-authenticate before accessing protected resources.
7. THE Auth_Service SHALL validate the Subscriber's authentication status on every authenticated request.

---

### Requirement 2: Subscription Plans and Payment Processing

**User Story:** As a Visitor, I want to choose a subscription plan and pay securely, so that I can become a Subscriber and access the platform.

#### Acceptance Criteria

1. THE Subscription_Service SHALL offer a monthly plan and a yearly plan, where the yearly plan is priced at a discounted rate relative to 12 monthly payments.
2. WHEN a Visitor initiates a subscription, THE Subscription_Service SHALL process payment through a PCI-compliant payment gateway.
3. WHEN a payment is successfully processed, THE Subscription_Service SHALL activate the Subscriber's account immediately.
4. IF a payment fails during initial subscription, THEN THE Subscription_Service SHALL notify the Subscriber of the failure and retain the account in an inactive state.
5. THE Subscription_Service SHALL validate the Subscriber's subscription status on every authenticated request and restrict access to platform features if the subscription is not active.
6. WHEN a subscription renewal date is reached, THE Subscription_Service SHALL automatically attempt to charge the Subscriber's payment method.
7. IF a renewal payment fails, THEN THE Subscription_Service SHALL transition the Subscriber's account to a lapsed state and notify the Subscriber via email.
8. WHEN a Subscriber cancels their subscription, THE Subscription_Service SHALL retain platform access until the end of the current billing period, then transition the account to an inactive state.
9. THE Subscription_Service SHALL maintain a record of each Subscriber's subscription state: active, inactive, lapsed, or cancelled.

---

### Requirement 3: Score Entry and Score History Management

**User Story:** As a Subscriber, I want to enter and manage my golf scores, so that I can participate in monthly draws.

#### Acceptance Criteria

1. WHEN a Subscriber submits a Score_Entry, THE Score_Service SHALL validate that the Stableford_Score is an integer between 1 and 45 inclusive.
2. WHEN a Subscriber submits a Score_Entry, THE Score_Service SHALL validate that the entry includes a date.
3. IF a Subscriber submits a Score_Entry with a Stableford_Score outside the range 1–45, THEN THE Score_Service SHALL reject the entry and return a descriptive validation error.
4. WHEN a Subscriber submits a valid Score_Entry and the Score_History already contains 5 entries, THE Score_Service SHALL remove the oldest Score_Entry and add the new one.
5. WHEN a Subscriber submits a valid Score_Entry and the Score_History contains fewer than 5 entries, THE Score_Service SHALL add the new Score_Entry to the Score_History.
6. THE Score_Service SHALL display a Subscriber's Score_History in reverse chronological order, with the most recent Score_Entry first.
7. WHILE a Subscriber has an active subscription, THE Score_Service SHALL permit the Subscriber to edit any Score_Entry in their Score_History.
8. THE Score_Service SHALL retain a maximum of 5 Score_Entries per Subscriber at any time.

---

### Requirement 4: Monthly Draw Execution

**User Story:** As an Administrator, I want to configure and run monthly draws, so that Subscribers can win prizes based on their scores.

#### Acceptance Criteria

1. THE Draw_Engine SHALL support two draw logic modes: random generation and algorithmic generation weighted by most and least frequent Subscriber scores.
2. WHEN an Administrator selects random draw logic, THE Draw_Engine SHALL generate Draw_Numbers using a statistically uniform random selection.
3. WHEN an Administrator selects algorithmic draw logic, THE Draw_Engine SHALL generate Draw_Numbers weighted by the frequency distribution of scores across all active Subscribers.
4. WHEN an Administrator initiates a simulation, THE Draw_Engine SHALL execute the draw logic and produce a preview of results without publishing them.
5. WHEN an Administrator publishes a Draw, THE Draw_Engine SHALL evaluate each active Subscriber's Score_History against the Draw_Numbers and record all matches.
6. THE Draw_Engine SHALL classify matches into three tiers: 5-Number Match, 4-Number Match, and 3-Number Match.
7. THE Draw_Engine SHALL execute one Draw per calendar month.
8. WHEN an Administrator publishes a Draw, THE Notification_Service SHALL send draw result notifications to all active Subscribers.

---

### Requirement 5: Prize Pool Calculation and Distribution

**User Story:** As a Subscriber, I want to understand how prizes are calculated and distributed, so that I can trust the fairness of the draw.

#### Acceptance Criteria

1. THE Subscription_Service SHALL allocate a fixed portion of each active Subscriber's subscription fee to the Prize_Pool for the current month's Draw.
2. THE Draw_Engine SHALL allocate 40% of the Prize_Pool to the 5-Number Match (Jackpot) tier.
3. THE Draw_Engine SHALL allocate 35% of the Prize_Pool to the 4-Number Match tier.
4. THE Draw_Engine SHALL allocate 25% of the Prize_Pool to the 3-Number Match tier.
5. WHEN multiple Winners share the same match tier, THE Draw_Engine SHALL divide that tier's prize equally among all Winners in that tier.
6. WHEN a Draw concludes with no 5-Number Match Winner, THE Draw_Engine SHALL carry the Jackpot forward and add it to the 5-Number Match allocation of the next Draw.
7. THE Draw_Engine SHALL calculate Prize_Pool tier amounts based on the count of active Subscribers at the time the Draw is published.

---

### Requirement 6: Charity Selection and Contribution

**User Story:** As a Subscriber, I want to select a charity and contribute a portion of my subscription, so that my participation supports a cause I care about.

#### Acceptance Criteria

1. WHEN a Visitor initiates a subscription, THE Charity_Service SHALL require the Visitor to select a Charity before completing registration.
2. THE Charity_Service SHALL allocate a minimum of 10% of each Subscriber's subscription fee as a Charity_Contribution to the Subscriber's selected Charity.
3. WHERE a Subscriber chooses to increase their Charity_Contribution percentage, THE Charity_Service SHALL apply the increased percentage to subsequent subscription payments.
4. THE Charity_Service SHALL permit a Subscriber to make an independent donation to a Charity that is not tied to the subscription fee.
5. WHEN a Subscriber changes their selected Charity, THE Charity_Service SHALL apply the new selection to subsequent subscription payments.

---

### Requirement 7: Charity Listings and Profiles

**User Story:** As a Visitor, I want to browse and search charities, so that I can find a cause I want to support.

#### Acceptance Criteria

1. THE Charity_Service SHALL provide a charity listing page displaying all active Charities.
2. WHEN a Visitor enters a search term on the charity listing page, THE Charity_Service SHALL return Charities whose name or description matches the search term.
3. WHEN a Visitor applies a filter on the charity listing page, THE Charity_Service SHALL return only Charities matching the selected filter criteria.
4. THE Charity_Service SHALL display an individual profile page for each Charity, including a description, images, and any upcoming events such as golf days.
5. THE Platform SHALL display a featured Charity in a spotlight section on the homepage.

---

### Requirement 8: Winner Verification

**User Story:** As an Administrator, I want to verify winner submissions, so that prizes are only paid to legitimate winners.

#### Acceptance Criteria

1. WHEN a Winner is identified after a Draw is published, THE Platform SHALL notify the Winner and prompt them to submit verification proof.
2. WHEN a Winner submits a screenshot of their scores from their golf platform, THE Platform SHALL record the submission and set the Payment_State to Pending.
3. WHEN an Administrator reviews a verification submission and approves it, THE Platform SHALL set the Payment_State to Paid.
4. WHEN an Administrator reviews a verification submission and rejects it, THE Platform SHALL notify the Winner of the rejection and the reason provided by the Administrator.
5. THE Platform SHALL restrict prize payment processing to Winners whose Payment_State is Paid.

---

### Requirement 9: User Dashboard

**User Story:** As a Subscriber, I want a personal dashboard, so that I can manage my account, scores, and track my participation.

#### Acceptance Criteria

1. THE User_Dashboard SHALL display the Subscriber's current subscription status, including whether it is active, inactive, or lapsed, and the next renewal date.
2. THE User_Dashboard SHALL provide a score entry and edit interface for the Subscriber's Score_History.
3. THE User_Dashboard SHALL display the Subscriber's selected Charity and current Charity_Contribution percentage.
4. THE User_Dashboard SHALL display a participation summary showing the number of Draws entered and the next upcoming Draw date.
5. THE User_Dashboard SHALL display a winnings overview showing the Subscriber's total amount won and the current Payment_State of any outstanding prizes.

---

### Requirement 10: Admin Dashboard — User and Subscription Management

**User Story:** As an Administrator, I want to manage users and subscriptions, so that I can maintain platform integrity and support Subscribers.

#### Acceptance Criteria

1. THE Admin_Dashboard SHALL display a searchable list of all registered Subscribers, including their subscription state and selected Charity.
2. WHEN an Administrator edits a Subscriber's profile, THE Admin_Dashboard SHALL persist the changes immediately.
3. WHEN an Administrator edits a Subscriber's Score_History, THE Score_Service SHALL apply the same validation rules as Subscriber-initiated score entries.
4. WHEN an Administrator manually changes a Subscriber's subscription state, THE Subscription_Service SHALL update the state and log the change with a timestamp and the Administrator's identifier.

---

### Requirement 11: Admin Dashboard — Draw Management

**User Story:** As an Administrator, I want full control over draw configuration and publishing, so that I can run fair and transparent monthly draws.

#### Acceptance Criteria

1. THE Admin_Dashboard SHALL allow an Administrator to select the draw logic mode (random or algorithmic) before each Draw.
2. THE Admin_Dashboard SHALL allow an Administrator to run a simulation of the Draw and review projected results before publishing.
3. WHEN an Administrator publishes a Draw, THE Draw_Engine SHALL finalise results and make them visible to Subscribers.
4. THE Admin_Dashboard SHALL prevent an Administrator from publishing more than one Draw per calendar month.

---

### Requirement 12: Admin Dashboard — Charity Management

**User Story:** As an Administrator, I want to manage charity listings, so that the platform always displays accurate and up-to-date charity information.

#### Acceptance Criteria

1. THE Admin_Dashboard SHALL allow an Administrator to add a new Charity with a name, description, images, and optional upcoming events.
2. THE Admin_Dashboard SHALL allow an Administrator to edit the details of an existing Charity.
3. THE Admin_Dashboard SHALL allow an Administrator to delete a Charity, provided no active Subscribers have that Charity selected.
4. IF an Administrator attempts to delete a Charity that has active Subscribers assigned to it, THEN THE Admin_Dashboard SHALL reject the deletion and display the count of affected Subscribers.
5. THE Admin_Dashboard SHALL allow an Administrator to designate one Charity as the featured spotlight Charity on the homepage.

---

### Requirement 13: Admin Dashboard — Winners and Payouts

**User Story:** As an Administrator, I want to manage winner verification and payouts, so that prizes are distributed accurately and transparently.

#### Acceptance Criteria

1. THE Admin_Dashboard SHALL display a list of all Winners for each Draw, including their match tier, prize amount, and current Payment_State.
2. THE Admin_Dashboard SHALL allow an Administrator to review a Winner's verification submission, including the uploaded screenshot.
3. WHEN an Administrator approves a verification submission, THE Admin_Dashboard SHALL update the Payment_State to Paid and record the Administrator's identifier and a timestamp.
4. WHEN an Administrator rejects a verification submission, THE Admin_Dashboard SHALL record the rejection reason and notify the Winner.
5. THE Admin_Dashboard SHALL allow an Administrator to upload proof of payment for a completed payout.

---

### Requirement 14: Reports and Analytics

**User Story:** As an Administrator, I want access to platform reports and analytics, so that I can monitor platform health and financial performance.

#### Acceptance Criteria

1. THE Admin_Dashboard SHALL display the total number of registered Subscribers and the count of active Subscribers.
2. THE Admin_Dashboard SHALL display the total Prize_Pool value for each Draw.
3. THE Admin_Dashboard SHALL display the total Charity_Contribution amounts per Charity for a selectable time period.
4. THE Admin_Dashboard SHALL display draw statistics including the number of Winners per tier and the Jackpot carry-forward history.

---

### Requirement 15: Email Notifications

**User Story:** As a Subscriber, I want to receive email notifications for important platform events, so that I stay informed without having to check the platform manually.

#### Acceptance Criteria

1. WHEN a Subscriber's subscription is successfully renewed, THE Notification_Service SHALL send a renewal confirmation email to the Subscriber.
2. WHEN a Subscriber's renewal payment fails, THE Notification_Service SHALL send a payment failure notification email to the Subscriber.
3. WHEN a Draw is published, THE Notification_Service SHALL send a draw results email to all active Subscribers.
4. WHEN a Subscriber is identified as a Winner, THE Notification_Service SHALL send a winner notification email prompting the Subscriber to submit verification proof.
5. WHEN a Winner's verification submission is rejected, THE Notification_Service SHALL send a rejection notification email to the Winner including the reason provided by the Administrator.

---

### Requirement 16: Public Homepage and Visitor Experience

**User Story:** As a Visitor, I want to understand the platform's value proposition immediately, so that I am motivated to subscribe.

#### Acceptance Criteria

1. THE Platform SHALL display a homepage that communicates the subscription model, draw mechanics, and charitable impact to a Visitor without requiring authentication.
2. THE Platform SHALL display a prominent subscribe call-to-action on the homepage that initiates the subscription flow.
3. THE Platform SHALL display the featured spotlight Charity on the homepage.
4. THE Platform SHALL allow a Visitor to browse the charity listing page and individual Charity profiles without requiring authentication.
5. THE Platform SHALL allow a Visitor to view an explanation of the draw mechanics without requiring authentication.

---

### Requirement 17: Performance, Security, and Responsiveness

**User Story:** As a Subscriber, I want the platform to be fast, secure, and usable on any device, so that I have a reliable experience regardless of how I access it.

#### Acceptance Criteria

1. THE Platform SHALL render all pages with a mobile-first, fully responsive layout that adapts to screen widths from 320px to 1920px.
2. THE Platform SHALL serve all pages and API responses over HTTPS.
3. THE Platform SHALL optimise all static assets to minimise page load time.
4. THE Auth_Service SHALL store passwords using a one-way cryptographic hashing algorithm with a per-user salt.
5. THE Platform SHALL sanitise all user-supplied input before persisting it to the database to prevent injection attacks.

---

### Requirement 18: Scalability and Extensibility

**User Story:** As a platform owner, I want the architecture to support future growth, so that the platform can expand without requiring a full rebuild.

#### Acceptance Criteria

1. THE Platform SHALL structure its data model to support multiple countries, including currency and locale fields on Subscriber and Subscription records.
2. THE Platform SHALL structure its data model to support team or corporate accounts as a future extension, including an optional group association field on Subscriber records.
3. THE Platform SHALL structure its codebase to allow a mobile application to consume the same API endpoints used by the web frontend.
