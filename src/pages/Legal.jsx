import React from "react";
import PublicNav from "../components/PublicNav";
import Footer from "../components/Footer";

function LegalPage({ title, intro, updated, sections }) {
    return (
        <div className="min-h-screen bg-[#050505] text-white">
            <PublicNav />
            <section className="max-w-4xl mx-auto px-6 lg:px-12 py-16 md:py-20">
                <h1 className="text-2xl sm:text-4xl md:text-3xl sm:text-5xl font-display font-semibold">{title}</h1>
                <p className="text-zinc-400 mt-4">{intro}</p>
                <p className="text-xs uppercase tracking-widest text-amber-400/80 mt-4">Last updated: {updated}</p>
                <div className="mt-10 space-y-8">
                    {sections.map((s, i) => (
                        <div key={i} className="glass p-6">
                            <h3 className="font-display text-lg font-semibold mb-2">{s.h}</h3>
                            <p className="text-sm text-zinc-400 leading-relaxed">{s.b}</p>
                            {s.items && (
                                <ul className="mt-4 space-y-2 text-sm text-zinc-400 leading-relaxed">
                                    {s.items.map((item, index) => <li key={index}>- {item}</li>)}
                                </ul>
                            )}
                        </div>
                    ))}
                </div>
            </section>
            <Footer />
        </div>
    );
}

export function Terms() {
    return <LegalPage title="Terms & Conditions" updated="June 12, 2026" intro="These terms explain how Eregon Marketing accounts, plans, rewards, deposits, and withdrawals are managed."
        sections={[
            { h: "Acceptance of terms", b: "By creating an account, signing in, submitting deposits, joining a plan, completing tasks, or requesting withdrawals, you agree to follow these terms and all platform rules shown inside your dashboard." },
            { h: "Account eligibility", b: "You must provide accurate registration information and keep your account credentials secure. You are responsible for activity performed from your account, including plan requests, wallet submissions, and withdrawal requests.", items: ["Do not share your password or one-time account access with another person.", "Notify support if you believe your account or wallet information has been compromised.", "We may pause access when account activity appears fraudulent, automated, abusive, or inconsistent with platform rules."] },
            { h: "Membership plans", b: "Plans provide platform benefits such as included spin attempts, priority withdrawal review, task boosts, badges, and referral commission benefits. Plan availability, pricing, perks, and duration may change over time and are shown before a user submits a plan deposit request.", items: ["A plan is not active until the related deposit proof is reviewed and approved by an authorized admin.", "Rejected or incomplete plan submissions do not activate plan benefits.", "Plan spin rewards are queued as spin tokens and credited only through the reward flow shown in the dashboard."] },
            { h: "Deposits and approvals", b: "Deposits and subscription payments are submitted with transaction details and proof screenshots. All deposits remain pending until reviewed. Approval updates the user balance and, when linked to a plan, activates the selected membership." },
            { h: "Withdrawals", b: "Withdrawal requests are reviewed against the account balance, pending withdrawals, locked balance, minimum withdrawal rules, plan processing time, and admin compliance review. Submission of a withdrawal request does not guarantee immediate payment." },
            { h: "Tasks and rewards", b: "Task rewards, referral commissions, bonuses, and spin rewards are recorded through platform workflows. Rewards may be adjusted, delayed, rejected, or reversed if they are linked to duplicate accounts, invalid activity, manipulation, or incomplete requirements." },
            { h: "Acceptable use", b: "Users may not misuse the platform, attempt to bypass review systems, submit false proofs, interfere with service availability, scrape private data, impersonate another person, or use the platform for unlawful activity." },
            { h: "Service availability", b: "We aim to keep Eregon Marketing available and accurate, but maintenance, third-party service issues, network interruptions, browser issues, or infrastructure incidents may affect access. We may update or suspend features when needed to protect users or platform data." },
            { h: "Limitation of liability", b: "To the fullest extent permitted by law, Eregon Marketing is provided for account, task, reward, and membership management without warranties of uninterrupted service or error-free operation. Users remain responsible for verifying wallet addresses, transaction details, and account actions before submission." },
            { h: "Changes to terms", b: "We may update these terms as the platform changes. Continued use after updates means you accept the revised terms. Material changes will be reflected by updating the date on this page." },
        ]} />;
}

export function Privacy() {
    return <LegalPage title="Privacy Policy" updated="June 12, 2026" intro="This policy explains what information Eregon Marketing collects, why it is used, and how account data is protected."
        sections={[
            { h: "Information we collect", b: "We collect the information needed to operate user accounts, plans, deposits, rewards, withdrawals, and support workflows.", items: ["Account details such as name, email address, registration code, referral code, role, and account status.", "Security data such as hashed passwords, session tokens, login state, and account activity timestamps.", "Wallet and transaction details submitted by users, including deposit proof images, transaction hashes, withdrawal addresses, selected coins, and requested amounts.", "Platform activity such as task submissions, reward records, plan status, spin tokens, notifications, admin decisions, and support messages."] },
            { h: "How we use information", b: "We use account data to authenticate users, display dashboards, review deposits and withdrawals, activate plans, calculate rewards, send notifications, prevent abuse, troubleshoot errors, and provide support." },
            { h: "Legal and safety purposes", b: "We may review, preserve, or disclose limited information if needed to investigate fraud, enforce platform rules, protect users, respond to lawful requests, or prevent misuse of the service." },
            { h: "Data sharing", b: "We do not sell personal information. Data may be processed by hosting, database, analytics, support, or infrastructure providers that help operate the platform. Admin users may access account and transaction information only for operational review and support." },
            { h: "Security practices", b: "Passwords are stored as hashes, authenticated requests use access tokens, and sensitive admin actions are restricted by role. No online service can guarantee perfect security, so users should use strong passwords and keep wallet details private." },
            { h: "Retention", b: "We keep account, transaction, reward, and audit records as long as needed to operate the platform, resolve disputes, enforce rules, meet legal obligations, and preserve financial history. Some records may remain after account closure where required for audit or security purposes." },
            { h: "User choices", b: "Users may update account details where the dashboard allows, contact support for account questions, and request review of inaccurate personal information. Some transaction and audit records cannot be deleted if they are required for platform integrity." },
            { h: "Cookies and local storage", b: "The app may use browser storage to keep users signed in and remember session information. Clearing browser storage may sign you out or reset local preferences." },
            { h: "Policy updates", b: "We may update this privacy policy as features, infrastructure, or legal requirements change. The latest version will be posted on this page with the updated date." },
        ]} />;
}
