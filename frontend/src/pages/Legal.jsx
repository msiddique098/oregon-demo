import React from "react";
import PublicNav from "../components/PublicNav";
import Footer from "../components/Footer";

function LegalPage({ title, intro, sections }) {
    return (
        <div className="min-h-screen bg-[#050505] text-white">
            <PublicNav />
            <section className="max-w-4xl mx-auto px-6 lg:px-12 py-16 md:py-20">
                <h1 className="text-2xl sm:text-4xl md:text-3xl sm:text-5xl font-display font-semibold">{title}</h1>
                <p className="text-zinc-400 mt-4">{intro}</p>
                <div className="mt-10 space-y-8">
                    {sections.map((s, i) => (
                        <div key={i} className="glass p-6">
                            <h3 className="font-display text-lg font-semibold mb-2">{s.h}</h3>
                            <p className="text-sm text-zinc-400 leading-relaxed">{s.b}</p>
                        </div>
                    ))}
                </div>
            </section>
            <Footer />
        </div>
    );
}

export function Terms() {
    return <LegalPage title="Terms & Conditions" intro="By using Royal Crypto Rewards you accept these terms of service."
        sections={[
            { h: "Visual platform", b: "This platform showcases a luxury rewards experience. Balances and rewards are administratively curated and do not represent actual cryptocurrency holdings." },
            { h: "Account responsibility", b: "Keep your password secure. You are responsible for activity under your account." },
            { h: "Limitations of liability", b: "Royal Crypto provides this experience as-is for showcase purposes. We accept no liability for misuse." },
        ]} />;
}

export function Privacy() {
    return <LegalPage title="Privacy Policy" intro="Royal Crypto respects your privacy and uses minimal personal data."
        sections={[
            { h: "Information we collect", b: "We store only the email, name and hashed password you provide on signup." },
            { h: "How we use it", b: "Strictly for authentication, account management and concierge support." },
            { h: "Security", b: "All passwords are vaulted via bcrypt. Sessions are protected with JWT tokens." },
        ]} />;
}
