import React, { useEffect } from 'react';
import { ContactEmail } from './ContactEmail';
import { openCookieSettings } from '../services/consent';

/** Public privacy policy at /privacy (landing page style). Plain language; review before launch. */
const UPDATED = 'November 5, 2026';

const H: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h2 className="text-[20px] sm:text-[22px] font-semibold text-white mt-12 mb-3">{children}</h2>
);
const P: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="text-[15px] leading-[1.7] mb-3" style={{ color: '#9fb3a6' }}>{children}</p>
);
const Li: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <li className="text-[15px] leading-[1.7] pl-1" style={{ color: '#9fb3a6' }}>{children}</li>
);
const B: React.FC<{ children: React.ReactNode }> = ({ children }) => <span className="text-white font-medium">{children}</span>;

export const PrivacyPage: React.FC = () => {
  useEffect(() => { document.title = 'Privacy Policy · Kaya'; window.scrollTo(0, 0); }, []);
  return (
    <div className="min-h-[100dvh] bg-black text-white">
      <header className="max-w-3xl mx-auto px-6 h-16 flex items-center justify-between">
        <a href="/" className="flex items-center gap-3">
          <img src="/logo-icon.svg" alt="" className="w-6 h-6" draggable={false} />
          <span className="text-[16px] font-bold uppercase tracking-[4px] text-white">Kaya</span>
        </a>
        <a href="/" className="text-[14px] font-medium text-[#dcf5df] hover:text-white transition-colors">Back to home</a>
      </header>

      <main className="max-w-3xl mx-auto px-6 pt-12 pb-24">
        <h1 className="kaya-grad-text text-[44px] sm:text-[64px] font-semibold leading-[0.9] tracking-[-0.038em]">Privacy Policy</h1>
        <p className="text-[13px] mt-4" style={{ color: '#6e8777' }}>Last updated {UPDATED}</p>

        <P><span className="block mt-8" />Kaya is a manual net worth tracker. It never connects to your bank, and we don't sell your data or show ads. This page explains, in plain language, what we collect and what you can do about it.</P>

        <H>Who we are</H>
        <P>Kaya ("we", "us") is an independent app made in Canada and available at kayawealth.app. For anything privacy-related, email <ContactEmail className="text-[#dcf5df] underline underline-offset-2 hover:text-white" />.</P>

        <H>What we collect</H>
        <ul className="list-disc pl-5 space-y-1.5 mb-3">
          <Li><B>Your email address</B>, to sign you in and contact you about your account.</Li>
          <Li><B>What you enter</B>: account names, balances, currencies, income records and settings, including an optional display name.</Li>
          <Li><B>Your email preferences</B>: whether you agreed to marketing emails, when, where and the exact wording you saw.</Li>
          <Li><B>Analytics, only if you accept cookies</B>: pages visited and general device information, through Google Analytics.</Li>
          <Li><B>Basic technical logs</B> kept by our hosting providers to run and secure the service.</Li>
        </ul>
        <P>We never ask for bank logins, card numbers or government IDs.</P>

        <H>How we use it, and why</H>
        <ul className="list-disc pl-5 space-y-1.5 mb-3">
          <Li>To run your account and sync your data across devices (needed to provide the service).</Li>
          <Li>To send important account and product update emails (our legitimate interest in keeping you informed about the app you use).</Li>
          <Li>To send tips, news and offers, only if you opted in (your consent).</Li>
          <Li>To understand how the site is used, only if you accepted analytics cookies (your consent).</Li>
          <Li>To keep the service secure and prevent abuse (legitimate interest).</Li>
        </ul>

        <H>Emails</H>
        <P>We email everyone with an account about important account matters and product updates. We send marketing emails (tips, news and offers) <B>only to people who opt in</B>, either when signing up, through a one-time prompt in the app, or in Settings. Emails are sent using <B>Brevo</B>, our email provider. You can unsubscribe from any email using the link at the bottom, or anytime in the app under <B>Settings → Email preferences</B>.</P>

        <H>Cookies and local storage</H>
        <P>Kaya stores a copy of your data on your device so the app works offline, and remembers simple settings like your theme. That's essential to the app and isn't used for tracking. Analytics cookies from Google Analytics are set <B>only after you click Accept</B> in the cookie banner. You can change your choice anytime: <button onClick={openCookieSettings} className="text-[#dcf5df] underline underline-offset-2 hover:text-white">Cookie settings</button>.</P>

        <H>Services we use</H>
        <ul className="list-disc pl-5 space-y-1.5 mb-3">
          <Li><B>Supabase</B>: secure sign-in and account data storage.</Li>
          <Li><B>Vercel</B>: hosting for the website and app.</Li>
          <Li><B>Brevo</B>: sending emails.</Li>
          <Li><B>Google Analytics</B>: usage statistics, only with your consent.</Li>
        </ul>
        <P>These providers process data on our behalf and may store it outside your country, including in the United States, under their own data protection terms.</P>

        <H>How long we keep it</H>
        <P>We keep your account data for as long as you have an account. If you ask us to delete your account, we delete your data from our systems, except for records we must keep by law (such as proof of email consent). Google Analytics data is kept for up to 14 months.</P>

        <H>Your rights</H>
        <P>Wherever you live, you can:</P>
        <ul className="list-disc pl-5 space-y-1.5 mb-3">
          <Li><B>See and export</B> your data (use Settings → Backup in the app, or email us).</Li>
          <Li><B>Correct</B> your data, which you can do directly in the app.</Li>
          <Li><B>Delete</B> your data (Settings → Clear all data) or your whole account (email us).</Li>
          <Li><B>Withdraw consent</B> for emails or analytics at any time.</Li>
          <Li><B>Complain</B> to your privacy regulator, such as the Office of the Privacy Commissioner of Canada or your local EU data protection authority.</Li>
        </ul>

        <H>Security</H>
        <P>Your data is kept private to your account, so no other user can read it. It's encrypted in transit and at rest. You can also add a PIN and Face ID lock in the app.</P>

        <H>Changes</H>
        <P>If we make meaningful changes to this policy, we'll update the date above and let account holders know by email.</P>

        <H>Contact</H>
        <P>Questions or requests: <ContactEmail className="text-[#dcf5df] underline underline-offset-2 hover:text-white" />.</P>
      </main>
    </div>
  );
};

export default PrivacyPage;
