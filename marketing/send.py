"""Send the "come back" email to users who haven't signed in for 7+ days.

python send.py --preview        render templates/comeback.html to output/preview.html
python send.py --dry-run        list who would be emailed today
python send.py --to you@x.com   send one test email
python send.py                  real send, at most DAILY_CAP per UTC day
"""
import argparse
import datetime
import hashlib
import hmac
import json
import pathlib
import urllib.error
import urllib.parse
import urllib.request

HERE = pathlib.Path(__file__).parent
TEMPLATE_ID = "comeback"
SUBJECT = "ChessBlunders has improved a lot since you left"
DAILY_CAP = 60


def load_env():
    env = {}
    for line in (HERE / ".env").read_text().splitlines():
        if "=" in line and not line.lstrip().startswith("#"):
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip()
    return env


ENV = load_env()


def unsubscribe_url(email):
    email = email.lower()
    token = hmac.new(ENV["UNSUBSCRIBE_SECRET"].encode(), email.encode(), hashlib.sha256).hexdigest()
    return "https://chessblunders.org/unsubscribe?" + urllib.parse.urlencode({"email": email, "token": token})


def render(email):
    html = (HERE / "templates" / f"{TEMPLATE_ID}.html").read_text(encoding="utf-8")
    return html.replace("{{UNSUBSCRIBE_URL}}", unsubscribe_url(email))


def request(url, method="GET", body=None, headers=None):
    req = urllib.request.Request(url, method=method, headers=headers or {},
                                 data=json.dumps(body).encode() if body is not None else None)
    with urllib.request.urlopen(req, timeout=30) as res:
        raw = res.read()
        return res.headers, json.loads(raw) if raw else None


def db(path, method="GET", body=None, prefer=None):
    key = ENV["SUPABASE_SERVICE_ROLE_KEY"]
    headers = {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json",
               "User-Agent": "chessblunders-marketing"}
    if prefer:
        headers["Prefer"] = prefer
    return request(f"{ENV['SUPABASE_URL']}/rest/v1/{path}", method, body, headers)


def resend(payload):
    _, res = request("https://api.resend.com/emails", "POST", {"from": ENV["FROM_EMAIL"], **payload},
                     {"Authorization": f"Bearer {ENV['RESEND_API_KEY']}", "Content-Type": "application/json",
                      "User-Agent": "chessblunders-marketing"})
    return res["id"]


def send_email(to):
    unsub = unsubscribe_url(to)
    return resend({
        "to": [to],
        "subject": SUBJECT,
        "html": render(to),
        "headers": {"List-Unsubscribe": f"<{unsub}>", "List-Unsubscribe-Post": "List-Unsubscribe=One-Click"},
    })


def unsubscribe_live():
    """The live unsubscribe route answers 400 to a bad token. Anything else (404, 503 no secret) = don't send."""
    try:
        request("https://chessblunders.org/api/unsubscribe?email=probe@example.com&token=" + "0" * 64, "POST",
                headers={"User-Agent": "chessblunders-marketing"})
    except urllib.error.HTTPError as e:
        return e.code == 400
    except Exception:
        return False
    return False


def report(lines):
    resend({"to": [ENV["REPORT_EMAIL"]], "subject": f"ChessBlunders email run: {lines[0]}",
            "text": "\n".join(lines)})


def remaining_today():
    today = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d")
    headers, _ = db(f"marketing_email_sends?select=id&sent_at=gte.{today}&limit=1", prefer="count=exact")
    return max(DAILY_CAP - int(headers["Content-Range"].split("/")[1]), 0)


def recipients(limit):
    _, rows = db("rpc/marketing_inactive_users", "POST", {"p_template": TEMPLATE_ID, "p_limit": limit})
    return [r["email"].lower() for r in rows]


def is_unsubscribed(email):
    _, rows = db(f"email_unsubscribes?select=email&email=eq.{urllib.parse.quote(email)}")
    return bool(rows)


def run():
    """Returns True when nobody is left to email (the scheduled task then removes itself)."""
    if not unsubscribe_live():
        print("unsubscribe page isn't live, not sending")
        report(["NOT SENT, unsubscribe page isn't working",
                "https://chessblunders.org/api/unsubscribe didn't answer as expected.",
                "Check the site is deployed and UNSUBSCRIBE_SECRET is set in Vercel."])
        return False
    cap = remaining_today()
    users = recipients(cap) if cap else []
    print(f"{datetime.datetime.now():%Y-%m-%d %H:%M} cap left {cap}, {len(users)} to send")
    sent, failed = [], []
    for email in users:
        if is_unsubscribed(email):
            continue
        try:  # claim first: the unique (email, template_id) stops double sends
            _, row = db("marketing_email_sends", "POST", {"email": email, "template_id": TEMPLATE_ID},
                        prefer="return=representation")
        except urllib.error.HTTPError as e:
            print(f"  skip {email}: already claimed ({e.code})")
            continue
        row_id = row[0]["id"]
        try:
            resend_id = send_email(email)
            db(f"marketing_email_sends?id=eq.{row_id}", "PATCH", {"resend_id": resend_id})
            sent.append(email)
            print(f"  sent {email}")
        except Exception as e:  # release the claim so they're retried next run
            db(f"marketing_email_sends?id=eq.{row_id}", "DELETE")
            failed.append(f"{email}: {e}")
            print(f"  FAILED {email}: {e}")
    left = len(recipients(10000))
    done = cap > 0 and not users
    print(f"  done, sent {len(sent)}, failed {len(failed)}, {left} still waiting")
    report([f"sent {len(sent)}, failed {len(failed)}, {left} left",
            f"Sent {len(sent)} \"{TEMPLATE_ID}\" emails ({cap} allowed today).",
            f"Failed: {len(failed)}. They'll be retried next run.",
            f"People still waiting for this email: {left}.",
            "Nobody left to email, so the daily task has removed itself." if done else "",
            "", "Sent to:", *sent, *(["", "Failed:", *failed] if failed else [])])
    return done


def self_check():
    a, b = unsubscribe_url("A@x.com"), unsubscribe_url("a@x.com")
    assert a == b and "token=" in a and len(urllib.parse.parse_qs(urllib.parse.urlparse(a).query)["token"][0]) == 64


if __name__ == "__main__":
    self_check()
    p = argparse.ArgumentParser()
    p.add_argument("--preview", action="store_true")
    p.add_argument("--dry-run", action="store_true")
    p.add_argument("--to")
    args = p.parse_args()
    if args.preview:
        out = HERE / "output" / "preview.html"
        out.parent.mkdir(exist_ok=True)
        out.write_text(render("you@example.com"), encoding="utf-8")
        print(out)
    elif args.dry_run:
        cap = remaining_today()
        users = recipients(cap) if cap else []
        print(f"cap left today: {cap}, would send to {len(users)}:")
        print("\n".join(users))
    elif args.to:
        print(send_email(args.to.lower()))
    else:
        raise SystemExit(3 if run() else 0)  # 3 = nobody left, run.bat deletes the task
