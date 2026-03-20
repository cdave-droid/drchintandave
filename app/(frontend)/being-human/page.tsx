"use client";

import React from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import {
  BookOpen,
  ArrowRight,
} from "lucide-react";
import { WavyBackground } from "@/components/ui/wavy-background";
import { FloatingNavbar } from "@/components/floating-navbar";
import { Footer } from "@/components/footer";
import { GlowingEffect } from "@/components/ui/glowing-effect";
import ShinyText from "@/components/ui/shiny-text";

export default function BeingHumanPage() {
  return (
    <main className="relative min-h-screen">
      <FloatingNavbar />

      <WavyBackground
        className="fixed inset-0 z-0"
        colors={["#3182ce", "#38b2ac", "#3182ce", "#38b2ac"]}
        speed="slow"
        waveOpacity={0.3}
        blur={7}
      />

      {/* Breadcrumb */}
      <section className="relative z-10 pt-32 pb-8 px-4">
        <div className="max-w-6xl mx-auto">
          <nav className="text-sm text-[var(--dark-blue)]/70 mb-4">
            <span>Home</span>
            <span className="mx-2">/</span>
            <span className="text-[var(--accent-blue)]">
              Being Human in the Age of AI: Co-Creating a Better Future
            </span>
          </nav>
        </div>
      </section>

      {/* Hero Section */}
      <section className="relative z-10 pb-8 px-4">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center mb-16"
          >
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-8 leading-tight">
              <ShinyText
                text="Being Human in the Age of AI"
                speed={5}
                className="block"
              />
            </h1>
            <h2
              className="text-2xl sm:text-3xl font-semibold text-[var(--accent-blue)] mb-6"
              style={{
                textShadow: `0 0 1px var(--dark-blue),
                        0 0 20px #ffffff`,
              }}
            >
              Consciously Creating a Better World
            </h2>
            <div className="flex items-center justify-center space-x-4 text-[var(--dark-blue)]/70">
              <BookOpen className="w-5 h-5" />
              <span>By Chintan Dave, MD</span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Book Description Section */}

      <section className="relative z-10 pb-20 px-4">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="backdrop-blur-2xl rounded-3xl p-8 sm:p-12 shadow-2xl border"
            style={{
              background: "rgba(255, 255, 255, 0.15)",
              borderColor: "rgba(255, 255, 255, 0.2)",
              boxShadow: `
                0 8px 32px rgba(0, 0, 0, 0.1),
                inset 0 1px 0 rgba(255, 255, 255, 0.1)
              `,
            }}
          >
            <GlowingEffect
              spread={60}
              glow={true}
              disabled={false}
              proximity={64}
              inactiveZone={0.01}
              borderWidth={2}
              variant="default"
            />
            <h2 className="text-3xl font-bold text-[var(--dark-blue)] mb-8 text-center">
              What does the future of humanity look like?
            </h2>

            <div className="space-y-6 text-[var(--dark-blue)]/90 leading-relaxed text-lg">
              <p>
                Artificial Intelligence (AI) isn&apos;t coming. It&apos;s
                already here. As AI systems outperform humans at logic,
                prediction, and labor, the question is no longer &quot;What can
                AI do?&quot; but &quot;What are humans for?&quot;
              </p>

              <p>
                This book provides thought-provoking questions and practical
                answers. Dr. Chintan Dave, a dual-board certified ICU physician
                and AI founder, writes from the front lines of life-and-death
                medicine and real-world AI deployment. He tackles the hard
                realities head-on: If AI runs our labs, hospitals, and
                economies, how do people keep purpose, power, and dignity? What
                if AI&apos;s goals drift from humanity&apos;s collective goals?
                Could it become conscious? How would we know when we can&apos;t
                even agree on a definition for consciousness?
              </p>

              <p>This book offers four distinct ideas:</p>

              <ul className="space-y-4 ml-6">
                <li className="flex items-start space-x-3">
                  <span className="text-[var(--accent-blue)] font-bold">•</span>
                  <span>
                    A moral rule for AI development: assume AI could be
                    conscious and apply the Golden Rule of religions to what we
                    build.
                  </span>
                </li>
                <li className="flex items-start space-x-3">
                  <span className="text-[var(--accent-blue)] font-bold">•</span>
                  <span>
                    A roadmap for the next stage of human evolution: conscious
                    selection; not natural selection.
                  </span>
                </li>
                <li className="flex items-start space-x-3">
                  <span className="text-[var(--accent-blue)] font-bold">•</span>
                  <span>
                    A unified, testable theory of consciousness that bridges
                    neuroscience, quantum theories, and ancient spiritual
                    wisdom.
                  </span>
                </li>
                <li className="flex items-start space-x-3">
                  <span className="text-[var(--accent-blue)] font-bold">•</span>
                  <span>
                    A radical approach to building an Artificial
                    Superintelligence (ASI) that prioritizes human values of
                    love, freedom, and dignity over raw speed and performance.
                  </span>
                </li>
              </ul>

              <p>
                You&apos;ll learn how to measure what truly matters, why early
                signs of AI consciousness will likely be missed, how we can
                prevent becoming obsolete, and how to design systems that scale
                compassion alongside computation. Dr. Dave maps a path beyond
                fear and asserts an unapologetically hopeful message: with
                values-based governance and conscious growth, both of ourselves
                and our systems, the next millennia can be radically more
                peaceful and prosperous.
              </p>

              <p>
                Urgent, actionable, and deeply human, the book is a field guide
                for anyone who refuses to be made obsolete- and chooses,
                instead, to evolve.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Book Preview Card */}
      <section className="relative z-10 pb-20 px-4">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="backdrop-blur-2xl rounded-3xl p-8 sm:p-12 shadow-2xl border max-w-4xl mx-auto"
            style={{
              background: "rgba(255, 255, 255, 0.15)",
              borderColor: "rgba(255, 255, 255, 0.2)",
              boxShadow: `
                0 8px 32px rgba(0, 0, 0, 0.1),
                inset 0 1px 0 rgba(255, 255, 255, 0.1)
              `,
            }}
          >
            <GlowingEffect
              spread={40}
              glow={true}
              disabled={false}
              proximity={64}
              inactiveZone={0.01}
              borderWidth={2}
              variant="default"
            />
            <div className="grid lg:grid-cols-2 gap-8 items-center">
              {/* Book Cover Placeholder */}
              <div className="text-center">
                <div className="w-52 h-72 mx-auto p-3 bg-transparent rounded-lg shadow-2xl transition-all duration-500 ease-out hover:scale-105 hover:shadow-3xl">
                  <div className="w-full h-full overflow-hidden rounded-lg transition-transform duration-500">
                    <Image
                      src="/book_cover_2.jpeg"
                      alt="Being Human in the Age of AI - Book Cover"
                      width={256}
                      height={288}
                      className="w-full h-full"
                    />
                  </div>
                </div>
              </div>

              {/* Order Details */}
              <div className="space-y-6">
                <motion.a
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  href="https://www.amazon.com/Being-Human-Age-AI-Consciously/dp/B0FXR7JFJV"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-4 bg-gradient-to-r from-[var(--dark-blue)] to-[var(--dark-blue-light)] hover:from-[var(--dark-blue-light)] hover:to-[var(--dark-blue)] text-white font-semibold rounded-full transition-all duration-300 shadow-lg hover:shadow-xl flex items-center justify-center space-x-2"
                >
                  <BookOpen className="w-5 h-5" />
                  <span>Order Now</span>
                  <ArrowRight className="w-5 h-5" />
                </motion.a>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
