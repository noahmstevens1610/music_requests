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

  if (pathname === "/admin/login") {
    return children;
  }

  const navigationItems: NavigationItem[] = [
    {
      label: "Requests Dashboard",
      href: `/admin/${slug}`,
      matches: (currentPath) =>
        currentPath === `/admin/${slug}`,
    },
    {
      label: "All Requests",
      href: `/admin/all-requests?event=${encodeURIComponent(
        slug
      )}`,
      matches: (currentPath) =>
        currentPath.startsWith("/admin/all-requests"),
    },
    {
      label: "Line Dance Manager",
      href: `/admin/line-dances?event=${encodeURIComponent(
        slug
      )}`,
      matches: (currentPath) =>
        currentPath.startsWith("/admin/line-dances"),
    },
    {
      label: "Now Playing",
      href: `/now-playing/${slug}`,
      matches: () => false,
      opensNewTab: true,
    },
    {
      label: "Request Site",
      href: `/request/${slug}`,
      matches: () => false,
      opensNewTab: true,
    },
  ];

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-black/90 px-4 py-3 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <Link
            href={`/admin/${slug}`}
            className="flex items-center gap-3"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white font-black text-black">
              BI
            </div>

            <div>
              <p className="font-bold leading-tight">
                Big Iron Admin
              </p>

              <p className="text-xs text-neutral-400">
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
                    "rounded-xl px-4 py-2 text-sm font-semibold transition",
                    active
                      ? "bg-white text-black"
                      : "bg-neutral-900 text-neutral-300 hover:bg-neutral-800 hover:text-white",
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