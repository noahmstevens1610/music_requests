export type DestinationCard = {
  label: string;
  title: string;
  description: string;
  href: string;
  external: boolean;
  action: string;
  number: string;
  visible: boolean;
};

export type SiteContent = {
  brand: {
    topLine: string;
    bottomLine: string;
    location: string;
  };
  shopUrl: string;
  hero: {
    lineOne: string;
    lineTwo: string;
    description: string;
    primaryButtonText: string;
    primaryButtonHref: string;
    secondaryButtonText: string;
    secondaryButtonHref: string;
    sideEyebrow: string;
    sideText: string;
    imageUrl: string;
  };
  explore: {
    visible: boolean;
    eyebrow: string;
    titleLineOne: string;
    titleLineTwo: string;
    description: string;
  };
  destinations: DestinationCard[];
  event: {
    visible: boolean;
    eyebrow: string;
    titleLineOne: string;
    titleLineTwo: string;
    dateLabel: string;
    dateText: string;
    headline: string;
    description: string;
    buttonText: string;
    buttonHref: string;
  };
  reds: {
    visible: boolean;
    eyebrow: string;
    titleLineOne: string;
    titleLineTwo: string;
    headline: string;
    description: string;
    buttonText: string;
    buttonHref: string;
  };
  about: {
    visible: boolean;
    eyebrow: string;
    titleLineOne: string;
    titleLineTwo: string;
    description: string;
    imageUrl: string;
  };
  footer: {
    copyright: string;
    instagramUrl: string;
    contactEmail: string;
    showAdminLink: boolean;
  };
};

