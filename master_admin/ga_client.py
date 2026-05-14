"""Google Analytics 4 Data API client for the master admin.

Setup (one-time, per Google account):
    1. Go to https://console.cloud.google.com/
    2. Create a project (or use existing). Note the project ID.
    3. Enable the "Google Analytics Data API" (search it, click Enable).
    4. Go to IAM & Admin → Service Accounts → Create Service Account.
       Name it "master-admin-ga". Skip the optional grants. Click Done.
    5. Click into the account → Keys tab → Add Key → JSON. Download the file.
    6. Save it as `_master_admin/.ga-creds.json` (gitignored by default).
    7. Copy the service account email (looks like
       master-admin-ga@<project>.iam.gserviceaccount.com).
    8. In Google Analytics → Admin → Property Access Management → Add user →
       paste the service account email, role = Viewer.
    9. Find each GA4 property ID:
       GA → Admin → Property Settings → Property details → Property ID
       (numeric, e.g. 487923610).
   10. In master admin → Sites → Edit each site → paste "GA Property ID".

After step 10, every analytics page in the master admin renders live GA stats
for that site (sessions, users, page views, bounce rate, top pages).

Without credentials, calls return None and the UI shows a friendly "configure GA"
state — nothing breaks.
"""
import os
from datetime import datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent
CRED_FILE = ROOT / '.ga-creds.json'


def _load_client():
    """Lazy-build the GA Data API client. Returns None if not configured."""
    if not CRED_FILE.exists():
        return None
    try:
        # Set env var BEFORE importing google libs — that's how Google auth picks up the creds path
        os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = str(CRED_FILE)
        from google.analytics.data_v1beta import BetaAnalyticsDataClient
        return BetaAnalyticsDataClient()
    except ImportError:
        return None
    except Exception:
        return None


def is_configured():
    return CRED_FILE.exists()


def get_stats(property_id, days=30):
    """Pull GA4 stats for a property. Returns dict or None.

    Output shape:
        {
            'sessions': int,
            'users':    int,
            'page_views': int,
            'bounce_rate': float (0.0 - 1.0),
            'avg_session_duration': float (seconds),
            'top_pages': [{'page': str, 'views': int}, ...],
            'daily':    [{'day': 'YYYY-MM-DD', 'sessions': int, 'users': int}, ...],
            'top_countries': [{'country': str, 'sessions': int}, ...],
            'devices': [{'device': str, 'sessions': int}, ...],
        }
    """
    client = _load_client()
    if not client or not property_id:
        return None

    try:
        from google.analytics.data_v1beta.types import (
            DateRange, Dimension, Metric, RunReportRequest, OrderBy,
        )
    except ImportError:
        return None

    name = f'properties/{property_id}'
    date_range = DateRange(start_date=f'{days}daysAgo', end_date='today')

    def run(dims, mets, order=None, limit=None):
        req_kwargs = dict(
            property=name,
            dimensions=[Dimension(name=d) for d in dims],
            metrics=[Metric(name=m) for m in mets],
            date_ranges=[date_range],
        )
        if order:
            req_kwargs['order_bys'] = order
        if limit:
            req_kwargs['limit'] = limit
        return client.run_report(RunReportRequest(**req_kwargs))

    try:
        # Totals
        totals = run([], ['sessions', 'totalUsers', 'screenPageViews', 'bounceRate', 'averageSessionDuration'])
        row = totals.rows[0] if totals.rows else None
        sessions = int(row.metric_values[0].value) if row else 0
        users = int(row.metric_values[1].value) if row else 0
        page_views = int(row.metric_values[2].value) if row else 0
        bounce_rate = float(row.metric_values[3].value) if row else 0.0
        avg_dur = float(row.metric_values[4].value) if row else 0.0

        # Daily
        daily_rep = run(['date'], ['sessions', 'totalUsers'],
                        order=[OrderBy(dimension={'dimension_name': 'date'})])
        daily = []
        for r in daily_rep.rows:
            d = r.dimension_values[0].value  # YYYYMMDD
            day = f'{d[:4]}-{d[4:6]}-{d[6:]}' if len(d) == 8 else d
            daily.append({
                'day': day,
                'sessions': int(r.metric_values[0].value),
                'users': int(r.metric_values[1].value),
            })

        # Top pages
        pages_rep = run(['pagePath'], ['screenPageViews'],
                        order=[OrderBy(metric={'metric_name': 'screenPageViews'}, desc=True)], limit=10)
        top_pages = [{'page': r.dimension_values[0].value, 'views': int(r.metric_values[0].value)}
                     for r in pages_rep.rows]

        # Top countries
        country_rep = run(['country'], ['sessions'],
                          order=[OrderBy(metric={'metric_name': 'sessions'}, desc=True)], limit=10)
        top_countries = [{'country': r.dimension_values[0].value, 'sessions': int(r.metric_values[0].value)}
                         for r in country_rep.rows]

        # Devices
        dev_rep = run(['deviceCategory'], ['sessions'],
                      order=[OrderBy(metric={'metric_name': 'sessions'}, desc=True)])
        devices = [{'device': r.dimension_values[0].value, 'sessions': int(r.metric_values[0].value)}
                   for r in dev_rep.rows]

        return {
            'sessions': sessions,
            'users': users,
            'page_views': page_views,
            'bounce_rate': bounce_rate,
            'avg_session_duration': avg_dur,
            'top_pages': top_pages,
            'top_countries': top_countries,
            'devices': devices,
            'daily': daily,
        }
    except Exception as e:
        # Return the error so the UI can surface it
        return {'error': str(e)}
