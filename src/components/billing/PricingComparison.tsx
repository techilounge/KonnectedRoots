// components/billing/PricingComparison.tsx
"use client";
import React, { useEffect, useRef, useState } from "react";

type Row = {
    platform: string;
    bestFor: string;
    startingPaid: string;
    freeTreeSize: string;
    collaboration: string;
    portability: string;
    aiAssist: string;
    whyKR: string[]; // checkmarked reasons to choose KonnectedRoots vs this option
    note?: string;
    highlight?: boolean;
};

const KR_WINS = {
    value: "Lower cost for tree-building (not a records subscription)",
    private: "Private workspace + controlled sharing",
    roles: "Role-based collaboration (Viewer/Editor/Manager)",
    freeLimit: "Generous free tier (3 trees, 500 people/tree)",
    gedcom: "GEDCOM import + export (Pro/Family)",
    ai: "AI assist with predictable monthly credits",
    family: "Family plan (up to 6 seats) built for shared ownership",
    exports: "Easy exports (PNG/PDF; watermark removed on paid)",
};

const rows: Row[] = [
    {
        platform: "KonnectedRoots",
        bestFor: "Private family trees + collaboration + exports + AI assist",
        startingPaid: "$5.99/mo (Pro) • $9.99/mo (Family)",
        freeTreeSize: "3 trees • 500 people/tree",
        collaboration: "Role-based (Viewer/Editor/Manager) • Family seats (up to 6)",
        portability: "GEDCOM import + export (Pro/Family) • PNG/PDF exports",
        aiAssist: "Yes (monthly credits + optional AI Pack)",
        whyKR: [
            "Best value for building together",
            "Private workspace with roles + exports + AI",
            "Upgrade only when you outgrow free limits",
        ],
        highlight: true,
        note: "Built for building together — not selling expensive record-library bundles.",
    },
    {
        platform: "Ancestry",
        bestFor: "Historical records research + hints",
        startingPaid: "Typically $24.99+/mo (varies by plan & promos)",
        freeTreeSize: "Start a tree free (limits vary)",
        collaboration: "Sharing available (not positioned as role-based teamwork)",
        portability: "GEDCOM upload/download supported",
        aiAssist: "Not the core value (varies)",
        whyKR: [KR_WINS.value, KR_WINS.roles, KR_WINS.freeLimit, KR_WINS.ai],
    },
    {
        platform: "MyHeritage",
        bestFor: "Records + matching + DNA + photo tools",
        startingPaid: "Often $199–$399/yr depending on package/promos",
        freeTreeSize: "Free plan exists (often capped)",
        collaboration: "Sharing available (not collaboration-first positioning)",
        portability: "GEDCOM supported",
        aiAssist: "Some AI/photo tools (varies by plan)",
        whyKR: [KR_WINS.value, KR_WINS.private, KR_WINS.roles, KR_WINS.family, KR_WINS.gedcom],
    },
    {
        platform: "Findmypast",
        bestFor: "Records-first research (strong UK/Irish coverage)",
        startingPaid: "Often $25+/mo equivalent (varies by billing)",
        freeTreeSize: "Some free access; full features typically paid",
        collaboration: "Not positioned as collaboration-first",
        portability: "Not emphasized on pricing pages",
        aiAssist: "Not the core value",
        whyKR: [KR_WINS.value, KR_WINS.private, KR_WINS.roles, KR_WINS.exports, KR_WINS.ai],
    },
    {
        platform: "Geni",
        bestFor: "Global 'world tree' collaboration + matching",
        startingPaid: "$149/yr (Pro)",
        freeTreeSize: "Free tier available",
        collaboration: "World tree collaboration (not a private workspace model)",
        portability: "GEDCOM support available",
        aiAssist: "Not the core value",
        whyKR: [KR_WINS.private, KR_WINS.roles, KR_WINS.family, KR_WINS.ai],
    },
    {
        platform: "FamilySearch / WikiTree",
        bestFor: "Free community trees + community-driven research",
        startingPaid: "Free",
        freeTreeSize: "Unlimited (community/global tree model)",
        collaboration: "Community collaboration (not private roles)",
        portability: "Varies (not always export-focused)",
        aiAssist: "Not the core value",
        whyKR: [KR_WINS.private, KR_WINS.roles, KR_WINS.exports, KR_WINS.ai],
    },
];

function Badge({ children }: { children: React.ReactNode }) {
    return (
        <span className="inline-flex items-center rounded-full border border-zinc-200 bg-white px-2 py-0.5 text-xs font-medium text-zinc-700">
            {children}
        </span>
    );
}

function CheckList({ items }: { items: string[] }) {
    return (
        <ul className="space-y-1">
            {items.map((t, i) => (
                <li key={`${t}-${i}`} className="flex items-start gap-2 text-zinc-700">
                    <span className="mt-0.5 inline-flex h-4 w-4 flex-none items-center justify-center rounded-full bg-green-600 text-[10px] leading-none text-white">
                        ✓
                    </span>
                    <span className="text-sm">{t}</span>
                </li>
            ))}
        </ul>
    );
}

