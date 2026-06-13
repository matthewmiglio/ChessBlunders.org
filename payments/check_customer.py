"""Look up Stripe customer records by email.

Usage:
    poetry run python check_customer.py user@example.com
    poetry run python check_customer.py a@x.com b@x.com c@x.com
"""

import argparse

import stripe

from _common import stripe as _stripe  # noqa: F401  (ensures stripe.api_key set)


def check_email(email: str) -> None:
    results = stripe.Customer.search(query=f'email:"{email}"')
    if not results.data:
        print(f'{email:<45} NO Stripe customer')
        return
    for c in results.data:
        print(f'{email:<45} FOUND id={c.id} email={c.email}')


def main() -> None:
    parser = argparse.ArgumentParser(description='Look up Stripe customers by email.')
    parser.add_argument('emails', nargs='+')
    args = parser.parse_args()

    print(f'Key loaded: {stripe.api_key[:8]}...\n')
    for email in args.emails:
        check_email(email)


if __name__ == '__main__':
    main()
