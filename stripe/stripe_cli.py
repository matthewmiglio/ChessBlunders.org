#!/usr/bin/env python3
"""
ChessBlunders Stripe CLI - Read-only access to subscription and payment data.

Requires a config.json file in the same directory with your Stripe restricted key:
    {
        "stripe_restricted_key": "rk_live_...",
        "chessblunders_price_ids": ["price_1StaZ3RpTvYYS9hR2jfIOp5g", "price_1StaZ3RpTvYYS9hR97iaYtYC"]
    }

IMPORTANT: Global flags (--json, --limit) must come BEFORE the subcommand!
    CORRECT:   poetry run python stripe_cli.py --json customer get cus_XXX
    WRONG:     poetry run python stripe_cli.py customer get cus_XXX --json

EXAMPLE COMMANDS
================

ChessBlunders Stats & Revenue:
    poetry run python stripe_cli.py stats
    poetry run python stripe_cli.py --json stats
    poetry run python stripe_cli.py revenue
    poetry run python stripe_cli.py --json revenue

Events (Webhook/API Logs - last 30 days):
    poetry run python stripe_cli.py events list
    poetry run python stripe_cli.py --limit 50 events list
    poetry run python stripe_cli.py events list --type invoice.payment_failed
    poetry run python stripe_cli.py events list --type customer.subscription.deleted
    poetry run python stripe_cli.py events list --type checkout.session.completed
    poetry run python stripe_cli.py events list --type invoice.paid
    poetry run python stripe_cli.py events list --created-after 24h
    poetry run python stripe_cli.py events list --created-after 7d

Customer Lookup:
    poetry run python stripe_cli.py customer find someone@example.com
    poetry run python stripe_cli.py --json customer find someone@example.com
    poetry run python stripe_cli.py customer get cus_TrQ3W3VDbmP0OG
    poetry run python stripe_cli.py --json customer get cus_TrQ3W3VDbmP0OG

Subscriptions:
    poetry run python stripe_cli.py subs list
    poetry run python stripe_cli.py --limit 50 subs list
    poetry run python stripe_cli.py subs list --status active
    poetry run python stripe_cli.py subs list --status canceled
    poetry run python stripe_cli.py subs list --status past_due
    poetry run python stripe_cli.py subs list --chessblunders-only
    poetry run python stripe_cli.py subs list --customer-id cus_TrQ3W3VDbmP0OG
    poetry run python stripe_cli.py subs get sub_1SthTtRpTvYYS9hRtcyLJRj5
    poetry run python stripe_cli.py --json subs get sub_1SthTtRpTvYYS9hRtcyLJRj5

Invoices:
    poetry run python stripe_cli.py invoices list
    poetry run python stripe_cli.py --limit 50 invoices list
    poetry run python stripe_cli.py invoices list --status paid
    poetry run python stripe_cli.py invoices list --status open
    poetry run python stripe_cli.py invoices list --customer-id cus_TrQ3W3VDbmP0OG

Payment Intents:
    poetry run python stripe_cli.py pi get pi_3SthTrRpTvYYS9hR1v7jIQKi
    poetry run python stripe_cli.py --json pi get pi_3SthTrRpTvYYS9hR1v7jIQKi

Charges:
    poetry run python stripe_cli.py charges get ch_XXXXXXXXXXXXXX
    poetry run python stripe_cli.py --json charges get ch_XXXXXXXXXXXXXX

TIPS
====
- "subs list" shows ALL products (Chesspecker, Fishbot, etc). Use --chessblunders-only to filter.
- "stats" and "revenue" are already filtered to ChessBlunders price IDs.
- Customer metadata includes supabase_user_id for linking to your database.
- Events only go back 30 days in Stripe.
- The table output uses rich library for nice formatting. Install with: pip install rich

Global Options (must come BEFORE subcommand):
    --json          Output raw JSON instead of formatted text
    --limit N       Limit results (default: 25, max: 100)
    --key KEY       Override Stripe API key from config
"""
import os
import sys
import json
import time
import argparse
from pathlib import Path
from typing import Any, Dict, Optional

import stripe

try:
    from rich import print
    from rich.table import Table
    from rich.console import Console
    console = Console()
    HAS_RICH = True
except ImportError:
    HAS_RICH = False

# Global config - loaded at startup
CONFIG: Dict[str, Any] = {}


