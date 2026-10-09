// Stand-in for next/link in the single-file preview.
import type { AnchorHTMLAttributes, MouseEvent } from 'react';
import { navigate } from './navigation';

type Props = AnchorHTMLAttributes<HTMLAnchorElement> & { href: string };

export default function Link({ href, onClick, children, ...rest }: Props) {
  return (
    <a
      {...rest}
      href={'#' + href.replace(/^\//, '')}
      onClick={(e: MouseEvent<HTMLAnchorElement>) => {
        onClick?.(e);
        if (e.defaultPrevented) return;
        e.preventDefault();
        navigate(href);
      }}
    >
      {children}
    </a>
  );
}
