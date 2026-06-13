"""List Stripe promotion codes and their underlying coupons.

Shows whether each code is active, when it expires, and the discount it
grants — useful for answering "is my promo code working / expired?".

Usage:
    poetry run python inspect_promos.py
    poetry run python inspect_promos.py --code FIRST199
"""

import argparse
from datetime import datetime, timezone

import stripe

from _common import stripe as _stripe, sget  # noqa: F401


def fmt_ts(ts):
    if not ts:
        return None
    return datetime.fromtimestamp(ts, tz=timezone.utc).strftime('%Y-%m-%d %H:%M UTC')


def discount_str(coupon) -> str:
    amount_off = sget(coupon, 'amount_off')
    if amount_off is not None:
        cur = (sget(coupon, 'currency') or '').upper()
        return f'{amount_off / 100:.2f} {cur} off'
    percent_off = sget(coupon, 'percent_off')
    if percent_off is not None:
        return f'{percent_off}% off'
    return '?'


def resolve_coupon(pc):
    """Coupon location varies by API version: pc.coupon (old) or
    pc.promotion.coupon as an id (newer). Return a Coupon object or {}."""
    coupon = sget(pc, 'coupon')
    if coupon and sget(coupon, 'id'):
        return coupon
    promotion = sget(pc, 'promotion') or {}
    coupon_id = sget(promotion, 'coupon')
    if isinstance(coupon_id, str):
        try:
            return stripe.Coupon.retrieve(coupon_id)
        except stripe.error.InvalidRequestError:
            return {'id': f'{coupon_id} (deleted)'}
    return coupon or {}


def describe(pc) -> None:
    coupon = resolve_coupon(pc)
    print(f'{sget(pc, "code")} (id={sget(pc, "id")})')
    print(f'    active={sget(pc, "active")} expires_at={fmt_ts(sget(pc, "expires_at"))} '
          f'redeemed={sget(pc, "times_redeemed")}/{sget(pc, "max_redemptions")}')
    print(f'    coupon={sget(coupon, "id")} {discount_str(coupon)} '
          f'duration={sget(coupon, "duration")} valid={sget(coupon, "valid")} '
          f'redeem_by={fmt_ts(sget(coupon, "redeem_by"))}')


def main() -> None:
    parser = argparse.ArgumentParser(description='Inspect Stripe promotion codes / coupons.')
    parser.add_argument('--code', help='filter to a single promo code (case-sensitive)')
    args = parser.parse_args()

    params = {'limit': 100, 'expand': ['data.coupon']}
    if args.code:
        params['code'] = args.code
    codes = stripe.PromotionCode.list(**params).data

    if not codes:
        print('No promotion codes found' + (f' for code {args.code}' if args.code else ''))
        return

    for pc in codes:
        describe(pc)


if __name__ == '__main__':
    main()
