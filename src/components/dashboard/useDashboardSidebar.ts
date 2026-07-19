import { useState } from "react";

export function useDashboardSidebar() {
  const [expanded, setExpanded] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(min-width: 1024px)").matches : true,
  );

  return {
    expanded,
    collapsed: !expanded,
    toggle: () => setExpanded((value) => !value),
  };
}
