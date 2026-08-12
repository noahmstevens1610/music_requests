"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type NavigationItem = {
  label: string;
  href: string;
  matches: (pathname: string) => boolean;
  opensNewTab?: boolean;
};

const DEFAULT_SLUG = "big-iron";
const SLUG_STORAGE_KEY = "big-iron-admin-event-slug";

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();

  const slugFromDashboard =
    pathname.match(/^\/admin\/([^/]+)$/)?.[1];

  const [slug, setSlug] = useState(DEFAULT_SLUG);

  useEffect(() => {
    if (
      slugFromDashboard &&
      slugFromDashboard !== "login" &&
      slugFromDashboard !== "all-requests" &&
      slugFromDashboard !== "line-dances"
    ) {
      setSlug(slugFromDashboard);
      window.localStorage.setItem(
        SLUG_STORAGE_KEY,
        slugFromDashboard
      );
      return;
    }

    const savedSlug = window.localStorage.getItem(
      SLUG_STORAGE_KEY
    );

    if (savedSlug) {
      setSlug(savedSlug);
    }
  }, [slugFromDashboard]);

  if (pathname === "/admin-login") {
    return children;
  }

  const navigationItems: NavigationItem[] = [
    {
      label: "Requests Dashboard",
      href: "/admin-dashboard",
      matches: (currentPath) =>
        currentPath === "/admin-dashboard",
    },
    {
      label: "All Requests",
      href: `/admin-dashboard/all-requests?event=${encodeURIComponent(slug)}`,
      matches: (currentPath) =>
        currentPath.startsWith("/admin-dashboard/all-requests"),
    },
    {
      label: "Line Dance Manager",
      href: `/admin-dashboard/line-dances?event=${encodeURIComponent(slug)}`,
      matches: (currentPath) =>
        currentPath.startsWith("/admin-dashboard/line-dances"),
    },
    {
      label: "Guest Photos",
      href: "/admin-dashboard/photos",
      matches: (currentPath) =>
        currentPath.startsWith("/admin-dashboard/photos"),
    },
    {
      label: "House Photos",
      href: "/admin-dashboard/house-photos",
      matches: (currentPath) =>
        currentPath.startsWith("/admin-dashboard/house-photos"),
    },
    {
      label: "Now Playing",
      href: "/now-playing",
      matches: () => false,
      opensNewTab: true,
    },
    {
      label: "Request Site",
      href: "/song-requests",
      matches: () => false,
      opensNewTab: true,
    },
  ];

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="sticky top-0 z-50 border-b border-[#c4202f]/45 bg-[#0d0d0d]/95 px-4 py-3 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <Link
            href="/admin-dashboard"
            className="flex items-center gap-3"
          >
            <div className="font-heading flex h-10 w-10 items-center justify-center border border-[#c4202f] bg-black text-xl text-[#c4202f]">
              BI
            </div>

            <div>
              <p className="font-heading text-xl uppercase tracking-[0.08em] leading-tight">
                Big Iron Admin
              </p>

              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/35">
                Music and line dance controls
              </p>
            </div>
          </Link>

          <nav className="flex flex-wrap items-center gap-2">
            {navigationItems.map((item) => {
              const active = item.matches(pathname);

              return (
                <Link
                  key={item.label}
                  href={item.href}
                  target={
                    item.opensNewTab
                      ? "_blank"
                      : undefined
                  }
                  rel={
                    item.opensNewTab
                      ? "noopener noreferrer"
                      : undefined
                  }
                  className={[
                    "font-heading border px-4 py-2 text-sm uppercase tracking-[0.06em] transition",
                    active
                      ? "border-[#c4202f] bg-[#c4202f] text-white"
                      : "border-white/15 bg-black text-white/60 hover:border-[#c4202f]/70 hover:text-white",
                  ].join(" ")}
                >
                  {item.label}

                  {item.opensNewTab && (
                    <span className="ml-2 text-xs opacity-60">
                      ↗
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      {children}
    </div>
  );
}