def load_config() -> Dict[str, Any]:
    """Load config from JSON file."""
    config_path = Path(__file__).parent / 'config.json'
    if not config_path.exists():
        raise SystemExit(f"Config file not found: {config_path}\nCreate it with your Stripe keys.")
    with open(config_path) as f:
        return json.load(f)


def init_config(key: Optional[str] = None) -> None:
    """Load config and set Stripe API key."""
    global CONFIG
    CONFIG = load_config()

    if key:
        stripe.api_key = key
    else:
        stripe.api_key = CONFIG.get('stripe_restricted_key')

    if not stripe.api_key:
        raise SystemExit("No stripe_restricted_key found in config.json")


def to_ts(dt: str) -> int:
    """Convert relative time (24h, 7d, 30d) to unix timestamp."""
    now = int(time.time())
    unit = dt[-1].lower()
    n = int(dt[:-1])
    if unit == 'h':
        return now - n * 3600
    if unit == 'd':
        return now - n * 86400
    raise ValueError("Use formats like 24h, 7d, 30d")


def print_json(obj: Any) -> None:
    """Print object as formatted JSON."""
    print(json.dumps(obj, indent=2, sort_keys=True, default=str))


def format_amount(cents: int, currency: str = 'usd') -> str:
    """Format cents as currency string."""
    return f"${cents / 100:.2f} {currency.upper()}"


def format_timestamp(ts: int) -> str:
    """Format unix timestamp as readable date."""
    from datetime import datetime
    return datetime.fromtimestamp(ts).strftime('%Y-%m-%d %H:%M')


# ============================================================================
# Commands
# ============================================================================

def cmd_stats(args: argparse.Namespace) -> None:
    """Show ChessBlunders subscription stats."""
    print("\n[bold]ChessBlunders Subscription Stats[/bold]\n" if HAS_RICH else "\nChessBlunders Subscription Stats\n")

    # Count subscriptions by status
    stats = {'active': 0, 'canceled': 0, 'past_due': 0, 'other': 0}
    total_mrr = 0

    for price_id in CONFIG['chessblunders_price_ids']:
        for status in ['active', 'canceled', 'past_due']:
            subs = stripe.Subscription.list(price=price_id, status=status, limit=100)
            stats[status] += len(subs.data)
            if status == 'active':
                total_mrr += len(subs.data) * 499  # $4.99 in cents

    if args.json:
        print_json({'stats': stats, 'mrr_cents': total_mrr})
        return

    print(f"Active Subscriptions: {stats['active']}")
    print(f"Canceled: {stats['canceled']}")
    print(f"Past Due: {stats['past_due']}")
    print(f"MRR: {format_amount(total_mrr)}")


def cmd_revenue(args: argparse.Namespace) -> None:
    """Show ChessBlunders revenue."""
    from datetime import datetime

    now = datetime.now()
    start_of_month = datetime(now.year, now.month, 1)
    start_of_last_month = datetime(now.year, now.month - 1 if now.month > 1 else 12, 1)

    total = 0
    this_month = 0
    last_month = 0

    for invoice in stripe.Invoice.list(status='paid', limit=100).auto_paging_iter():
        # Check if invoice is for ChessBlunders
        is_cb = any(
            line.price and line.price.id in CONFIG['chessblunders_price_ids']
            for line in invoice.lines.data
        )
        if not is_cb:
            continue

        amount = invoice.amount_paid
        total += amount

        invoice_date = datetime.fromtimestamp(invoice.created)
        if invoice_date >= start_of_month:
            this_month += amount
        elif invoice_date >= start_of_last_month:
            last_month += amount

    if args.json:
        print_json({
            'total': total,
            'this_month': this_month,
            'last_month': last_month
        })
        return

    print(f"\nChessBlunders Revenue:")
    print(f"  All Time: {format_amount(total)}")
    print(f"  This Month: {format_amount(this_month)}")
    print(f"  Last Month: {format_amount(last_month)}")


def cmd_events_list(args: argparse.Namespace) -> None:
    """List recent Stripe events."""
    params: Dict[str, Any] = {'limit': min(args.limit, 100)}
    if args.type:
        params['type'] = args.type
    if args.created_after:
        params['created'] = {'gte': to_ts(args.created_after)}

    events = stripe.Event.list(**params)

    if args.json:
        print_json(events)
        return

    if HAS_RICH:
        table = Table(title="Stripe Events")
        table.add_column("ID", style="dim")
        table.add_column("Type")
        table.add_column("Created")
        table.add_column("Live")
        for e in events.data:
            table.add_row(e.id, e.type, format_timestamp(e.created), str(e.livemode))
        console.print(table)
    else:
        for e in events.data:
            print(f"{e.id}  {e.type}  {format_timestamp(e.created)}  live={e.livemode}")


