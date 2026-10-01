"use client";

import { useEffect, useState } from "react";
import { StatCard, StatCardSkeleton } from "@/components/StatCard";

interface Row {
  template_id: string;
  emailed: number;
  returned: number;
  unsubscribed: number;
}

const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : "0%");

export function MarketingEmailReturns() {
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    fetch("/api/marketing/returns")
      .then((r) => r.json())
      .then((d) => setRows(Array.isArray(d) ? d : []))
      .catch(() => setRows([]));
  }, []);

  if (!rows) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
      </div>
    );
  }

  const emailed = rows.reduce((s, r) => s + Number(r.emailed), 0);
  const returned = rows.reduce((s, r) => s + Number(r.returned), 0);
  const unsubscribed = rows.reduce((s, r) => s + Number(r.unsubscribed), 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Emails Sent" value={emailed.toLocaleString()} color="indigo" />
        <StatCard
          title="Came Back"
          value={`${returned} / ${emailed}`}
          subtitle={`${pct(returned, emailed)} signed in or used the site after their email`}
          color="green"
        />
        <StatCard
          title="Unsubscribed"
          value={unsubscribed.toLocaleString()}
          subtitle={`${pct(unsubscribed, emailed)} of emailed users`}
          color="red"
        />
      </div>
      {rows.length > 1 && (
        <div className="bg-gray-50 rounded-xl shadow-md shadow-gray-300/30 p-5 border border-gray-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 text-left">
                <th className="pb-2 font-normal">Email</th>
                <th className="pb-2 font-normal text-right">Sent</th>
                <th className="pb-2 font-normal text-right">Came back</th>
                <th className="pb-2 font-normal text-right">Rate</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.template_id} className="border-t border-gray-200 text-gray-700">
                  <td className="py-2">{r.template_id}</td>
                  <td className="py-2 text-right">{r.emailed}</td>
                  <td className="py-2 text-right">{r.returned}</td>
                  <td className="py-2 text-right">{pct(r.returned, r.emailed)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
