import type { AnchorHTMLAttributes } from "react";
import { hrefFor } from "../router";

/** Stand-in for next/link in the preview build: app paths become #hashes. */
export default function Link({ href, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  return <a href={hrefFor(href)} {...rest} />;
}
