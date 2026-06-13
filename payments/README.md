# ChessBlunders payments admin scripts

Stripe + Supabase admin tooling for ChessBlunders, ported from the ChessPecker
`payments/` module and adapted to the ChessBlunders data model.

## Setup

```bash
poetry install
cp .env.example .env   # then fill in (already populated locally)
```

`.env` holds everything environment-specific: the live Stripe restricted key,
the Stripe product/price IDs (`STRIPE_PRODUCT_ID`, `STRIPE_MONTHLY_PRICE_ID`,
`STRIPE_YEARLY_PRICE_ID`), the Supabase URL + anon/service-role keys, the
Supabase management access token (`SUPABASE_ACCESS_TOKEN`) and project ref
(`SUPABASE_PROJECT_REF`), and the admin emails to skip in audits
(`ADMIN_EMAILS`). See `.env.example` for the full list. It is git-ignored;
never commit it.

## Data model (how this differs from ChessPecker)

- **Stripe**: one live account is shared across several apps. These scripts
  filter to the **ChessBlunders Premium** product/prices, configured via env:
  `STRIPE_PRODUCT_ID`, `STRIPE_MONTHLY_PRICE_ID`, `STRIPE_YEARLY_PRICE_ID`.
- **Supabase** (`SUPABASE_PROJECT_REF`): subscriptions live on the `profiles`
  table, keyed by the auth user id (`profiles.id == auth.users.id`).
  - There is **no** `email`, `tier`, or `username` column on `profiles`.
  - The user's email lives in `auth.users` (read via the Auth Admin API).
  - "Premium" is derived from `stripe_subscription_status`, not a tier.
  - The display name column is `chess_username`.

`_common.py` provides the bridge helpers: `user_id_for_email`,
`email_for_user_id`, `chess_username_map_for_emails`, `list_auth_users`, etc.

## Scripts

Read-only / inspection:
- `list_paid_users.py` — active ChessBlunders Stripe subscribers
- `list_monthly.py` — active monthly subscribers only
- `get_emails.py` — subscriber emails (+ chess_username), date filters
- `recent_payers.py` — who paid in the last N months, active vs lapsed
- `check_subscription.py` — subscription status for an email / username
- `audit_subscriptions.py` — Stripe vs Supabase mismatch audit
- `list_unsubscribed_users.py` — CSV of users with no active subscription
- `check_customer.py`, `inspect_customer.py`, `get_user_transaction_history.py`
- `inspect_promos.py`

Mutating (ask before running on live billing):
- `link_subscription.py` — attach a Stripe sub to a profile (`--dry-run` first)
- `reset_admin_account.py` — set a profile back to canceled
- `create_promo_code.py`, `deactivate_payment_links.py`,
  `expire_open_sessions.py`, `delete_customer.py`, `update_customer_email.py`

## Usage examples

```bash
poetry run python list_paid_users.py
poetry run python check_subscription.py user@example.com
poetry run python audit_subscriptions.py
poetry run python link_subscription.py user@example.com --subscription-id sub_XXX --dry-run
```
