"""List and deactivate Stripe payment links.

Payment links cannot be deleted, only deactivated — their URLs stop
working permanently. Custom-amount ("price entered by customer") links
are a favorite card-testing target, so deactivate any you no longer use.

Usage:
    poetry run python deactivate_payment_links.py --list
    poetry run python deactivate_payment_links.py --all
    poetry run python deactivate_payment_links.py --id plink_XXXX
    poetry run python deactivate_payment_links.py --all --dry-run
"""

import argparse

import stripe

from _common import stripe as _stripe, sget  # noqa: F401


def fetch_links(active_only: bool) -> list:
    out = []
    starting_after = None
    while True:
        params = {'limit': 100}
        if active_only:
            params['active'] = True
        if starting_after:
            params['starting_after'] = starting_after
        batch = stripe.PaymentLink.list(**params)
        out.extend(batch.data)
        if not batch.has_more:
            break
        starting_after = batch.data[-1].id
    return out


def describe(link) -> str:
    desc = f'{link.id} active={sget(link, "active")} url={sget(link, "url")}'
    items = stripe.PaymentLink.list_line_items(link.id, limit=10).data
    for item in items:
        price = sget(item, 'price') or {}
        amount = sget(price, 'unit_amount')
        amount_str = f'{amount / 100:.2f}' if amount is not None else 'customer-chooses'
        desc += f'\n    line: {sget(item, "description")} price={sget(price, "id")} amount={amount_str}'
    return desc


def main() -> None:
    parser = argparse.ArgumentParser(description='List/deactivate Stripe payment links.')
    parser.add_argument('--list', action='store_true', help='list all links and exit')
    parser.add_argument('--all', action='store_true', help='deactivate all active links')
    parser.add_argument('--id', action='append', default=[], help='deactivate specific link id(s)')
    parser.add_argument('--dry-run', action='store_true')
    args = parser.parse_args()

    if args.list:
        for link in fetch_links(active_only=False):
            print(describe(link))
        return

    if not args.all and not args.id:
        parser.error('provide --list, --all, or --id plink_XXXX')

    targets = fetch_links(active_only=True) if args.all else [
        stripe.PaymentLink.retrieve(i) for i in args.id
    ]
    if not targets:
        print('No active payment links found')
        return

    for link in targets:
        print(describe(link))
        if args.dry_run:
            print('    (dry run) would deactivate')
            continue
        updated = stripe.PaymentLink.modify(link.id, active=False)
        print(f'    deactivated -> active={sget(updated, "active")}')


if __name__ == '__main__':
    main()