def cmd_customer_find(args: argparse.Namespace) -> None:
    """Find customer by email."""
    q = f'email:"{args.email}"'
    res = stripe.Customer.search(query=q, limit=min(args.limit, 100))

    if args.json:
        print_json(res)
        return

    for c in res.data:
        print(f"{c.id}  {c.email}  {c.name or '(no name)'}  created={format_timestamp(c.created)}")


def cmd_customer_get(args: argparse.Namespace) -> None:
    """Get customer details."""
    c = stripe.Customer.retrieve(args.customer_id)

    if args.json:
        print_json(c)
        return

    print(f"\nCustomer: {c.id}")
    print(f"  Email: {c.email}")
    print(f"  Name: {c.name or '(not set)'}")
    print(f"  Created: {format_timestamp(c.created)}")

    # Also show their subscriptions
    subs = stripe.Subscription.list(customer=c.id, limit=10)
    if subs.data:
        print(f"\n  Subscriptions:")
        for s in subs.data:
            print(f"    {s.id}  status={s.status}  cancel_at_period_end={s.cancel_at_period_end}")


def cmd_subs_list(args: argparse.Namespace) -> None:
    """List subscriptions."""
    params: Dict[str, Any] = {'limit': min(args.limit, 100)}
    if args.customer_id:
        params['customer'] = args.customer_id
    if args.status:
        params['status'] = args.status
    if args.chessblunders_only:
        params['price'] = CONFIG['chessblunders_price_ids'][0]

    subs = stripe.Subscription.list(**params)

    if args.json:
        print_json(subs)
        return

    if HAS_RICH:
        table = Table(title="Subscriptions")
        table.add_column("ID", style="dim")
        table.add_column("Status")
        table.add_column("Customer")
        table.add_column("Period End")
        table.add_column("Cancel?")
        for s in subs.data:
            table.add_row(
                s.id,
                s.status,
                s.customer,
                format_timestamp(s.current_period_end) if hasattr(s, 'current_period_end') else 'N/A',
                str(s.cancel_at_period_end)
            )
        console.print(table)
    else:
        for s in subs.data:
            print(f"{s.id}  status={s.status}  customer={s.customer}  cancel={s.cancel_at_period_end}")


def cmd_subs_get(args: argparse.Namespace) -> None:
    """Get subscription details."""
    s = stripe.Subscription.retrieve(args.subscription_id, expand=['items.data.price'])

    if args.json:
        print_json(s)
        return

    print(f"\nSubscription: {s.id}")
    print(f"  Status: {s.status}")
    print(f"  Customer: {s.customer}")
    print(f"  Cancel at period end: {s.cancel_at_period_end}")
    print(f"  Latest invoice: {s.latest_invoice}")

    # Get price info from items
    try:
        items_data = s.get('items', {}).get('data', [])
        if items_data:
            item = items_data[0]
            price = item.get('price', {})
            print(f"  Price: {price.get('id')}")
            recurring = price.get('recurring', {})
            print(f"  Amount: {format_amount(price.get('unit_amount', 0), price.get('currency', 'usd'))}/{recurring.get('interval', 'month')}")
    except Exception as e:
        print(f"  (Could not fetch price info: {e})")


def cmd_invoices_list(args: argparse.Namespace) -> None:
    """List invoices."""
    params: Dict[str, Any] = {'limit': min(args.limit, 100)}
    if args.customer_id:
        params['customer'] = args.customer_id
    if args.status:
        params['status'] = args.status

    invoices = stripe.Invoice.list(**params)

    if args.json:
        print_json(invoices)
        return

    for i in invoices.data:
        print(f"{i.id}  status={i.status}  {format_amount(i.amount_paid)}  customer={i.customer}  {format_timestamp(i.created)}")


def cmd_pi_get(args: argparse.Namespace) -> None:
    """Get PaymentIntent details."""
    pi = stripe.PaymentIntent.retrieve(args.payment_intent_id)

    if args.json:
        print_json(pi)
        return

    print(f"\nPaymentIntent: {pi.id}")
    print(f"  Status: {pi.status}")
    print(f"  Amount: {format_amount(pi.amount, pi.currency)}")
    print(f"  Customer: {pi.customer}")
    if pi.last_payment_error:
        print(f"  Error: {pi.last_payment_error.message}")


