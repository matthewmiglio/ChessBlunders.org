"""Shared config for ChessBlunders payment admin scripts.

ChessBlunders differs from ChessPecker in two important ways:

  1. Stripe — one live account is shared across several apps. These scripts
     filter to the "ChessBlunders Premium" product by its price IDs, all of
     which are configured in .env (STRIPE_PRODUCT_ID / *_PRICE_ID).

  2. Supabase — subscriptions live on the `profiles` table, keyed by the
     auth user id (profiles.id == auth.users.id). There is NO email, tier,
     or username column on `profiles`:
        - the user's email lives in auth.users (read via the Auth Admin API)
        - "premium" is derived from stripe_subscription_status, not a tier
        - the display name column is `chess_username`
     The helpers below bridge email <-> user_id <-> chess_username.
"""

import os

import requests
import stripe
from dotenv import dotenv_values, load_dotenv
from supabase import create_client

_ENV = dotenv_values(os.path.join(os.path.dirname(__file__), '.env'))
load_dotenv(os.path.join(os.path.dirname(__file__), '.env'), override=True)


def _env(*keys):
    """Read from our .env first, fall back to process env."""
    for k in keys:
        v = _ENV.get(k) or os.getenv(k)
        if v:
            return v
    return None


# ── Stripe ────────────────────────────────────────────────────────────────
stripe.api_key = _env('STRIPE_RESTRICTED_KEY', 'STRIPE_SECRET_KEY')

# ChessBlunders Premium Stripe IDs — read from .env so no live-account
# identifiers live in the committed source. See .env / .env.example.
CHESSBLUNDERS_PRODUCT_ID = _env('STRIPE_PRODUCT_ID')
MONTHLY_PRICE_ID = _env('STRIPE_MONTHLY_PRICE_ID')   # $4.99 / month
YEARLY_PRICE_ID = _env('STRIPE_YEARLY_PRICE_ID')     # $39.99 / year
CHESSBLUNDERS_PRICE_IDS = {p for p in (MONTHLY_PRICE_ID, YEARLY_PRICE_ID) if p}


def plan_for_price(price_id):
    """'monthly' / 'yearly' / the raw id for a ChessBlunders price."""
    if price_id == MONTHLY_PRICE_ID:
        return 'monthly'
    if price_id == YEARLY_PRICE_ID:
        return 'yearly'
    return price_id


# ── Supabase (DB writes/reads via service role) ───────────────────────────
SUPABASE_URL = _env('NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_URL')
_SERVICE_KEY = _env(
    'SUPABASE_SERVICE_ROLE_KEY',
    'SUPABASE_KEY',
    'NEXT_PUBLIC_SUPABASE_KEY',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
)
supabase = create_client(SUPABASE_URL, _SERVICE_KEY) if SUPABASE_URL and _SERVICE_KEY else None

PROFILES_TABLE = 'profiles'

# Admin emails to skip in audits — comma-separated in .env (ADMIN_EMAILS).
ADMIN_EMAILS = {
    e.strip().lower()
    for e in (_env('ADMIN_EMAILS') or '').split(',')
    if e.strip()
}


def sget(obj, key, default=None):
    """Safe getter for Stripe objects + plain dicts."""
    try:
        v = obj[key]
        return v if v is not None else default
    except (KeyError, AttributeError, TypeError):
        return default


# ── Auth Admin helpers (email <-> user_id <-> chess_username) ─────────────
# profiles has no email column, so we read auth.users via the Auth Admin API.
_AUTH_HEADERS = {
    'apikey': _SERVICE_KEY or '',
    'Authorization': f'Bearer {_SERVICE_KEY or ""}',
    'Content-Type': 'application/json',
}

_auth_users_cache = None


def list_auth_users(force=False):
    """Return every auth user as a list of dicts (id, email, created_at, ...).

    Paginated and cached for the life of the process.
    """
    global _auth_users_cache
    if _auth_users_cache is not None and not force:
        return _auth_users_cache
    if not SUPABASE_URL or not _SERVICE_KEY:
        return []

    users = []
    page = 1
    per_page = 1000
    while True:
        r = requests.get(
            f'{SUPABASE_URL}/auth/v1/admin/users',
            headers=_AUTH_HEADERS,
            params={'page': page, 'per_page': per_page},
            timeout=30,
        )
        if r.status_code != 200:
            raise SystemExit(f'Auth Admin API error {r.status_code}: {r.text}')
        batch = r.json()
        batch = batch.get('users', batch) if isinstance(batch, dict) else batch
        users.extend(batch)
        if len(batch) < per_page:
            break
        page += 1
    _auth_users_cache = users
    return users


def email_for_user_id(user_id):
    for u in list_auth_users():
        if u.get('id') == user_id:
            return u.get('email')
    return None


def emails_for_user_ids(user_ids):
    wanted = set(user_ids)
    return {
        u['id']: u.get('email')
        for u in list_auth_users()
        if u.get('id') in wanted
    }


def user_id_for_email(email):
    """First auth user id matching this email (case-insensitive), or None."""
    if not email:
        return None
    el = email.lower()
    for u in list_auth_users():
        if (u.get('email') or '').lower() == el:
            return u.get('id')
    return None


def email_to_user_id_map():
    return {
        (u.get('email') or '').lower(): u.get('id')
        for u in list_auth_users()
        if u.get('email')
    }


def chess_username_map_for_user_ids(user_ids):
    """{user_id: chess_username} from profiles for the given ids."""
    if not supabase or not user_ids:
        return {}
    ids = sorted(set(user_ids))
    out = {}
    chunk = 200
    for i in range(0, len(ids), chunk):
        resp = supabase.table(PROFILES_TABLE) \
            .select('id,chess_username') \
            .in_('id', ids[i:i + chunk]) \
            .execute()
        for row in (resp.data or []):
            out[row['id']] = row.get('chess_username')
    return out


def chess_username_map_for_emails(emails):
    """{lower_email: chess_username} bridging auth email -> profile username."""
    id_map = email_to_user_id_map()
    wanted_ids, id_to_email = [], {}
    for e in emails:
        if not e:
            continue
        uid = id_map.get(e.lower())
        if uid:
            wanted_ids.append(uid)
            id_to_email[uid] = e.lower()
    uname_by_id = chess_username_map_for_user_ids(wanted_ids)
    return {id_to_email[uid]: uname for uid, uname in uname_by_id.items()}
