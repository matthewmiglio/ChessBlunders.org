"use client";

import { useEffect, useState } from "react";

interface CountryData {
  country: string;
  views: number;
}

const COUNTRY_FLAGS: Record<string, string> = {
  US: "US",
  GB: "GB",
  DE: "DE",
  FR: "FR",
  CA: "CA",
  AU: "AU",
  NL: "NL",
  SE: "SE",
  ES: "ES",
  IT: "IT",
  JP: "JP",
  BR: "BR",
  IN: "IN",
  PL: "PL",
  RU: "RU",
};

export function TopCountriesChart() {
  const [data, setData] = useState<CountryData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const res = await fetch("/api/analytics/countries");
      const json = await res.json();
      setData(json.slice(0, 10));
      setLoading(false);
    }
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 animate-pulse">
        <div className="h-4 bg-gray-700 rounded w-1/3 mb-4"></div>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-6 bg-gray-800 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  const maxViews = Math.max(...data.map((c) => c.views), 1);

  return (
    <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
      <h3 className="text-sm font-bold text-gray-100 mb-4">Top Countries</h3>
      <div className="space-y-3">
        {data.map((country) => (
          <div key={country.country} className="flex items-center gap-3">
            <span className="text-xs text-gray-400 w-20">
              {COUNTRY_FLAGS[country.country] || country.country || "Unknown"}
            </span>
            <div className="flex-1 h-6 bg-gray-800 rounded overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded"
                style={{ width: `${(country.views / maxViews) * 100}%` }}
              />
            </div>
            <span className="text-xs font-medium text-gray-400 w-12 text-right">
              {country.views.toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
