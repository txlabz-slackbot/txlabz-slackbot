"use client";

import { useEffect } from "react";

export default function Providers({ children }) {
  useEffect(() => {
    console.log("Providers mounted");
  }, []);

  return children;
}