export default function PricingComparison() {
    return (
        <section className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
            {/* Header */}
            <div className="mb-6">
                <h2 className="text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">
                    Compare genealogy apps at a glance
                </h2>
                <p className="mt-2 max-w-3xl text-sm text-zinc-600 sm:text-base">
                    KonnectedRoots is built for{" "}
                    <span className="font-medium text-zinc-900">building and collaborating</span> on a private family tree —
                    without paying record-library subscription prices.
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                    <Badge>Best value for families</Badge>
                    <Badge>Role-based collaboration</Badge>
                    <Badge>GEDCOM portability</Badge>
                    <Badge>AI assist (credit-based)</Badge>
                </div>
            </div>

            {/* Mobile cards */}
            <div className="grid gap-4 lg:hidden">
                {rows.map((r, idx) => (
                    <div
                        key={r.platform}
                        className={[
                            "rounded-2xl border p-4 shadow-sm transition-all duration-500 ease-out",
                            "opacity-0 translate-y-4 animate-[fadeSlideIn_0.5s_ease-out_forwards]",
                            r.highlight ? "border-zinc-900 bg-zinc-50" : "border-zinc-200 bg-white",
                        ].join(" ")}
                        style={{ animationDelay: `${idx * 100}ms` }}
                    >
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <div className="text-base font-semibold text-zinc-900">{r.platform}</div>
                                <div className="mt-1 text-sm text-zinc-600">{r.bestFor}</div>
                            </div>
                            {r.highlight && <Badge>Recommended</Badge>}
                        </div>

                        <dl className="mt-4 grid gap-3 text-sm">
                            <div>
                                <dt className="font-medium text-zinc-900">Starting paid</dt>
                                <dd className="text-zinc-700">{r.startingPaid}</dd>
                            </div>
                            <div>
                                <dt className="font-medium text-zinc-900">Free tree size</dt>
                                <dd className="text-zinc-700">{r.freeTreeSize}</dd>
                            </div>
                            <div>
                                <dt className="font-medium text-zinc-900">Collaboration</dt>
                                <dd className="text-zinc-700">{r.collaboration}</dd>
                            </div>
                            <div>
                                <dt className="font-medium text-zinc-900">Portability</dt>
                                <dd className="text-zinc-700">{r.portability}</dd>
                            </div>
                            <div>
                                <dt className="font-medium text-zinc-900">AI assist</dt>
                                <dd className="text-zinc-700">{r.aiAssist}</dd>
                            </div>
                        </dl>

                        <div className="mt-4 rounded-xl bg-white p-3 ring-1 ring-zinc-200">
                            <div className="mb-2 text-sm font-medium text-zinc-900">Why KonnectedRoots</div>
                            <CheckList items={r.whyKR} />
                        </div>

                        {r.note && (
                            <p className="mt-3 text-sm text-zinc-700">
                                <span className="font-medium text-zinc-900">Note:</span> {r.note}
                            </p>
                        )}
                    </div>
                ))}
            </div>

            {/* Desktop table */}
            <div className="hidden lg:block">
                <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white shadow-sm">
                    <table className="w-full border-collapse text-left text-sm">
                        <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-600">
                            <tr>
                                <th className="px-4 py-3">Platform</th>
                                <th className="px-4 py-3">Starting paid</th>
                                <th className="px-4 py-3">Free tree size</th>
                                <th className="px-4 py-3">Collaboration</th>
                                <th className="px-4 py-3">GEDCOM / portability</th>
                                <th className="px-4 py-3">AI assist</th>
                                <th className="px-4 py-3">Why KonnectedRoots</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((r, idx) => (
                                <tr
                                    key={r.platform}
                                    className={[
                                        "border-t border-zinc-100 transition-all duration-500 ease-out",
                                        "opacity-0 translate-y-2 animate-[fadeSlideIn_0.5s_ease-out_forwards]",
                                        r.highlight ? "bg-zinc-50" : "bg-white",
                                    ].join(" ")}
                                    style={{ animationDelay: `${idx * 100}ms` }}
                                >
                                    <td className="px-4 py-4 align-top">
                                        <div className="flex items-center gap-2">
                                            <span className="font-semibold text-zinc-900">{r.platform}</span>
                                            {r.highlight && <Badge>Recommended</Badge>}
                                        </div>
                                        <div className="mt-1 text-xs text-zinc-600">{r.bestFor}</div>
                                        {r.note && (
                                            <div className="mt-2 text-xs text-zinc-700">
                                                <span className="font-medium text-zinc-900">Note:</span> {r.note}
                                            </div>
                                        )}
                                    </td>

                                    <td className="px-4 py-4 align-top text-zinc-700">{r.startingPaid}</td>
                                    <td className="px-4 py-4 align-top text-zinc-700">{r.freeTreeSize}</td>
                                    <td className="px-4 py-4 align-top text-zinc-700">{r.collaboration}</td>
                                    <td className="px-4 py-4 align-top text-zinc-700">{r.portability}</td>
                                    <td className="px-4 py-4 align-top text-zinc-700">{r.aiAssist}</td>

                                    <td className="px-4 py-4 align-top">
                                        <CheckList items={r.whyKR} />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <p className="mt-3 text-xs text-zinc-500">
                    Competitor pricing/features change often. Values shown are typical ranges and public list prices/promos.
                </p>
            </div>

            {/* CTA */}
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <div className="text-sm font-medium text-zinc-900">Best starting point:</div>
                    <div className="text-sm text-zinc-600">
                        Start free (3 trees, 500 people/tree). Upgrade only when you need unlimited growth + GEDCOM + roles.
                    </div>
                </div>
                <div className="flex gap-3">
                    <a
                        href="/signup"
                        className="inline-flex items-center justify-center rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-zinc-800"
                    >
                        Start Free
                    </a>
                    <a
                        href="/pricing"
                        className="inline-flex items-center justify-center rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-900 shadow-sm hover:bg-zinc-50"
                    >
                        View Pricing
                    </a>
                </div>
            </div>
        </section>
    );
}
