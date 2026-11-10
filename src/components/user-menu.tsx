"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { logoutAction } from "@/server/auth-actions";
import type { User } from "@/server/auth";

type Theme = "light" | "dark";

interface UserMenuProps {
  readonly user: User;
}

const THEME_EVENT = "aula-theme-change";

function subscribeTheme(onChange: () => void): () => void {
  window.addEventListener(THEME_EVENT, onChange);
  return () => window.removeEventListener(THEME_EVENT, onChange);
}

function readTheme(): Theme {
  return document.documentElement.dataset["theme"] === "dark" ? "dark" : "light";
}

export function UserMenu({ user }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const theme = useSyncExternalStore(subscribeTheme, readTheme, () => "light" as Theme);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    function onPointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function toggleTheme() {
    const next: Theme = readTheme() === "dark" ? "light" : "dark";
    document.documentElement.dataset["theme"] = next;

    try {
      localStorage.setItem("aula-theme", next);
    } catch {
      // Sin almacenamiento el tema dura lo que la sesión; no es crítico.
    }

    window.dispatchEvent(new Event(THEME_EVENT));
  }

  const initial = user.name.trim().charAt(0).toUpperCase();

  return (
    <div className="user-menu" ref={containerRef}>
      <button
        type="button"
        className="user-menu__trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="user-menu__avatar" aria-hidden="true">
          {initial}
        </span>
        {user.name}
      </button>

      {open ? (
        <div className="user-menu__panel" role="menu">
          <div className="user-menu__head">
            <strong>{user.name}</strong>
            <span>
              @{user.username}
              {user.role === "admin" ? " · Administradora" : ""}
            </span>
          </div>

          <Link
            href="/cuenta"
            className="user-menu__item"
            role="menuitem"
            onClick={() => setOpen(false)}
          >
            Ajustes de la cuenta
          </Link>

          <button
            type="button"
            className="user-menu__item"
            role="menuitemcheckbox"
            aria-checked={theme === "dark"}
            onClick={toggleTheme}
          >
            Modo oscuro
            <span className="switch" data-on={theme === "dark"} aria-hidden="true" />
          </button>

          <form action={logoutAction}>
            <button type="submit" className="user-menu__item" role="menuitem">
              Cerrar sesión
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
