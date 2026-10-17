"use client";

import { Fragment, type ReactNode } from "react";
import { IconBrandGithubFilled } from "@tabler/icons-react";

import { SITE_LINKS } from "@/lib/site";

const linkClass =
  "transition-colors hover:text-neutral-600 dark:hover:text-neutral-300";

function Dot() {
  return (
    <span aria-hidden className="text-neutral-300 dark:text-neutral-700">
      ·
    </span>
  );
}

function ExternalLink({
  href,
  label,
  children,
}: {
  href: string;
  /** For icon-only links, which have no text of their own. */
  label?: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={label}
      title={label}
      className={`flex items-center ${linkClass}`}
    >
      {children}
    </a>
  );
}

/* The quiet line under the home composer: where the chats live, where the
   interface comes from (Whirl, MIT-licensed), and the source. */
export function HomeFooter() {
  const items: ReactNode[] = [
    <span key="local">Runs on your device</span>,
    <ExternalLink key="upstream" href={SITE_LINKS.upstream}>
      Built on Whirl
    </ExternalLink>,
    <ExternalLink key="repo" href={SITE_LINKS.repo} label="Source code on GitHub">
      <IconBrandGithubFilled size={13} />
    </ExternalLink>,
  ];

  return (
    <footer className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-center gap-2.5 px-2 py-3 text-[11px] text-neutral-400 dark:text-neutral-500">
      {items.map((item, index) => (
        <Fragment key={index}>
          {index > 0 && <Dot />}
          {item}
        </Fragment>
      ))}
    </footer>
  );
}
