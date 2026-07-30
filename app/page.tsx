import type { Metadata } from "next";
import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  defaultSiteContent,
  normalizeSiteContent,
  type SiteContent,
} from "@/lib/site-content";

export const metadata: Metadata = {
  title: "Big Iron Country Swing",
  description:
    "Country swing dancing, events, song requests, merchandise, and more from Big Iron Country Swing.",
};

export const dynamic = "force-dynamic";

async function getSiteContent(): Promise<SiteContent> {
  try {
    const { data, error } = await supabaseAdmin
      .from("site_content")
      .select("content")
      .eq("id", "homepage")
      .maybeSingle();

    if (error || !data?.content) {
      return defaultSiteContent;
    }

    return normalizeSiteContent(data.content);
  } catch {
    return defaultSiteContent;
  }
}

function ArrowIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  );
}

function StarMark({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 100 100"
      className={className}
      fill="currentColor"
    >
      <path d="M50 2 61 35 96 35 68 56 78 90 50 70 22 90 32 56 4 35 39 35Z" />
    </svg>
  );
}

function isExternalHref(href: string): boolean {
  return /^https?:\/\//i.test(href);
}

function ActionLink({
  href,
  className,
  children,
  external,
}: {
  href: string;
  className: string;
  children: React.ReactNode;
  external?: boolean;
}) {
  const shouldUseAnchor =
    external || isExternalHref(href) || href.startsWith("#");

  if (shouldUseAnchor) {
    return (
      <a
        href={href}
        className={className}
        target={isExternalHref(href) ? "_blank" : undefined}
        rel={isExternalHref(href) ? "noreferrer" : undefined}
      >
        {children}
      </a>
    );
  }

  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}

