"use client";

import { motion } from "framer-motion";
import { Calendar, ArrowRight } from "lucide-react";
import { GlowingEffect } from "@/components/ui/glowing-effect";

interface ExternalMediaCardProps {
  title: string;
  excerpt: string;
  source: string;
  date: string;
  url: string;
  index: number;
}

export default function ExternalMediaCard({
  title,
  excerpt,
  source,
  date,
  url,
  index,
}: ExternalMediaCardProps) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <motion.article
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: index * 0.1 }}
      className="group"
    >
      <a href={url} target="_blank" rel="noopener noreferrer">
        <div
          className="backdrop-blur-2xl rounded-3xl p-6 shadow-2xl border cursor-pointer hover:scale-105 transition-all duration-300 h-full"
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

          <div className="space-y-4">
            <h3 className="text-xl font-bold text-[var(--dark-blue)] line-clamp-2 group-hover:text-[var(--accent-blue)] transition-colors">
              {title}
            </h3>

            <p className="text-[var(--dark-blue)]/70 line-clamp-3 text-sm">
              {excerpt}
            </p>

            <div className="flex items-center justify-between text-sm text-[var(--dark-blue)]/60">
              <div className="flex items-center gap-2">
                <span>{source}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                <span>{formatDate(date)}</span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4">
              <span className="text-[var(--accent-blue)] font-medium text-sm group-hover:underline">
                Watch Now
              </span>
              <ArrowRight className="w-4 h-4 text-[var(--accent-blue)] group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </div>
      </a>
    </motion.article>
  );
}
