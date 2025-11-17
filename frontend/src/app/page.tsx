"use client";

import { motion } from "framer-motion";
import {
  Shield,
  TrendingUp,
  Lock,
  ArrowRight,
  Check,
  Zap,
  Users,
  BarChart3,
  Clock,
  Unlock,
} from "lucide-react";
import Link from "next/link";

/**
 * Fundly Landing Page
 * 
 * This is the main landing page that explains our anti-rugpull features,
 * vesting system, and DEX migration to both creators and investors.
 */

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      {/* Hero Section */}
      <HeroSection />

      {/* Trust Indicators */}
      <TrustSection />

      {/* How It Works */}
      <HowItWorksSection />

      {/* Features for Creators and Investors */}
      <FeaturesSection />

      {/* Anti-Rugpull Guarantees */}
      <AntiRugpullSection />

      {/* CTA Section */}
      <CTASection />

      {/* Footer */}
      <Footer />
    </div>
  );
}

function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden px-6">
      {/* Animated background gradient orbs */}
      <motion.div
        className="absolute top-20 left-10 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl"
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.3, 0.5, 0.3],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
      <motion.div
        className="absolute bottom-20 right-10 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl"
        animate={{
          scale: [1.2, 1, 1.2],
          opacity: [0.3, 0.5, 0.3],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 1,
        }}
      />

      <div className="relative z-10 max-w-6xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <h1 className="text-6xl md:text-8xl font-bold mb-6 bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent">
            Launch Your Own
            <br />
            Initial Coin Offering
          </h1>
        </motion.div>

        <motion.p
          className="text-xl md:text-2xl text-slate-300 mb-8 max-w-3xl mx-auto"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          The first Solana token launcher with{" "}
          <span className="text-purple-400 font-semibold">mandatory vesting</span> and{" "}
          <span className="text-blue-400 font-semibold">automatic DEX migration</span>.
          <br />
          No rugpulls. No scams. Just transparent coin offerings.
        </motion.p>

        <motion.div
          className="flex flex-col sm:flex-row gap-4 justify-center items-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
        >
          <Link href="/dashboard">
            <motion.button
              className="px-8 py-4 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full text-white font-semibold text-lg flex items-center gap-2 hover:shadow-2xl hover:shadow-purple-500/50 transition-all"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Launch Your Coin
              <ArrowRight className="w-5 h-5" />
            </motion.button>
          </Link>

          <Link href="#how-it-works">
            <motion.button
              className="px-8 py-4 border-2 border-slate-600 rounded-full text-white font-semibold text-lg hover:border-purple-500 transition-all"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Learn How It Works
            </motion.button>
          </Link>
        </motion.div>

        {/* Stats */}
        <motion.div
          className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
        >
          <StatCard number="0" label="Rugpulls Possible" />
          <StatCard number="100%" label="Funds Protected" />
          <StatCard number="Auto" label="DEX Migration" />
        </motion.div>
      </div>
    </section>
  );
}

function StatCard({ number, label }: { number: string; label: string }) {
  return (
    <motion.div
      className="bg-slate-800/50 backdrop-blur-lg rounded-2xl p-6 border border-slate-700"
      whileHover={{ scale: 1.05, borderColor: "#a855f7" }}
    >
      <div className="text-4xl font-bold text-purple-400 mb-2">{number}</div>
      <div className="text-slate-400">{label}</div>
    </motion.div>
  );
}

