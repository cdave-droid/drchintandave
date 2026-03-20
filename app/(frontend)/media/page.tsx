import { getPayload } from "payload";
import config from "../../../payload.config";
import { WavyBackground } from "@/components/ui/wavy-background";
import { FloatingNavbar } from "@/components/floating-navbar";
import { Footer } from "@/components/footer";
import { Calendar, User, Tag, ArrowRight } from "lucide-react";
import Link from "next/link";
import BlogCard from "./blog-card";
import ExternalMediaCard from "./external-media-card";
import ShinyText from "@/components/ui/shiny-text";
import { Metadata } from "next";

// Disable caching for this page
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function MediaPage() {
  let posts: any[] = [];

  try {
    const payload = await getPayload({
      config,
    });

    const postsResponse = await payload.find({
      collection: "blogs",
      where: {
        status: {
          equals: "published",
        },
      },
      sort: "-publishedDate",
    });

    posts = postsResponse.docs;
  } catch (error) {
    console.error("Error fetching posts:", error);
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

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
            <span className="text-[var(--accent-blue)]">Media</span>
          </nav>
        </div>
      </section>

      {/* Header */}
      <section className="relative z-10 pb-12 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-8 leading-tight">
              <ShinyText text="Media" speed={5} className="block" />
            </h1>
          </div>
        </div>
      </section>

      {/* Blog Posts */}
      <section className="relative z-10 pb-20 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {posts.map((post, index) => (
                <BlogCard key={post.id} post={post} index={index} />
              ))}
              <ExternalMediaCard
                title="Is AI Transforming the Future of Healthcare?"
                excerpt="Dr. Chintan Dave joins Al Jazeera's The Stream to discuss how artificial intelligence is reshaping healthcare and what it means for the future of medicine."
                source="Al Jazeera - The Stream"
                date="2025-08-01"
                url="https://www.aljazeera.com/video/the-stream/2025/8/1/is-ai-transforming-the-future-of"
                image="/al_jazeera_stream.png"
                imageAlt="Dr. Chintan Dave on Al Jazeera's The Stream discussing AI in healthcare"
                index={posts.length}
              />
            </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
