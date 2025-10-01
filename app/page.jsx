"use client";

import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { Bell, CalendarClock, BotMessageSquare, Edit } from "lucide-react";
import HeroSectionOne from '@/components/hero-section-one.jsx';
import FeaturesSectionDemo from '@/components/features-section-demo-2.jsx';

// Main Landing Page Component
export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      {/* Header */}
     

      <main className="flex-1">
        {/* Hero Section */}
        <HeroSectionOne />

      


        {/* Features Section */}
        <section className="w-full py-0 md:py-24 lg:py-6">
          
          
          <FeaturesSectionDemo />
        </section>

      </main>

      {/* Footer */}
      <footer className="flex flex-col gap-2 sm:flex-row py-6 w-full shrink-0 items-center px-4 md:px-6 border-t">
        <p className="text-xs text-muted-foreground">&copy; 2025 <Link href="https://www.txlabz.com" className="text-xs hover:underline underline-offset-4" prefetch={false}>
            TxLabz Inc
          </Link> .  All rights reserved.</p>
        <nav className="sm:ml-auto flex gap-4 sm:gap-6">
          <Link href="#" className="text-xs hover:underline underline-offset-4" prefetch={false}>
            Terms of Service
          </Link>
          <Link href="#" className="text-xs hover:underline underline-offset-4" prefetch={false}>
            Privacy
          </Link>
        </nav>
      </footer>
    </div>
  );
}
