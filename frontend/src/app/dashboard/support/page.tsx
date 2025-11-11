"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";

/**
 * Plain-language overview:
 * Support page where users can report bugs, errors, issues, or feature requests.
 * The form collects relevant information and submits it to the backend API.
 */
export default function SupportPage() {
  const { publicKey, connected } = useWallet();
  
  const [formData, setFormData] = useState({
    type: "bug",
    subject: "",
    description: "",
    severity: "medium",
    pageUrl: "",
    stepsToReproduce: "",
    expectedBehavior: "",
    actualBehavior: "",
    email: "",
  });

  const [submitting, setSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<{
    type: "success" | "error" | null;
    message: string;
  }>({ type: null, message: "" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitStatus({ type: null, message: "" });

    try {
      const response = await fetch("/api/support", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...formData,
          userWallet: connected && publicKey ? publicKey.toBase58() : null,
          pageUrl: formData.pageUrl || (typeof window !== "undefined" ? window.location.href : ""),
          browserInfo: typeof navigator !== "undefined" 
            ? `${navigator.userAgent} - ${navigator.platform}` 
            : null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to submit support ticket");
      }

      setSubmitStatus({
        type: "success",
        message: "Thank you! Your support ticket has been submitted successfully. We'll review it and get back to you soon.",
      });

      // Reset form
      setFormData({
        type: "bug",
        subject: "",
        description: "",
        severity: "medium",
        pageUrl: "",
        stepsToReproduce: "",
        expectedBehavior: "",
        actualBehavior: "",
        email: "",
      });
    } catch (error: any) {
      setSubmitStatus({
        type: "error",
        message: error.message || "Something went wrong. Please try again later.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  return (
    <div className="space-y-6">
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20">
        <h1 className="text-3xl font-bold text-white mb-2">
          Support & Bug Reports 🐛
        </h1>
        <p className="text-slate-300">
          Found a bug or have a question? Let us know! We're here to help improve your experience.
        </p>
      </div>

      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Type Selection */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-white">
              Type of Issue *
            </label>
            <select
              name="type"
              value={formData.type}
              onChange={handleChange}
              required
              className="rounded-md border border-white/20 bg-slate-800/70 px-3 py-2 text-white outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/50"
            >
              <option value="bug">🐛 Bug</option>
              <option value="error">❌ Error</option>
              <option value="issue">⚠️ Issue</option>
              <option value="feature_request">💡 Feature Request</option>
              <option value="other">📝 Other</option>
            </select>
          </div>

          {/* Subject */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-white">
              Subject *
            </label>
            <input
              type="text"
              name="subject"
              value={formData.subject}
              onChange={handleChange}
              required
              placeholder="Brief description of the issue"
              className="rounded-md border border-white/20 bg-slate-800/70 px-3 py-2 text-white placeholder-slate-400 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/50"
            />
          </div>

          {/* Description */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-white">
              Description *
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              required
              rows={5}
              placeholder="Please provide a detailed description of the issue..."
              className="rounded-md border border-white/20 bg-slate-800/70 px-3 py-2 text-white placeholder-slate-400 outline-none resize-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/50"
            />
          </div>

          {/* Severity */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-white">
              Severity
            </label>
            <select
              name="severity"
              value={formData.severity}
              onChange={handleChange}
              className="rounded-md border border-white/20 bg-slate-800/70 px-3 py-2 text-white outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/50"
            >
              <option value="low">Low - Minor inconvenience</option>
              <option value="medium">Medium - Affects functionality</option>
              <option value="high">High - Major feature broken</option>
              <option value="critical">Critical - System unusable</option>
            </select>
          </div>

          {/* Page URL */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-white">
              Page URL (if applicable)
            </label>
            <input
              type="url"
              name="pageUrl"
              value={formData.pageUrl}
              onChange={handleChange}
              placeholder="https://fundly.site/..."
              className="rounded-md border border-white/20 bg-slate-800/70 px-3 py-2 text-white placeholder-slate-400 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/50"
            />
          </div>

          {/* Steps to Reproduce */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-white">
              Steps to Reproduce (if applicable)
            </label>
            <textarea
              name="stepsToReproduce"
              value={formData.stepsToReproduce}
              onChange={handleChange}
              rows={3}
              placeholder="1. Go to...&#10;2. Click on...&#10;3. See error..."
              className="rounded-md border border-white/20 bg-slate-800/70 px-3 py-2 text-white placeholder-slate-400 outline-none resize-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/50"
            />
          </div>

          {/* Expected vs Actual Behavior */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-white">
                Expected Behavior
              </label>
              <textarea
                name="expectedBehavior"
                value={formData.expectedBehavior}
                onChange={handleChange}
                rows={3}
                placeholder="What should have happened?"
                className="rounded-md border border-white/20 bg-slate-800/70 px-3 py-2 text-white placeholder-slate-400 outline-none resize-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/50"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-white">
                Actual Behavior
              </label>
              <textarea
                name="actualBehavior"
                value={formData.actualBehavior}
                onChange={handleChange}
                rows={3}
                placeholder="What actually happened?"
                className="rounded-md border border-white/20 bg-slate-800/70 px-3 py-2 text-white placeholder-slate-400 outline-none resize-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/50"
              />
            </div>
          </div>

          {/* Email (Optional) */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-white">
              Email (Optional - for follow-up)
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="your.email@example.com"
              className="rounded-md border border-white/20 bg-slate-800/70 px-3 py-2 text-white placeholder-slate-400 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/50"
            />
          </div>

          {/* Wallet Info Display */}
          {connected && publicKey && (
            <div className="bg-slate-800/50 rounded-lg p-3 text-sm text-slate-300">
              <span className="font-semibold">Connected Wallet:</span> {publicKey.toBase58().slice(0, 8)}...{publicKey.toBase58().slice(-8)}
            </div>
          )}

          {/* Submit Status */}
          {submitStatus.type && (
            <div
              className={`rounded-lg p-4 ${
                submitStatus.type === "success"
                  ? "bg-emerald-500/20 border border-emerald-500/50 text-emerald-200"
                  : "bg-red-500/20 border border-red-500/50 text-red-200"
              }`}
            >
              {submitStatus.message}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-3 font-semibold text-white transition-all hover:from-purple-500 hover:to-pink-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "Submitting..." : "Submit Support Ticket"}
          </button>
        </form>
      </div>
    </div>
  );
}

