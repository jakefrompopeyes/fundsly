import { WalletConnectionCard } from "@/components/wallet/WalletConnectionCard";

/**
 * Plain-language overview:
 * This is the landing page. It introduces Fundly in a lightweight way and places the
 * wallet connection card front and center so visitors can link their Solana wallet in seconds.
 */

export default function Home() {
  return (
    /**
     * The main hero section uses a gradient background and soft lighting to make Fundly feel
     * modern and trustworthy. Tailwind classes keep the styling readable even for non-developers.
     */
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-slate-900 via-slate-950 to-black px-6 py-16 text-white">
      <div className="absolute inset-x-0 top-0 h-64 bg-[radial-gradient(circle_at_top,_rgba(16,_185,_129,_0.35),_transparent_70%)] blur-3xl" aria-hidden />
      <div className="relative z-10 flex w-full max-w-4xl flex-col gap-12">
        <section className="flex flex-col gap-4">
          {/* Tagline strip that signals the product is in an alpha testing phase. */}
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-1 text-xs uppercase tracking-[0.3em] text-emerald-200">
            Fundly Alpha
          </span>
          <h1 className="text-4xl font-semibold leading-tight sm:text-5xl">
            Plug into the Fundly network and explore Solana-native startup launches.
          </h1>
          <p className="max-w-2xl text-base text-slate-300">
            This early preview focuses on secure wallet connectivity. Use the button below to connect, and we’ll keep you posted as investment flows and dashboards come online.
          </p>
        </section>

        <section>
          {/* Wallet connect module */}
          <WalletConnectionCard />
        </section>
      </div>
    </main>
  );
}
