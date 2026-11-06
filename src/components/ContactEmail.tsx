import React from 'react';

/**
 * hello@kayawealth.app, lightly hidden from scrapers.
 * The address never appears as plain text in the page's HTML: it's assembled from parts in the
 * browser, and the mailto: link is only built when someone clicks. Basic email-harvesting bots
 * (which read raw HTML) won't find it; people see and click it normally.
 */
const PARTS = ['hello', 'kayawealth', 'app']; // user, domain, tld

export const ContactEmail: React.FC<{ className?: string; style?: React.CSSProperties }> = ({ className = '', style }) => {
  const address = `${PARTS[0]}@${PARTS[1]}.${PARTS[2]}`;
  return (
    <a
      href="#contact"
      className={className}
      style={style}
      onClick={(e) => { e.preventDefault(); window.location.href = 'mailto:' + address; }}
    >
      {PARTS[0]}<span aria-hidden="true">@</span>{PARTS[1]}.{PARTS[2]}
    </a>
  );
};

export default ContactEmail;
