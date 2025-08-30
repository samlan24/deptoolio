"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Button } from "../components/ui/button";
import { Menu, X } from "lucide-react";

const Navigation = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const closeMenu = () => {
    setIsMenuOpen(false);
  };

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        closeMenu();
      }
    };

    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMenuOpen]);

  return (
    <div ref={menuRef}>
      <nav className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-md border-b border-border/50">
        <div className="container mx-auto px-6">
          <div className="flex items-center justify-center h-16">
            {/* Centered Navigation - Desktop */}
            <div className="hidden md:flex items-center space-x-8">
              {/* Logo */}
              <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                <span className="text-xl font-bold text-foreground">pacgie</span>
              </Link>

              {/* Navigation Links */}
              <Link
                href="/#features"
                className="text-muted-foreground hover:text-foreground transition-colors text-sm font-medium"
              >
                Features
              </Link>
              <Link
                href="/#pricing"
                className="text-muted-foreground hover:text-foreground transition-colors text-sm font-medium"
              >
                Pricing
              </Link>

              {/* CTA Buttons */}
              <Link href="/checks">
                <Button className="btn-hero text-sm px-6">
                  Get Started Free
                </Button>
              </Link>
              <Link href="/login">
                <Button variant="outline" className="btn-outline-hero text-sm px-6">
                  Sign In
                </Button>
              </Link>
            </div>

            {/* Mobile Layout */}
            <div className="md:hidden flex items-center justify-between w-full">
              {/* Mobile Logo - Far Left */}
              <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                <span className="text-xl font-bold text-foreground">pacgie</span>
              </Link>

              {/* Mobile Menu Button - Far Right */}
              <button
                onClick={toggleMenu}
                className="p-2 text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Toggle menu"
              >
                {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>

          {/* Mobile Menu */}
          {isMenuOpen && (
            <div className="md:hidden py-4 border-t border-border/50 bg-background/95 backdrop-blur-md">
              <div className="flex flex-col space-y-4">
                <Link
                  href="/#features"
                  className="text-muted-foreground hover:text-foreground transition-colors text-sm font-medium py-2"
                  onClick={closeMenu}
                >
                  Features
                </Link>
                <Link
                  href="/#pricing"
                  className="text-muted-foreground hover:text-foreground transition-colors text-sm font-medium py-2"
                  onClick={closeMenu}
                >
                  Pricing
                </Link>
                <div className="pt-4 border-t border-border/50 space-y-3">
                  <Link href="/checks" className="block" onClick={closeMenu}>
                    <Button className="btn-hero w-full text-sm">
                      Get Started Free
                    </Button>
                  </Link>
                  <Link href="/signin" className="block" onClick={closeMenu}>
                    <Button variant="outline" className="btn-outline-hero w-full text-sm">
                      Sign In
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
      </nav>
    </div>
  );
};

export default Navigation;
