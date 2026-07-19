import { Link, type LinkProps } from "react-router-dom";
import type { ReactNode } from "react";
import { saveHomeScrollOnLeave } from "../lib/homeScrollRestore";

type HomeLeavingLinkProps = LinkProps & {
  children: ReactNode;
};

export default function HomeLeavingLink({ onClick, to, ...props }: HomeLeavingLinkProps) {
  return (
    <Link
      to={to}
      {...props}
      onClick={(event) => {
        saveHomeScrollOnLeave();
        onClick?.(event);
      }}
    />
  );
}