export default async function HomePage() {
  const site = await getSiteContent();
  const destinations = site.destinations.filter((item) => item.visible);
  const sideLines = site.hero.sideText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  return (
    <main className="min-h-screen overflow-hidden bg-[#0a0a0a] text-[#f6f0e3]">
      <div className="border-b border-white/10 bg-[#0a0a0a]">
        <div className="mx-auto flex min-h-20 max-w-7xl items-center justify-between gap-6 px-5 py-4 sm:px-8 lg:px-10">
          <Link
            href="/"
            className="group inline-flex items-center gap-3"
            aria-label="Big Iron Country Swing home"
          >
            <span className="grid h-10 w-10 place-items-center rounded-full border border-[#c4202f] text-[#c4202f] transition group-hover:bg-[#c4202f] group-hover:text-white">
              <StarMark className="h-4 w-4" />
            </span>

            <span>
              <span className="block text-xs font-black uppercase tracking-[0.24em] text-white/45">
                {site.brand.topLine}
              </span>
              <span className="block text-sm font-black uppercase tracking-[0.08em] text-[#f6f0e3] sm:text-base">
                {site.brand.bottomLine}
              </span>
            </span>
          </Link>

          <nav className="hidden items-center gap-7 text-xs font-black uppercase tracking-[0.16em] text-white/55 md:flex">
            {site.explore.visible ? (
              <a href="#explore" className="transition hover:text-white">
                Explore
              </a>
            ) : null}
            {site.event.visible ? (
              <a href="#events" className="transition hover:text-white">
                Events
              </a>
            ) : null}
            {site.about.visible ? (
              <a href="#about" className="transition hover:text-white">
                About
              </a>
            ) : null}
          </nav>

          <ActionLink
            href={site.hero.primaryButtonHref}
            className="inline-flex items-center gap-2 rounded-full bg-[#c4202f] px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-white transition hover:bg-[#e02a3b] sm:px-5"
          >
            {site.hero.primaryButtonText}
            <ArrowIcon />
          </ActionLink>
        </div>
      </div>

      <section className="relative isolate border-b border-white/10">
        <div className="absolute inset-0 -z-20 bg-[#11100f]" />
        <div
          className="absolute inset-y-0 right-0 -z-10 hidden w-[46%] border-l border-white/10 bg-[#c4202f] bg-cover bg-center lg:block"
          style={
            site.hero.imageUrl
              ? { backgroundImage: `url("${site.hero.imageUrl}")` }
              : undefined
          }
        />
        {site.hero.imageUrl ? (
          <div className="absolute inset-y-0 right-0 -z-[5] hidden w-[46%] bg-black/35 lg:block" />
        ) : (
          <>
            <div className="absolute -right-36 top-1/2 -z-10 hidden h-[560px] w-[560px] -translate-y-1/2 rounded-full border-[90px] border-black/10 lg:block" />
            <div className="absolute right-12 top-10 -z-10 hidden text-black/10 lg:block">
              <StarMark className="h-[430px] w-[430px]" />
            </div>
          </>
        )}

        <div className="mx-auto grid min-h-[calc(100vh-81px)] max-w-7xl items-stretch lg:grid-cols-[1.08fr_0.92fr]">
          <div className="flex items-center px-5 py-20 sm:px-8 lg:px-10 lg:py-24">
            <div className="max-w-4xl">
              <div className="mb-8 flex items-center gap-4">
                <span className="h-px w-12 bg-[#c4202f]" />
                <p className="text-xs font-black uppercase tracking-[0.24em] text-[#d26b75]">
                  {site.brand.location}
                </p>
              </div>

              <h1 className="max-w-5xl text-[clamp(4.2rem,11vw,9.2rem)] font-black uppercase leading-[0.78] tracking-[-0.075em] text-[#f6f0e3]">
                {site.hero.lineOne}
                <span className="mt-3 block text-[#c4202f]">
                  {site.hero.lineTwo}
                </span>
              </h1>

              <p className="mt-10 max-w-2xl text-lg leading-8 text-white/60 sm:text-xl">
                {site.hero.description}
              </p>

              <div className="mt-10 flex flex-col gap-3 sm:flex-row">
                <ActionLink
                  href={site.hero.primaryButtonHref}
                  className="inline-flex min-h-14 items-center justify-center gap-3 rounded-full bg-[#c4202f] px-7 text-sm font-black uppercase tracking-[0.12em] text-white transition hover:-translate-y-0.5 hover:bg-[#e02a3b]"
                >
                  {site.hero.primaryButtonText}
                  <ArrowIcon />
                </ActionLink>

                <ActionLink
                  href={site.hero.secondaryButtonHref || site.shopUrl}
                  external
                  className="inline-flex min-h-14 items-center justify-center gap-3 rounded-full border border-white/20 px-7 text-sm font-black uppercase tracking-[0.12em] text-[#f6f0e3] transition hover:-translate-y-0.5 hover:border-white/50 hover:bg-white/5"
                >
                  {site.hero.secondaryButtonText}
                  <ArrowIcon />
                </ActionLink>
              </div>
            </div>
          </div>

          <div
            className="relative flex min-h-[420px] items-end overflow-hidden bg-[#c4202f] bg-cover bg-center px-5 py-10 sm:px-8 lg:min-h-full lg:bg-transparent lg:px-10 lg:py-14"
            style={
              site.hero.imageUrl
                ? { backgroundImage: `url("${site.hero.imageUrl}")` }
                : undefined
            }
          >
            {site.hero.imageUrl ? (
              <div className="absolute inset-0 bg-black/35 lg:hidden" />
            ) : (
              <div className="absolute inset-0 lg:hidden">
                <div className="absolute -right-28 top-1/2 h-[430px] w-[430px] -translate-y-1/2 rounded-full border-[70px] border-black/10" />
                <StarMark className="absolute right-1 top-8 h-[330px] w-[330px] text-black/10" />
              </div>
            )}

            <div className="relative ml-auto w-full max-w-md border-l border-white/30 pl-6 sm:pl-8">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-white/60">
                {site.hero.sideEyebrow}
              </p>
              <p className="mt-4 text-3xl font-black uppercase leading-tight tracking-[-0.035em] text-white sm:text-4xl">
                {sideLines.map((line, index) => (
                  <span key={`${line}-${index}`} className="block">
                    {line}
                  </span>
                ))}
              </p>
            </div>
          </div>
        </div>
      </section>

      {site.explore.visible ? (
        <section
          id="explore"
          className="scroll-mt-24 border-b border-white/10 bg-[#0a0a0a] px-5 py-20 sm:px-8 lg:px-10 lg:py-28"
        >
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-8 lg:grid-cols-[0.75fr_1.25fr] lg:items-end">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-[#d26b75]">
                  {site.explore.eyebrow}
                </p>
                <h2 className="mt-4 text-5xl font-black uppercase leading-[0.92] tracking-[-0.055em] sm:text-6xl">
                  {site.explore.titleLineOne}
                  <br />
                  {site.explore.titleLineTwo}
                </h2>
              </div>

              <p className="max-w-2xl text-base leading-7 text-white/50 lg:justify-self-end">
                {site.explore.description}
              </p>
            </div>

            <div className="mt-14 grid border-l border-t border-white/10 md:grid-cols-2">
              {destinations.map((item) => {
                const classes =
                  "group relative min-h-[300px] border-b border-r border-white/10 bg-[#0f0f0f] p-7 transition hover:bg-[#151515] sm:p-9";

                return (
                  <ActionLink
                    key={`${item.number}-${item.title}`}
                    href={item.href}
                    external={item.external}
                    className={classes}
                  >
                    <div className="flex items-center justify-between gap-6">
                      <p className="text-xs font-black uppercase tracking-[0.2em] text-[#d26b75]">
                        {item.label}
                      </p>
                      <span className="text-xs font-black tracking-[0.16em] text-white/20">
                        {item.number}
                      </span>
                    </div>

                    <h3 className="mt-16 max-w-md text-3xl font-black uppercase leading-none tracking-[-0.035em] text-[#f6f0e3] sm:text-4xl">
                      {item.title}
                    </h3>

                    <p className="mt-5 max-w-md leading-7 text-white/45">
                      {item.description}
                    </p>

                    <div className="mt-8 inline-flex items-center gap-3 text-xs font-black uppercase tracking-[0.16em] text-white">
                      {item.action}
                      <span className="transition-transform group-hover:translate-x-1">
                        <ArrowIcon />
                      </span>
                    </div>

                    <span className="absolute bottom-0 left-0 h-1 w-0 bg-[#c4202f] transition-all duration-300 group-hover:w-full" />
                  </ActionLink>
                );
              })}
            </div>
          </div>
        </section>
      ) : null}

      {site.event.visible ? (
        <section
          id="events"
          className="scroll-mt-24 border-b border-white/10 bg-[#f1eadc] px-5 py-20 text-[#11100f] sm:px-8 lg:px-10 lg:py-28"
        >
          <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-[#9e1b28]">
                {site.event.eyebrow}
              </p>
              <h2 className="mt-4 text-5xl font-black uppercase leading-[0.9] tracking-[-0.055em] sm:text-7xl">
                {site.event.titleLineOne}
                <br />
                {site.event.titleLineTwo}
              </h2>
            </div>

            <div className="border-y-2 border-[#11100f]">
              <div className="grid gap-6 py-8 sm:grid-cols-[150px_1fr] sm:items-center">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-black/45">
                    {site.event.dateLabel}
                  </p>
                  <p className="mt-2 text-2xl font-black uppercase">
                    {site.event.dateText}
                  </p>
                </div>

                <div className="sm:border-l sm:border-black/20 sm:pl-8">
                  <p className="text-lg font-bold">{site.event.headline}</p>
                  <p className="mt-2 leading-7 text-black/55">
                    {site.event.description}
                  </p>
                  {site.event.buttonText && site.event.buttonHref ? (
                    <ActionLink
                      href={site.event.buttonHref}
                      className="mt-5 inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-[#9e1b28]"
                    >
                      {site.event.buttonText}
                      <ArrowIcon />
                    </ActionLink>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {site.reds.visible ? (
        <section
          id="reds"
          className="scroll-mt-24 border-b border-white/10 bg-[#c4202f] px-5 py-20 sm:px-8 lg:px-10 lg:py-28"
        >
          <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-white/60">
                {site.reds.eyebrow}
              </p>
              <h2 className="mt-4 text-6xl font-black uppercase leading-[0.82] tracking-[-0.065em] text-white sm:text-8xl">
                {site.reds.titleLineOne}
                <br />
                {site.reds.titleLineTwo}
              </h2>
            </div>

            <div className="border-l border-white/30 pl-6 sm:pl-8">
              <p className="text-xl font-bold leading-8 text-white">
                {site.reds.headline}
              </p>
              <p className="mt-4 leading-7 text-white/65">
                {site.reds.description}
              </p>
              {site.reds.buttonText && site.reds.buttonHref ? (
                <ActionLink
                  href={site.reds.buttonHref}
                  className="mt-6 inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-white"
                >
                  {site.reds.buttonText}
                  <ArrowIcon />
                </ActionLink>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      {site.about.visible ? (
        <section
          id="about"
          className="scroll-mt-24 bg-[#0a0a0a] px-5 py-20 sm:px-8 lg:px-10 lg:py-28"
        >
          <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-2 lg:items-center">
            <div
              className="relative min-h-[420px] overflow-hidden border border-white/10 bg-[#11100f] bg-cover bg-center"
              style={
                site.about.imageUrl
                  ? { backgroundImage: `url("${site.about.imageUrl}")` }
                  : undefined
              }
            >
              {site.about.imageUrl ? (
                <div className="absolute inset-0 bg-black/15" />
              ) : (
                <>
                  <div className="absolute inset-8 border border-white/10" />
                  <div className="absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full border-[48px] border-[#c4202f]" />
                  <StarMark className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 text-[#f6f0e3]" />
                </>
              )}
            </div>

            <div className="lg:pl-10">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-[#d26b75]">
                {site.about.eyebrow}
              </p>
              <h2 className="mt-4 text-5xl font-black uppercase leading-[0.92] tracking-[-0.055em] sm:text-6xl">
                {site.about.titleLineOne}
                <br />
                {site.about.titleLineTwo}
              </h2>
              <p className="mt-8 max-w-xl text-lg leading-8 text-white/55">
                {site.about.description}
              </p>
            </div>
          </div>
        </section>
      ) : null}

      <footer className="border-t border-white/10 bg-black px-5 py-8 sm:px-8 lg:px-10">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 text-sm text-white/40 sm:flex-row sm:items-center sm:justify-between">
          <p>{site.footer.copyright}</p>

          <div className="flex flex-wrap items-center gap-5">
            <ActionLink
              href={site.hero.primaryButtonHref}
              className="transition hover:text-white"
            >
              Song Requests
            </ActionLink>
            <a
              href={site.shopUrl}
              target="_blank"
              rel="noreferrer"
              className="transition hover:text-white"
            >
              Store
            </a>
            {site.footer.instagramUrl ? (
              <a
                href={site.footer.instagramUrl}
                target="_blank"
                rel="noreferrer"
                className="transition hover:text-white"
              >
                Instagram
              </a>
            ) : null}
            {site.footer.contactEmail ? (
              <a
                href={`mailto:${site.footer.contactEmail}`}
                className="transition hover:text-white"
              >
                Contact
              </a>
            ) : null}
            {site.footer.showAdminLink ? (
              <Link
                href="/admin/site-editor"
                className="transition hover:text-white"
              >
                Site Editor
              </Link>
            ) : null}
          </div>
        </div>
      </footer>
    </main>
  );
}
