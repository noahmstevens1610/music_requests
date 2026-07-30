"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  defaultSiteContent,
  type DestinationCard,
  type SiteContent,
} from "@/lib/site-content";

type SectionKey =
  | "brand"
  | "hero"
  | "explore"
  | "event"
  | "reds"
  | "about"
  | "footer";

const inputClass =
  "mt-2 w-full rounded-xl border border-white/15 bg-black/30 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-[#c4202f]";
const labelClass =
  "block text-xs font-black uppercase tracking-[0.14em] text-white/55";
const panelClass =
  "rounded-2xl border border-white/10 bg-[#111] p-5 sm:p-7";

function Field({
  label,
  value,
  onChange,
  multiline = false,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  placeholder?: string;
}) {
  return (
    <label className={labelClass}>
      {label}
      {multiline ? (
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          rows={4}
          className={`${inputClass} resize-y normal-case tracking-normal`}
        />
      ) : (
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className={`${inputClass} normal-case tracking-normal`}
        />
      )}
    </label>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3 text-sm font-bold text-white/75">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-5 w-5 accent-[#c4202f]"
      />
      {label}
    </label>
  );
}

export default function SiteEditorPage() {
  const [content, setContent] =
    useState<SiteContent>(defaultSiteContent);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  useEffect(() => {
    async function loadContent() {
      try {
        const response = await fetch("/api/admin/site-content", {
          cache: "no-store",
        });

        if (response.status === 401) {
          window.location.href =
            "/admin/login?next=%2Fadmin%2Fsite-editor";
          return;
        }

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error ?? "Unable to load website content.");
        }

        setContent(data.content);
        setUpdatedAt(data.updatedAt);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load website content."
        );
      } finally {
        setLoading(false);
      }
    }

    void loadContent();
  }, []);

  function updateSection<K extends SectionKey>(
    section: K,
    values: Partial<SiteContent[K]>
  ) {
    setContent((current) => ({
      ...current,
      [section]: {
        ...current[section],
        ...values,
      },
    }));
  }

  function updateDestination(
    index: number,
    values: Partial<DestinationCard>
  ) {
    setContent((current) => ({
      ...current,
      destinations: current.destinations.map((destination, destinationIndex) =>
        destinationIndex === index
          ? { ...destination, ...values }
          : destination
      ),
    }));
  }

  async function saveContent() {
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/admin/site-content", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content }),
      });

      if (response.status === 401) {
        window.location.href =
          "/admin/login?next=%2Fadmin%2Fsite-editor";
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Unable to save website.");
      }

      setContent(data.content);
      setUpdatedAt(data.updatedAt);
      setMessage("Website saved. The public homepage is now updated.");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save website."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#090909] text-white">
        <p className="text-sm font-black uppercase tracking-[0.18em] text-white/50">
          Loading site editor…
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#090909] px-4 py-8 text-white sm:px-7 lg:px-10">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 flex flex-col gap-5 border-b border-white/10 pb-7 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#d26b75]">
              Big Iron Admin
            </p>
            <h1 className="mt-2 text-4xl font-black uppercase tracking-[-0.04em] sm:text-5xl">
              Website Editor
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/45">
              Change the public homepage here. Press Save Website when you are
              finished—no code or redeployment is needed.
            </p>
          </div>

          <div className="flex gap-3">
            <Link
              href="/"
              target="_blank"
              className="inline-flex min-h-11 items-center rounded-full border border-white/20 px-5 text-xs font-black uppercase tracking-[0.12em] transition hover:bg-white/5"
            >
              Preview site
            </Link>
            <button
              type="button"
              onClick={saveContent}
              disabled={saving}
              className="inline-flex min-h-11 items-center rounded-full bg-[#c4202f] px-5 text-xs font-black uppercase tracking-[0.12em] transition hover:bg-[#e02a3b] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save website"}
            </button>
          </div>
        </header>

        {error ? (
          <div className="mb-6 rounded-xl border border-red-500/35 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {error}
          </div>
        ) : null}

        {message ? (
          <div className="mb-6 rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-100">
            {message}
          </div>
        ) : null}

        {updatedAt ? (
          <p className="mb-6 text-xs text-white/35">
            Last saved: {new Date(updatedAt).toLocaleString()}
          </p>
        ) : null}

        <div className="space-y-5">
          <details open className={panelClass}>
            <summary className="cursor-pointer text-xl font-black uppercase">
              Brand and links
            </summary>
            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <Field
                label="Small brand line"
                value={content.brand.topLine}
                onChange={(topLine) =>
                  updateSection("brand", { topLine })
                }
              />
              <Field
                label="Main brand line"
                value={content.brand.bottomLine}
                onChange={(bottomLine) =>
                  updateSection("brand", { bottomLine })
                }
              />
              <Field
                label="Location"
                value={content.brand.location}
                onChange={(location) =>
                  updateSection("brand", { location })
                }
              />
              <Field
                label="Shop URL"
                value={content.shopUrl}
                onChange={(shopUrl) =>
                  setContent((current) => ({ ...current, shopUrl }))
                }
              />
            </div>
          </details>

          <details open className={panelClass}>
            <summary className="cursor-pointer text-xl font-black uppercase">
              Hero
            </summary>
            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <Field
                label="Title line one"
                value={content.hero.lineOne}
                onChange={(lineOne) =>
                  updateSection("hero", { lineOne })
                }
              />
              <Field
                label="Title line two"
                value={content.hero.lineTwo}
                onChange={(lineTwo) =>
                  updateSection("hero", { lineTwo })
                }
              />
              <div className="sm:col-span-2">
                <Field
                  label="Description"
                  value={content.hero.description}
                  onChange={(description) =>
                    updateSection("hero", { description })
                  }
                  multiline
                />
              </div>
              <Field
                label="Primary button text"
                value={content.hero.primaryButtonText}
                onChange={(primaryButtonText) =>
                  updateSection("hero", { primaryButtonText })
                }
              />
              <Field
                label="Primary button link"
                value={content.hero.primaryButtonHref}
                onChange={(primaryButtonHref) =>
                  updateSection("hero", { primaryButtonHref })
                }
              />
              <Field
                label="Secondary button text"
                value={content.hero.secondaryButtonText}
                onChange={(secondaryButtonText) =>
                  updateSection("hero", { secondaryButtonText })
                }
              />
              <Field
                label="Secondary button link"
                value={content.hero.secondaryButtonHref}
                onChange={(secondaryButtonHref) =>
                  updateSection("hero", { secondaryButtonHref })
                }
              />
              <Field
                label="Right-side small heading"
                value={content.hero.sideEyebrow}
                onChange={(sideEyebrow) =>
                  updateSection("hero", { sideEyebrow })
                }
              />
              <Field
                label="Hero image URL (optional)"
                value={content.hero.imageUrl}
                onChange={(imageUrl) =>
                  updateSection("hero", { imageUrl })
                }
                placeholder="https://..."
              />
              <div className="sm:col-span-2">
                <Field
                  label="Right-side message (one line per row)"
                  value={content.hero.sideText}
                  onChange={(sideText) =>
                    updateSection("hero", { sideText })
                  }
                  multiline
                />
              </div>
            </div>
          </details>

          <details className={panelClass}>
            <summary className="cursor-pointer text-xl font-black uppercase">
              Explore heading
            </summary>
            <div className="mt-6 space-y-5">
              <Toggle
                label="Show this section"
                checked={content.explore.visible}
                onChange={(visible) =>
                  updateSection("explore", { visible })
                }
              />
              <div className="grid gap-5 sm:grid-cols-2">
                <Field
                  label="Small heading"
                  value={content.explore.eyebrow}
                  onChange={(eyebrow) =>
                    updateSection("explore", { eyebrow })
                  }
                />
                <div />
                <Field
                  label="Title line one"
                  value={content.explore.titleLineOne}
                  onChange={(titleLineOne) =>
                    updateSection("explore", { titleLineOne })
                  }
                />
                <Field
                  label="Title line two"
                  value={content.explore.titleLineTwo}
                  onChange={(titleLineTwo) =>
                    updateSection("explore", { titleLineTwo })
                  }
                />
                <div className="sm:col-span-2">
                  <Field
                    label="Description"
                    value={content.explore.description}
                    onChange={(description) =>
                      updateSection("explore", { description })
                    }
                    multiline
                  />
                </div>
              </div>
            </div>
          </details>

          <details className={panelClass}>
            <summary className="cursor-pointer text-xl font-black uppercase">
              Destination cards
            </summary>
            <div className="mt-6 space-y-5">
              {content.destinations.map((destination, index) => (
                <div
                  key={destination.number}
                  className="rounded-xl border border-white/10 bg-black/25 p-5"
                >
                  <div className="mb-5 flex items-center justify-between">
                    <h2 className="font-black uppercase">
                      Card {index + 1}
                    </h2>
                    <Toggle
                      label="Visible"
                      checked={destination.visible}
                      onChange={(visible) =>
                        updateDestination(index, { visible })
                      }
                    />
                  </div>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <Field
                      label="Small label"
                      value={destination.label}
                      onChange={(label) =>
                        updateDestination(index, { label })
                      }
                    />
                    <Field
                      label="Number"
                      value={destination.number}
                      onChange={(number) =>
                        updateDestination(index, { number })
                      }
                    />
                    <Field
                      label="Title"
                      value={destination.title}
                      onChange={(title) =>
                        updateDestination(index, { title })
                      }
                    />
                    <Field
                      label="Button text"
                      value={destination.action}
                      onChange={(action) =>
                        updateDestination(index, { action })
                      }
                    />
                    <div className="sm:col-span-2">
                      <Field
                        label="Description"
                        value={destination.description}
                        onChange={(description) =>
                          updateDestination(index, { description })
                        }
                        multiline
                      />
                    </div>
                    <Field
                      label="Link"
                      value={destination.href}
                      onChange={(href) =>
                        updateDestination(index, { href })
                      }
                    />
                    <div className="flex items-end pb-3">
                      <Toggle
                        label="Open as an external link"
                        checked={destination.external}
                        onChange={(external) =>
                          updateDestination(index, { external })
                        }
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </details>

          <details className={panelClass}>
            <summary className="cursor-pointer text-xl font-black uppercase">
              Upcoming event
            </summary>
            <div className="mt-6 space-y-5">
              <Toggle
                label="Show this section"
                checked={content.event.visible}
                onChange={(visible) =>
                  updateSection("event", { visible })
                }
              />
              <div className="grid gap-5 sm:grid-cols-2">
                <Field
                  label="Small heading"
                  value={content.event.eyebrow}
                  onChange={(eyebrow) =>
                    updateSection("event", { eyebrow })
                  }
                />
                <Field
                  label="Date label"
                  value={content.event.dateLabel}
                  onChange={(dateLabel) =>
                    updateSection("event", { dateLabel })
                  }
                />
                <Field
                  label="Title line one"
                  value={content.event.titleLineOne}
                  onChange={(titleLineOne) =>
                    updateSection("event", { titleLineOne })
                  }
                />
                <Field
                  label="Title line two"
                  value={content.event.titleLineTwo}
                  onChange={(titleLineTwo) =>
                    updateSection("event", { titleLineTwo })
                  }
                />
                <Field
                  label="Date / status"
                  value={content.event.dateText}
                  onChange={(dateText) =>
                    updateSection("event", { dateText })
                  }
                />
                <Field
                  label="Headline"
                  value={content.event.headline}
                  onChange={(headline) =>
                    updateSection("event", { headline })
                  }
                />
                <div className="sm:col-span-2">
                  <Field
                    label="Event details"
                    value={content.event.description}
                    onChange={(description) =>
                      updateSection("event", { description })
                    }
                    multiline
                  />
                </div>
                <Field
                  label="Optional button text"
                  value={content.event.buttonText}
                  onChange={(buttonText) =>
                    updateSection("event", { buttonText })
                  }
                />
                <Field
                  label="Optional button link"
                  value={content.event.buttonHref}
                  onChange={(buttonHref) =>
                    updateSection("event", { buttonHref })
                  }
                />
              </div>
            </div>
          </details>

          <details className={panelClass}>
            <summary className="cursor-pointer text-xl font-black uppercase">
              Big Iron Reds
            </summary>
            <div className="mt-6 space-y-5">
              <Toggle
                label="Show this section"
                checked={content.reds.visible}
                onChange={(visible) =>
                  updateSection("reds", { visible })
                }
              />
              <div className="grid gap-5 sm:grid-cols-2">
                <Field
                  label="Small heading"
                  value={content.reds.eyebrow}
                  onChange={(eyebrow) =>
                    updateSection("reds", { eyebrow })
                  }
                />
                <div />
                <Field
                  label="Title line one"
                  value={content.reds.titleLineOne}
                  onChange={(titleLineOne) =>
                    updateSection("reds", { titleLineOne })
                  }
                />
                <Field
                  label="Title line two"
                  value={content.reds.titleLineTwo}
                  onChange={(titleLineTwo) =>
                    updateSection("reds", { titleLineTwo })
                  }
                />
                <div className="sm:col-span-2">
                  <Field
                    label="Headline"
                    value={content.reds.headline}
                    onChange={(headline) =>
                      updateSection("reds", { headline })
                    }
                  />
                </div>
                <div className="sm:col-span-2">
                  <Field
                    label="Description"
                    value={content.reds.description}
                    onChange={(description) =>
                      updateSection("reds", { description })
                    }
                    multiline
                  />
                </div>
                <Field
                  label="Optional button text"
                  value={content.reds.buttonText}
                  onChange={(buttonText) =>
                    updateSection("reds", { buttonText })
                  }
                />
                <Field
                  label="Optional button link"
                  value={content.reds.buttonHref}
                  onChange={(buttonHref) =>
                    updateSection("reds", { buttonHref })
                  }
                />
              </div>
            </div>
          </details>

          <details className={panelClass}>
            <summary className="cursor-pointer text-xl font-black uppercase">
              About
            </summary>
            <div className="mt-6 space-y-5">
              <Toggle
                label="Show this section"
                checked={content.about.visible}
                onChange={(visible) =>
                  updateSection("about", { visible })
                }
              />
              <div className="grid gap-5 sm:grid-cols-2">
                <Field
                  label="Small heading"
                  value={content.about.eyebrow}
                  onChange={(eyebrow) =>
                    updateSection("about", { eyebrow })
                  }
                />
                <Field
                  label="Image URL (optional)"
                  value={content.about.imageUrl}
                  onChange={(imageUrl) =>
                    updateSection("about", { imageUrl })
                  }
                  placeholder="https://..."
                />
                <Field
                  label="Title line one"
                  value={content.about.titleLineOne}
                  onChange={(titleLineOne) =>
                    updateSection("about", { titleLineOne })
                  }
                />
                <Field
                  label="Title line two"
                  value={content.about.titleLineTwo}
                  onChange={(titleLineTwo) =>
                    updateSection("about", { titleLineTwo })
                  }
                />
                <div className="sm:col-span-2">
                  <Field
                    label="Description"
                    value={content.about.description}
                    onChange={(description) =>
                      updateSection("about", { description })
                    }
                    multiline
                  />
                </div>
              </div>
            </div>
          </details>

          <details className={panelClass}>
            <summary className="cursor-pointer text-xl font-black uppercase">
              Footer
            </summary>
            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <Field
                label="Copyright"
                value={content.footer.copyright}
                onChange={(copyright) =>
                  updateSection("footer", { copyright })
                }
              />
              <Field
                label="Instagram URL (optional)"
                value={content.footer.instagramUrl}
                onChange={(instagramUrl) =>
                  updateSection("footer", { instagramUrl })
                }
              />
              <Field
                label="Contact email (optional)"
                value={content.footer.contactEmail}
                onChange={(contactEmail) =>
                  updateSection("footer", { contactEmail })
                }
              />
              <div className="flex items-end pb-3">
                <Toggle
                  label="Show site-editor link in footer"
                  checked={content.footer.showAdminLink}
                  onChange={(showAdminLink) =>
                    updateSection("footer", { showAdminLink })
                  }
                />
              </div>
            </div>
          </details>
        </div>

        <div className="sticky bottom-4 mt-8 flex justify-end">
          <button
            type="button"
            onClick={saveContent}
            disabled={saving}
            className="min-h-14 rounded-full bg-[#c4202f] px-8 text-sm font-black uppercase tracking-[0.12em] text-white shadow-2xl transition hover:bg-[#e02a3b] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save website"}
          </button>
        </div>
      </div>
    </main>
  );
}
