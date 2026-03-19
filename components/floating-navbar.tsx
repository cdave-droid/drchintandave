"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Youtube, Linkedin, Instagram } from "lucide-react";

export const FloatingNavbar: React.FC = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY;
      setIsScrolled(scrollTop > 50);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ease-in-out ${
        isScrolled
          ? "bg-[var(--bg-card)]/90 backdrop-blur-md shadow-lg mx-4 mt-4 rounded-full border border-[var(--border-light)]"
          : "bg-[var(--bg-card)]/70 backdrop-blur-sm border-b border-[var(--border-medium)]"
      }`}
    >
      <div
        className={`max-w-7xl mx-auto transition-all duration-300 ${
          isScrolled ? "px-6 py-3" : "px-8 py-4"
        }`}
      >
        <div className="flex items-center justify-between">
          {/* Logo/Name */}
          <div
            className={`text-[var(--dark-blue)] font-helvetica transition-all duration-300 ${
              isScrolled ? "text-lg" : "text-xl"
            }`}
          >
            <a href="/">
              <Image src="/logo.png" alt="Logo" width={100} height={100} />
            </a>
          </div>

          {/* Desktop Navigation Links */}
          <div className="hidden md:flex items-center transition-all duration-300 space-x-6">
            <a
              href="/credentials"
              className={`transition-all duration-300 text-md font-bold relative group ${
                pathname === "/credentials"
                  ? "text-[var(--dark-blue)]"
                  : "text-[var(--text-medium)] hover:text-[var(--dark-blue)]"
              }`}
            >
              <span className="relative">
                Credentials
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-[var(--accent-blue)] transition-all duration-300 group-hover:w-full rounded-full"></span>
                {pathname === "/credentials" && (
                  <div className="absolute -bottom-1 left-0 w-full h-0.5 bg-[var(--accent-blue)] rounded-full" />
                )}
              </span>
            </a>
            {/* <a
              href="/consulting"
              className={`transition-all duration-300 text-md font-medium relative group ${
                pathname === "/consulting"
                  ? "text-[var(--dark-blue)]"
                  : "text-[var(--text-medium)] hover:text-[var(--dark-blue)]"
              }`}
            >
              <span className="relative">
                Consulting
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-[var(--accent-blue)] transition-all duration-300 group-hover:w-full rounded-full"></span>
              </span>
              {pathname === "/consulting" && (
                <div className="absolute -bottom-1 left-0 right-0 h-0.5 bg-[var(--accent-blue)] rounded-full" />
              )}
            </a> */}
            <a
              href="/being-human"
              className={`transition-all duration-300 text-md font-bold relative group ${
                pathname === "/being-human"
                  ? "text-[var(--dark-blue)]"
                  : "text-[var(--text-medium)] hover:text-[var(--dark-blue)]"
              }`}
            >
              <span className="relative">
                Being Human
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-[var(--accent-blue)] transition-all duration-300 group-hover:w-full rounded-full"></span>
                {pathname === "/being-human" && (
                  <div className="absolute -bottom-1 left-0 w-full h-0.5 bg-[var(--accent-blue)] rounded-full" />
                )}
              </span>
            </a>
            <a
              href="/media"
              className={`transition-all duration-300 text-md font-bold relative group ${
                pathname === "/media"
                  ? "text-[var(--dark-blue)]"
                  : "text-[var(--text-medium)] hover:text-[var(--dark-blue)]"
              }`}
            >
              <span className="relative">
                Media
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-[var(--accent-blue)] transition-all duration-300 group-hover:w-full rounded-full"></span>
                {pathname === "/media" && (
                  <div className="absolute -bottom-1 left-0 w-full h-0.5 bg-[var(--accent-blue)] rounded-full" />
                )}
              </span>
            </a>
            <a
              href="/clinical/mortality"
              className={`transition-all duration-300 text-md font-bold relative group ${
                pathname === "/clinical/mortality"
                  ? "text-[var(--dark-blue)]"
                  : "text-[var(--text-medium)] hover:text-[var(--dark-blue)]"
              }`}
            >
              <span className="relative">
                Clinical Tools
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-[var(--accent-blue)] transition-all duration-300 group-hover:w-full rounded-full"></span>
                {pathname === "/clinical/mortality" && (
                  <div className="absolute -bottom-1 left-0 w-full h-0.5 bg-[var(--accent-blue)] rounded-full" />
                )}
              </span>
            </a>

            {/* Social Media Icons */}
            <div className="flex items-center space-x-3 ml-6">
              <a
                href="https://www.youtube.com/channel/UCOr_i3qB_jevK88DbSSRuKA"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--text-medium)] hover:text-[#FF0000] transition-colors duration-300"
              >
                <Youtube size={20} />
              </a>
              <a
                href="https://www.linkedin.com/in/drchintandave/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--text-medium)] hover:text-[#0077B5] transition-colors duration-300"
              >
                <Linkedin size={20} />
              </a>
              <a
                href="https://www.tiktok.com/@drchintandave"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--text-medium)] hover:text-black transition-colors duration-300"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.5V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
                </svg>
              </a>
              <a
                href="https://www.instagram.com/drchintandave/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--text-medium)] hover:text-[#E4405F] transition-colors duration-300"
              >
                <Instagram size={20} />
              </a>
            </div>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden text-[var(--dark-blue)] p-2"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              {isMobileMenuOpen ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      <div
        className={`md:hidden absolute top-full left-0 right-0 bg-[#f8f5f0] border-t border-gray-200 transition-all duration-300 ease-in-out shadow-lg ${
          isMobileMenuOpen
            ? "max-h-96 opacity-100 py-4"
            : "max-h-0 opacity-0 py-0 overflow-hidden"
        }`}
      >
        <div className="flex flex-col space-y-4 px-8">
          <a
            href="/credentials"
            className={`transition-all duration-300 text-sm font-medium relative group ${
              pathname === "/credentials"
                ? "text-[var(--dark-blue)]"
                : "text-[var(--text-medium)] hover:text-[var(--dark-blue)]"
            }`}
          >
            <span className="relative">
              Credentials
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-[var(--accent-blue)] transition-all duration-300 group-hover:w-full rounded-full"></span>
              {pathname === "/credentials" && (
                <div className="absolute -bottom-1 left-0 w-full h-0.5 bg-[var(--accent-blue)] rounded-full" />
              )}
            </span>
          </a>
          {/* <a
            href="/consulting"
            className={`transition-all duration-300 text-sm font-medium relative group ${
              pathname === "/consulting"
                ? "text-[var(--dark-blue)]"
                : "text-[var(--text-medium)] hover:text-[var(--dark-blue)]"
            }`}
          >
            <span className="relative">
              Consulting
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-[var(--accent-blue)] transition-all duration-300 group-hover:w-full rounded-full"></span>
            </span>
            {pathname === "/consulting" && (
              <div className="absolute -bottom-1 left-0 right-0 h-0.5 bg-[var(--accent-blue)] rounded-full" />
            )}
          </a> */}
          <a
            href="/being-human"
            className={`transition-all duration-300 text-sm font-medium relative group ${
              pathname === "/being-human"
                ? "text-[var(--dark-blue)]"
                : "text-[var(--text-medium)] hover:text-[var(--dark-blue)]"
            }`}
          >
            <span className="relative">
              Being Human
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-[var(--accent-blue)] transition-all duration-300 group-hover:w-full rounded-full"></span>
              {pathname === "/being-human" && (
                <div className="absolute -bottom-1 left-0 w-full h-0.5 bg-[var(--accent-blue)] rounded-full" />
              )}
            </span>
          </a>
          <a
            href="/media"
            className={`transition-all duration-300 text-sm font-medium relative group ${
              pathname === "/media"
                ? "text-[var(--dark-blue)]"
                : "text-[var(--text-medium)] hover:text-[var(--dark-blue)]"
            }`}
          >
            <span className="relative">
              Media
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-[var(--accent-blue)] transition-all duration-300 group-hover:w-full rounded-full"></span>
              {pathname === "/media" && (
                <div className="absolute -bottom-1 left-0 w-full h-0.5 bg-[var(--accent-blue)] rounded-full" />
              )}
            </span>
          </a>
          <a
            href="/clinical/mortality"
            className={`transition-all duration-300 text-sm font-medium relative group ${
              pathname === "/clinical/mortality"
                ? "text-[var(--dark-blue)]"
                : "text-[var(--text-medium)] hover:text-[var(--dark-blue)]"
            }`}
          >
            <span className="relative">
              Clinical Tools
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-[var(--accent-blue)] transition-all duration-300 group-hover:w-full rounded-full"></span>
              {pathname === "/clinical/mortality" && (
                <div className="absolute -bottom-1 left-0 w-full h-0.5 bg-[var(--accent-blue)] rounded-full" />
              )}
            </span>
          </a>

          {/* Mobile Social Media Icons */}
          <div className="flex items-center justify-center space-x-6 pt-4 border-t border-gray-200">
            <a
              href="https://www.youtube.com/channel/UCOr_i3qB_jevK88DbSSRuKA"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--text-medium)] hover:text-[#FF0000] transition-colors duration-300"
            >
              <Youtube size={24} />
            </a>
            <a
              href="https://www.linkedin.com/in/drchintandave/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--text-medium)] hover:text-[#0077B5] transition-colors duration-300"
            >
              <Linkedin size={24} />
            </a>
            <a
              href="https://www.tiktok.com/@drchintandave"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--text-medium)] hover:text-black transition-colors duration-300"
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.5V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
              </svg>
            </a>
            <a
              href="https://www.instagram.com/drchintandave/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--text-medium)] hover:text-[#E4405F] transition-colors duration-300"
            >
              <Instagram size={24} />
            </a>
          </div>
        </div>
      </div>
    </nav>
  );
};