def cmd_charges_get(args: argparse.Namespace) -> None:
    """Get charge details."""
    ch = stripe.Charge.retrieve(args.charge_id)

    if args.json:
        print_json(ch)
        return

    print(f"\nCharge: {ch.id}")
    print(f"  Paid: {ch.paid}  Status: {ch.status}")
    print(f"  Amount: {format_amount(ch.amount, ch.currency)}")
    print(f"  Customer: {ch.customer}")
    print(f"  Balance Transaction: {ch.balance_transaction}")




# ============================================================================
# CLI Parser
# ============================================================================

def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog='stripe-cli',
        description='ChessBlunders Stripe CLI - Read-only access to subscription and payment data.'
    )
    p.add_argument('--key', help='Override Stripe API key')
    p.add_argument('--json', action='store_true', help='Output raw JSON')
    p.add_argument('--limit', type=int, default=25, help='Limit results (default: 25)')

    sub = p.add_subparsers(dest='cmd', required=True)

    # stats - ChessBlunders specific
    sub.add_parser('stats', help='Show ChessBlunders subscription stats')

    # revenue - ChessBlunders specific
    sub.add_parser('revenue', help='Show ChessBlunders revenue')

    # events
    pe = sub.add_parser('events', help='Event commands')
    se = pe.add_subparsers(dest='events_cmd', required=True)
    pe_list = se.add_parser('list', help='List events')
    pe_list.add_argument('--type', help='Filter by event type (e.g., invoice.payment_failed)')
    pe_list.add_argument('--created-after', help='Relative time (24h, 7d, 30d)')
    pe_list.set_defaults(func=cmd_events_list)

    # customer
    pc = sub.add_parser('customer', help='Customer commands')
    sc = pc.add_subparsers(dest='customer_cmd', required=True)
    pc_find = sc.add_parser('find', help='Find customer by email')
    pc_find.add_argument('email')
    pc_find.set_defaults(func=cmd_customer_find)
    pc_get = sc.add_parser('get', help='Get customer by ID')
    pc_get.add_argument('customer_id')
    pc_get.set_defaults(func=cmd_customer_get)

    # subscriptions
    ps = sub.add_parser('subs', help='Subscription commands')
    ss = ps.add_subparsers(dest='subs_cmd', required=True)
    ps_list = ss.add_parser('list', help='List subscriptions')
    ps_list.add_argument('--customer-id', help='Filter by customer')
    ps_list.add_argument('--status', help='Filter by status (active, canceled, past_due)')
    ps_list.add_argument('--chessblunders-only', action='store_true', help='Only ChessBlunders subscriptions')
    ps_list.set_defaults(func=cmd_subs_list)
    ps_get = ss.add_parser('get', help='Get subscription by ID')
    ps_get.add_argument('subscription_id')
    ps_get.set_defaults(func=cmd_subs_get)

    # invoices
    pi = sub.add_parser('invoices', help='Invoice commands')
    si = pi.add_subparsers(dest='invoices_cmd', required=True)
    pi_list = si.add_parser('list', help='List invoices')
    pi_list.add_argument('--customer-id', help='Filter by customer')
    pi_list.add_argument('--status', help='Filter by status (paid, open, void)')
    pi_list.set_defaults(func=cmd_invoices_list)

    # payment intents
    ppi = sub.add_parser('pi', help='PaymentIntent commands')
    spi = ppi.add_subparsers(dest='pi_cmd', required=True)
    ppi_get = spi.add_parser('get', help='Get PaymentIntent by ID')
    ppi_get.add_argument('payment_intent_id')
    ppi_get.set_defaults(func=cmd_pi_get)

    # charges
    pch = sub.add_parser('charges', help='Charge commands')
    sch = pch.add_subparsers(dest='charges_cmd', required=True)
    pch_get = sch.add_parser('get', help='Get charge by ID')
    pch_get.add_argument('charge_id')
    pch_get.set_defaults(func=cmd_charges_get)

    return p


def main(argv: list[str]) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    init_config(args.key)

    # Handle top-level commands that don't have subcommands
    if args.cmd == 'stats':
        cmd_stats(args)
    elif args.cmd == 'revenue':
        cmd_revenue(args)
    else:
        args.func(args)

    return 0


if __name__ == '__main__':
    raise SystemExit(main(sys.argv[1:]))
