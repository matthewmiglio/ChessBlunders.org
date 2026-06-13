"""Create a Stripe promotion code (and its coupon) so an expired promo works again.

Expired promo codes can't be revived — both a promotion code's expires_at
and a coupon's redeem_by are immutable. To bring a promo "back", create a
fresh coupon + promotion code with the same code string. Stripe allows reusing
a code string as long as only one promotion code with it is active.

Usage:
    # $3.00 off, code FIRST199, no expiry (works indefinitely)
    poetry run python create_promo_code.py --code FIRST199 --amount-off 300

    # reuse an existing coupon instead of creating one
    poetry run python create_promo_code.py --code FIRST199 --coupon-id COUP_ID

    # with an expiry and redemption cap
    poetry run python create_promo_code.py --code FIRST199 --amount-off 300 \
        --expires-at 2026-12-31T23:59:59 --max-redemptions 500

    poetry run python create_promo_code.py --code FIRST199 --amount-off 300 --dry-run
"""

import argparse
from datetime import datetime, timezone

import stripe

from _common import stripe as _stripe, sget  # noqa: F401


def parse_expires_at(value: str) -> int:
    """Accept an ISO 8601 string or a unix timestamp; return unix seconds."""
    if value.isdigit():
        return int(value)
    dt = datetime.fromisoformat(value)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return int(dt.timestamp())


def main() -> None:
    parser = argparse.ArgumentParser(description='Create a Stripe promotion code (+coupon).')
    parser.add_argument('--code', required=True, help='customer-facing code, e.g. FIRST199')
    parser.add_argument('--coupon-id', help='reuse an existing coupon instead of creating one')
    parser.add_argument('--amount-off', type=int, help='discount in cents (creates a coupon)')
    parser.add_argument('--percent-off', type=float, help='percent discount (creates a coupon)')
    parser.add_argument('--currency', default='usd')
    parser.add_argument('--duration', default='once', choices=['once', 'repeating', 'forever'])
    parser.add_argument('--coupon-name', help='display name for a newly created coupon')
    parser.add_argument('--expires-at', help='ISO 8601 or unix ts; omit for no expiry')
    parser.add_argument('--max-redemptions', type=int)
    parser.add_argument('--dry-run', action='store_true')
    args = parser.parse_args()

    if not args.coupon_id and args.amount_off is None and args.percent_off is None:
        parser.error('provide --coupon-id, or --amount-off / --percent-off to create a coupon')

    # Warn if an active code with this string already exists.
    existing = stripe.PromotionCode.list(code=args.code, active=True, limit=1).data
    if existing:
        raise SystemExit(
            f'An ACTIVE promo code "{args.code}" already exists ({existing[0].id}). '
            f'Deactivate it first or choose a different code.'
        )

    expires_at = parse_expires_at(args.expires_at) if args.expires_at else None

    # Describe the plan.
    if args.coupon_id:
        plan_coupon = f'reuse coupon {args.coupon_id}'
    elif args.amount_off is not None:
        plan_coupon = f'new coupon: {args.amount_off / 100:.2f} {args.currency.upper()} off, duration={args.duration}'
    else:
        plan_coupon = f'new coupon: {args.percent_off}% off, duration={args.duration}'
    print('Plan:')
    print(f'  {plan_coupon}')
    print(f'  promo code: "{args.code}" '
          f'expires_at={args.expires_at or "(none)"} max_redemptions={args.max_redemptions or "(none)"}')

    if args.dry_run:
        print('(dry run) nothing created')
        return

    # Create the coupon if needed.
    coupon_id = args.coupon_id
    if not coupon_id:
        coupon_params = {'duration': args.duration}
        if args.amount_off is not None:
            coupon_params['amount_off'] = args.amount_off
            coupon_params['currency'] = args.currency
        else:
            coupon_params['percent_off'] = args.percent_off
        if args.coupon_name:
            coupon_params['name'] = args.coupon_name
        coupon = stripe.Coupon.create(**coupon_params)
        coupon_id = coupon.id
        print(f'Created coupon {coupon_id}')

    # Create the promotion code. Newer API versions want a `promotion`
    # wrapper; older ones take a bare `coupon` id — try the new shape first.
    promo_params = {'code': args.code}
    if expires_at:
        promo_params['expires_at'] = expires_at
    if args.max_redemptions:
        promo_params['max_redemptions'] = args.max_redemptions
    try:
        promo = stripe.PromotionCode.create(
            promotion={'type': 'coupon', 'coupon': coupon_id}, **promo_params
        )
    except stripe.error.InvalidRequestError:
        promo = stripe.PromotionCode.create(coupon=coupon_id, **promo_params)
    print(f'Created promo code {promo.id} code={sget(promo, "code")} active={sget(promo, "active")}')


if __name__ == '__main__':
    main()