export const defaultSiteContent: SiteContent = {
  brand: {
    topLine: "Big Iron",
    bottomLine: "Country Swing",
    location: "Cedar City, Utah",
  },
  shopUrl: "https://shop.bigironswing.com",
  hero: {
    lineOne: "Big Iron",
    lineTwo: "Country Swing",
    description:
      "Country swing dancing, beginner-friendly lessons, community events, song requests, and western merchandise—all in one place.",
    primaryButtonText: "Request a song",
    primaryButtonHref: "/song-requests",
    secondaryButtonText: "Shop merchandise",
    secondaryButtonHref: "https://shop.bigironswing.com",
    sideEyebrow: "Built for the dance floor",
    sideText: "Come as you are.\nLearn something new.\nStay for the people.",
    imageUrl: "",
  },
  explore: {
    visible: true,
    eyebrow: "Everything Big Iron",
    titleLineOne: "Pick your",
    titleLineTwo: "next stop.",
    description:
      "This is the central home for Big Iron Country Swing. The website, request system, events, team, and official store can all live under the same brand without replacing the tools you already use.",
  },
  destinations: [
    {
      label: "Song Requests",
      title: "Request the next song",
      description:
        "Search the catalog, submit a swing song or line dance, and vote on what should play next.",
      href: "/song-requests",
      external: false,
      action: "Open requests",
      number: "01",
      visible: true,
    },
    {
      label: "Official Store",
      title: "Shop Big Iron",
      description:
        "Western apparel and merchandise from Big Iron Country Swing, fulfilled through our official shop.",
      href: "https://shop.bigironswing.com",
      external: true,
      action: "Visit the store",
      number: "02",
      visible: true,
    },
    {
      label: "Dance With Us",
      title: "Upcoming events",
      description:
        "Find the next dance, beginner lesson, special event, and Big Iron gathering.",
      href: "#events",
      external: false,
      action: "See what’s next",
      number: "03",
      visible: true,
    },
    {
      label: "Our Community",
      title: "Big Iron Reds",
      description:
        "Meet the performance team and follow what the Reds are doing next.",
      href: "#reds",
      external: false,
      action: "Meet the Reds",
      number: "04",
      visible: true,
    },
  ],
  event: {
    visible: true,
    eyebrow: "Dance with us",
    titleLineOne: "Upcoming",
    titleLineTwo: "events.",
    dateLabel: "Next event",
    dateText: "Announcing soon",
    headline: "Beginner lesson, social dancing, and the Big Iron community.",
    description:
      "Add the next event’s date, venue, time, ticket price, and registration details here.",
    buttonText: "",
    buttonHref: "",
  },
  reds: {
    visible: true,
    eyebrow: "Performance team",
    titleLineOne: "Big Iron",
    titleLineTwo: "Reds.",
    headline: "The performance side of Big Iron Country Swing.",
    description:
      "Add team photos, member introductions, performance dates, and audition information here.",
    buttonText: "",
    buttonHref: "",
  },
  about: {
    visible: true,
    eyebrow: "About Big Iron",
    titleLineOne: "More than",
    titleLineTwo: "a dance.",
    description:
      "Big Iron Country Swing creates an approachable place for people to learn, dance, connect, and become part of a real community. Beginners are welcome, the audience comes first, and the dance floor belongs to everyone.",
    imageUrl: "",
  },
  footer: {
    copyright: "© 2026 Big Iron Country Swing",
    instagramUrl: "",
    contactEmail: "",
    showAdminLink: true,
  },
};

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringValue(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function booleanValue(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

export function normalizeSiteContent(value: unknown): SiteContent {
  const root = objectValue(value);
  const brand = objectValue(root.brand);
  const hero = objectValue(root.hero);
  const explore = objectValue(root.explore);
  const event = objectValue(root.event);
  const reds = objectValue(root.reds);
  const about = objectValue(root.about);
  const footer = objectValue(root.footer);

  const rawDestinations = Array.isArray(root.destinations)
    ? root.destinations
    : defaultSiteContent.destinations;

  const destinations = defaultSiteContent.destinations.map((fallback, index) => {
    const item = objectValue(rawDestinations[index]);

    return {
      label: stringValue(item.label, fallback.label),
      title: stringValue(item.title, fallback.title),
      description: stringValue(item.description, fallback.description),
      href: stringValue(item.href, fallback.href),
      external: booleanValue(item.external, fallback.external),
      action: stringValue(item.action, fallback.action),
      number: stringValue(item.number, fallback.number),
      visible: booleanValue(item.visible, fallback.visible),
    };
  });

  return {
    brand: {
      topLine: stringValue(brand.topLine, defaultSiteContent.brand.topLine),
      bottomLine: stringValue(
        brand.bottomLine,
        defaultSiteContent.brand.bottomLine
      ),
      location: stringValue(brand.location, defaultSiteContent.brand.location),
    },
    shopUrl: stringValue(root.shopUrl, defaultSiteContent.shopUrl),
    hero: {
      lineOne: stringValue(hero.lineOne, defaultSiteContent.hero.lineOne),
      lineTwo: stringValue(hero.lineTwo, defaultSiteContent.hero.lineTwo),
      description: stringValue(
        hero.description,
        defaultSiteContent.hero.description
      ),
      primaryButtonText: stringValue(
        hero.primaryButtonText,
        defaultSiteContent.hero.primaryButtonText
      ),
      primaryButtonHref: stringValue(
        hero.primaryButtonHref,
        defaultSiteContent.hero.primaryButtonHref
      ),
      secondaryButtonText: stringValue(
        hero.secondaryButtonText,
        defaultSiteContent.hero.secondaryButtonText
      ),
      secondaryButtonHref: stringValue(
        hero.secondaryButtonHref,
        defaultSiteContent.hero.secondaryButtonHref
      ),
      sideEyebrow: stringValue(
        hero.sideEyebrow,
        defaultSiteContent.hero.sideEyebrow
      ),
      sideText: stringValue(hero.sideText, defaultSiteContent.hero.sideText),
      imageUrl: stringValue(hero.imageUrl, defaultSiteContent.hero.imageUrl),
    },
    explore: {
      visible: booleanValue(
        explore.visible,
        defaultSiteContent.explore.visible
      ),
      eyebrow: stringValue(
        explore.eyebrow,
        defaultSiteContent.explore.eyebrow
      ),
      titleLineOne: stringValue(
        explore.titleLineOne,
        defaultSiteContent.explore.titleLineOne
      ),
      titleLineTwo: stringValue(
        explore.titleLineTwo,
        defaultSiteContent.explore.titleLineTwo
      ),
      description: stringValue(
        explore.description,
        defaultSiteContent.explore.description
      ),
    },
    destinations,
    event: {
      visible: booleanValue(event.visible, defaultSiteContent.event.visible),
      eyebrow: stringValue(event.eyebrow, defaultSiteContent.event.eyebrow),
      titleLineOne: stringValue(
        event.titleLineOne,
        defaultSiteContent.event.titleLineOne
      ),
      titleLineTwo: stringValue(
        event.titleLineTwo,
        defaultSiteContent.event.titleLineTwo
      ),
      dateLabel: stringValue(
        event.dateLabel,
        defaultSiteContent.event.dateLabel
      ),
      dateText: stringValue(event.dateText, defaultSiteContent.event.dateText),
      headline: stringValue(event.headline, defaultSiteContent.event.headline),
      description: stringValue(
        event.description,
        defaultSiteContent.event.description
      ),
      buttonText: stringValue(
        event.buttonText,
        defaultSiteContent.event.buttonText
      ),
      buttonHref: stringValue(
        event.buttonHref,
        defaultSiteContent.event.buttonHref
      ),
    },
    reds: {
      visible: booleanValue(reds.visible, defaultSiteContent.reds.visible),
      eyebrow: stringValue(reds.eyebrow, defaultSiteContent.reds.eyebrow),
      titleLineOne: stringValue(
        reds.titleLineOne,
        defaultSiteContent.reds.titleLineOne
      ),
      titleLineTwo: stringValue(
        reds.titleLineTwo,
        defaultSiteContent.reds.titleLineTwo
      ),
      headline: stringValue(reds.headline, defaultSiteContent.reds.headline),
      description: stringValue(
        reds.description,
        defaultSiteContent.reds.description
      ),
      buttonText: stringValue(
        reds.buttonText,
        defaultSiteContent.reds.buttonText
      ),
      buttonHref: stringValue(
        reds.buttonHref,
        defaultSiteContent.reds.buttonHref
      ),
    },
    about: {
      visible: booleanValue(about.visible, defaultSiteContent.about.visible),
      eyebrow: stringValue(about.eyebrow, defaultSiteContent.about.eyebrow),
      titleLineOne: stringValue(
        about.titleLineOne,
        defaultSiteContent.about.titleLineOne
      ),
      titleLineTwo: stringValue(
        about.titleLineTwo,
        defaultSiteContent.about.titleLineTwo
      ),
      description: stringValue(
        about.description,
        defaultSiteContent.about.description
      ),
      imageUrl: stringValue(about.imageUrl, defaultSiteContent.about.imageUrl),
    },
    footer: {
      copyright: stringValue(
        footer.copyright,
        defaultSiteContent.footer.copyright
      ),
      instagramUrl: stringValue(
        footer.instagramUrl,
        defaultSiteContent.footer.instagramUrl
      ),
      contactEmail: stringValue(
        footer.contactEmail,
        defaultSiteContent.footer.contactEmail
      ),
      showAdminLink: booleanValue(
        footer.showAdminLink,
        defaultSiteContent.footer.showAdminLink
      ),
    },
  };
}