function TrustSection() {
  const trustFeatures = [
    { icon: Shield, text: "On-Chain Verification" },
    { icon: Lock, text: "Locked & Burned Liquidity" },
    { icon: Clock, text: "Time-Locked Vesting" },
    { icon: Zap, text: "Instant Settlement" },
  ];

  return (
    <section className="py-20 px-6">
      <motion.div
        className="max-w-6xl mx-auto"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8 }}
      >
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-white mb-4">
            Built on Trust, Powered by Solana
          </h2>
          <p className="text-slate-400 text-lg">
            Every transaction is verified on-chain, ensuring complete transparency
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {trustFeatures.map((feature, index) => (
            <motion.div
              key={index}
              className="bg-slate-800/30 backdrop-blur-sm rounded-xl p-6 border border-slate-700 text-center"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              whileHover={{ scale: 1.05, borderColor: "#a855f7" }}
            >
              <feature.icon className="w-10 h-10 mx-auto mb-3 text-purple-400" />
              <p className="text-white font-medium">{feature.text}</p>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </section>
  );
}

function HowItWorksSection() {
  const steps = [
    {
      number: "01",
      title: "Create Your Token",
      description:
        "Launch your token with a bonding curve. Set your parameters and let the market decide the price.",
      icon: Zap,
      color: "from-purple-500 to-pink-500",
    },
    {
      number: "02",
      title: "Automatic Vesting",
      description:
        "Creator tokens are automatically locked with a vesting schedule. No way to dump, no way to rugpull.",
      icon: Lock,
      color: "from-pink-500 to-blue-500",
    },
    {
      number: "03",
      title: "Community Trading",
      description:
        "Investors trade on the bonding curve. As more people buy, the price increases algorithmically.",
      icon: TrendingUp,
      color: "from-blue-500 to-purple-500",
    },
    {
      number: "04",
      title: "Auto-Migration to DEX",
      description:
        "When market cap threshold is hit, funds automatically migrate to Raydium DEX for permanent liquidity.",
      icon: Unlock,
      color: "from-purple-500 to-pink-500",
    },
  ];

  return (
    <section id="how-it-works" className="py-32 px-6 bg-slate-900/50">
      <div className="max-w-6xl mx-auto">
        <motion.div
          className="text-center mb-20"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2 className="text-5xl font-bold text-white mb-6">
            How Fundly Protects Everyone
          </h2>
          <p className="text-xl text-slate-400 max-w-3xl mx-auto">
            Our four-step process ensures creators can&apos;t rugpull and investors can trade with confidence
          </p>
        </motion.div>

        <div className="space-y-32">
          {steps.map((step, index) => (
            <motion.div
              key={index}
              className={`flex flex-col ${
                index % 2 === 0 ? "md:flex-row" : "md:flex-row-reverse"
              } items-center gap-12`}
              initial={{ opacity: 0, x: index % 2 === 0 ? -50 : 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
            >
              {/* Icon and Number */}
              <div className="flex-1 flex justify-center">
                <motion.div
                  className={`relative w-64 h-64 rounded-3xl bg-gradient-to-br ${step.color} p-1`}
                  whileHover={{ scale: 1.05, rotate: 5 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="w-full h-full bg-slate-900 rounded-3xl flex flex-col items-center justify-center">
                    <step.icon className="w-20 h-20 text-white mb-4" />
                    <span className="text-6xl font-bold text-white/20">
                      {step.number}
                    </span>
                  </div>
                </motion.div>
              </div>

              {/* Content */}
              <div className="flex-1 space-y-4">
                <div
                  className={`inline-block px-4 py-2 rounded-full bg-gradient-to-r ${step.color} text-white font-semibold`}
                >
                  Step {step.number}
                </div>
                <h3 className="text-4xl font-bold text-white">{step.title}</h3>
                <p className="text-xl text-slate-400 leading-relaxed">
                  {step.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FeaturesSection() {
  const creatorFeatures = [
    "Launch tokens with no upfront costs",
    "Automatic bonding curve pricing",
    "Build credibility with mandatory vesting",
    "Auto-migrate to Raydium at market cap threshold",
  ];

  const investorFeatures = [
    "Protected from rugpulls and scams",
    "Transparent on-chain vesting schedules",
    "Fair price discovery via bonding curve",
    "Automatic DEX liquidity at graduation",
  ];

  return (
    <section className="py-32 px-6">
      <div className="max-w-6xl mx-auto">
        <motion.div
          className="text-center mb-20"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2 className="text-5xl font-bold text-white mb-6">
            Built for Creators & Investors
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-12">
          {/* For Creators */}
          <motion.div
            className="bg-gradient-to-br from-purple-900/20 to-pink-900/20 backdrop-blur-lg rounded-3xl p-10 border border-purple-500/20"
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            whileHover={{ scale: 1.02 }}
          >
            <Users className="w-16 h-16 text-purple-400 mb-6" />
            <h3 className="text-3xl font-bold text-white mb-6">For Creators</h3>
            <ul className="space-y-4">
              {creatorFeatures.map((feature, index) => (
                <motion.li
                  key={index}
                  className="flex items-start gap-3 text-slate-300"
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Check className="w-6 h-6 text-purple-400 flex-shrink-0 mt-0.5" />
                  <span className="text-lg">{feature}</span>
                </motion.li>
              ))}
            </ul>
          </motion.div>

          {/* For Investors */}
          <motion.div
            className="bg-gradient-to-br from-blue-900/20 to-purple-900/20 backdrop-blur-lg rounded-3xl p-10 border border-blue-500/20"
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            whileHover={{ scale: 1.02 }}
          >
            <BarChart3 className="w-16 h-16 text-blue-400 mb-6" />
            <h3 className="text-3xl font-bold text-white mb-6">For Investors</h3>
            <ul className="space-y-4">
              {investorFeatures.map((feature, index) => (
                <motion.li
                  key={index}
                  className="flex items-start gap-3 text-slate-300"
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Check className="w-6 h-6 text-blue-400 flex-shrink-0 mt-0.5" />
                  <span className="text-lg">{feature}</span>
                </motion.li>
              ))}
            </ul>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function AntiRugpullSection() {
  const guarantees = [
    {
      icon: Shield,
      title: "Smart Contract Enforced",
      description:
        "Vesting is built into the smart contract. Creators physically cannot access locked tokens until the vesting schedule allows.",
    },
    {
      icon: Lock,
      title: "Time-Locked Funds",
      description:
        "Creator allocations are locked with cliff and vesting periods. Tokens unlock gradually over months, not instantly.",
    },
    {
      icon: TrendingUp,
      title: "Bonding Curve Protection",
      description:
        "All trades go through a mathematical bonding curve. No sudden dumps possible - price adjusts algorithmically.",
    },
    {
      icon: Unlock,
      title: "Automatic DEX Migration",
      description:
        "When threshold is hit, liquidity automatically migrates to Raydium DEX. Permanent liquidity, no rug possible.",
    },
  ];

  return (
    <section className="py-32 px-6 bg-slate-900/50 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-gradient-to-b from-purple-500/5 to-transparent" />

      <div className="max-w-6xl mx-auto relative">
        <motion.div
          className="text-center mb-20"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <div className="inline-flex items-center gap-3 px-6 py-3 bg-green-500/10 border border-green-500/30 rounded-full mb-6">
            <Shield className="w-6 h-6 text-green-400" />
            <span className="text-green-400 font-semibold text-lg">
              Rugpull-Proof Guarantee
            </span>
          </div>
          <h2 className="text-5xl font-bold text-white mb-6">
            Why Rugpulls Are Impossible on Fundsly
          </h2>
          <p className="text-xl text-slate-400 max-w-3xl mx-auto">
            Our multi-layered security system makes it technically impossible for creators to rugpull
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-8">
          {guarantees.map((guarantee, index) => (
            <motion.div
              key={index}
              className="bg-slate-800/30 backdrop-blur-lg rounded-2xl p-8 border border-slate-700"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ scale: 1.03, borderColor: "#a855f7" }}
            >
              <guarantee.icon className="w-12 h-12 text-purple-400 mb-4" />
              <h3 className="text-2xl font-bold text-white mb-3">
                {guarantee.title}
              </h3>
              <p className="text-slate-400 text-lg leading-relaxed">
                {guarantee.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CTASection() {
  return (
    <section className="py-32 px-6">
      <motion.div
        className="max-w-4xl mx-auto text-center"
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
      >
        <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-3xl p-12 relative overflow-hidden">
          {/* Animated background */}
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-purple-400/20 to-blue-400/20"
            animate={{
              opacity: [0.3, 0.6, 0.3],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />

          <div className="relative z-10">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
              Ready to Launch Your Initial Coin Offering?
            </h2>
            <p className="text-xl text-white/90 mb-8">
              Join the new standard of trust in ICO launches
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/dashboard">
                <motion.button
                  className="px-10 py-4 bg-white text-purple-600 rounded-full font-bold text-lg flex items-center gap-2 justify-center hover:shadow-2xl transition-all"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Get Started Now
                  <ArrowRight className="w-5 h-5" />
                </motion.button>
              </Link>

              <Link href="#how-it-works">
                <motion.button
                  className="px-10 py-4 bg-white/10 backdrop-blur-lg text-white rounded-full font-bold text-lg border-2 border-white/20 hover:border-white/40 transition-all"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Learn More
                </motion.button>
              </Link>
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="py-12 px-6 border-t border-slate-800">
      <div className="max-w-6xl mx-auto text-center text-slate-400">
        <p className="text-lg mb-4">
          <span className="font-bold text-white">Fundsly</span> - The Rugpull-Proof ICO Launcher
        </p>
        <p className="text-sm">
          Built on Solana. Secured by smart contracts. Trusted by the community.
        </p>
      </div>
    </footer>
  );
}
