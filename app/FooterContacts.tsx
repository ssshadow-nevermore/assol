"use client";

import { useEffect, useRef, useState } from "react";

type FooterContactsProps = {
  maxUrl: string;
  maxPhone: string;
  emailUrl: string;
  vkUrl: string;
  extraLinks?: Array<{ label: string; url: string; openInNewTab: boolean }>;
};

export default function FooterContacts({ maxUrl, maxPhone, emailUrl, vkUrl, extraLinks = [] }: FooterContactsProps) {
  const [notice, setNotice] = useState("");
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  async function copyMaxPhone() {
    try {
      await navigator.clipboard.writeText(maxPhone);
      setNotice("Номер скопирован — найдите салон по номеру");
    } catch {
      setNotice(`Найдите салон в MAX по номеру ${maxPhone}`);
    }

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setNotice(""), 5000);
  }

  return (
    <div className="footer-contacts-wrap">
      <div className="footer-contacts">
        <a href={maxUrl} target="_blank" rel="noreferrer" onClick={copyMaxPhone}>MAX</a>
        <a href={emailUrl}>Почта</a>
        <a href={vkUrl} target="_blank" rel="noreferrer">ВКонтакте</a>
        {extraLinks.map((link) => <a key={`${link.label}-${link.url}`} href={link.url} target={link.openInNewTab ? "_blank" : undefined} rel={link.openInNewTab ? "noreferrer" : undefined}>{link.label}</a>)}
      </div>
      <span className={`footer-notice${notice ? " is-visible" : ""}`} role="status">{notice}</span>
    </div>
  );
}
