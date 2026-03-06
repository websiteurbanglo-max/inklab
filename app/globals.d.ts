/// <reference types="react" />

declare module "*.css";

// ─── Polaris Web Components + App Bridge Web Components ──────────────────────
// Full custom-element type declarations for use in React JSX.
declare namespace JSX {
  interface IntrinsicElements {
    // ── App Bridge ────────────────────────────────────────────────────────────
    /** s-app-nav — embedded navigation menu (replaces NavMenu from app-bridge-react) */
    "s-app-nav": React.HTMLAttributes<HTMLElement>;
    /** s-link — navigates via App Bridge without full page reload */
    "s-link": React.HTMLAttributes<HTMLElement> & {
      href?: string;
      rel?: string;
      target?: string;
    };
    /** s-title-bar — embedded app title bar */
    "s-title-bar": React.HTMLAttributes<HTMLElement> & { title?: string };

    // ── Structure ─────────────────────────────────────────────────────────────
    /** s-page — top-level page container (replaces Polaris Page) */
    "s-page": React.HTMLAttributes<HTMLElement> & {
      heading?: string;
      "inline-size"?: "small" | "base" | "large";
    };
    /** s-section — card-like grouping; level-1 = card style, nested = flat */
    "s-section": React.HTMLAttributes<HTMLElement> & {
      heading?: string;
      padding?: "base" | "none";
    };

    // ── Layout & Structure ────────────────────────────────────────────────────
    /** s-stack — flex container; direction=block (default) or inline */
    "s-stack": React.HTMLAttributes<HTMLElement> & {
      direction?: "block" | "inline";
      gap?: string;
      wrap?: string;
      "align-items"?: string;
      "justify-content"?: string;
      padding?: string;
    };
    /** s-grid — CSS grid container */
    "s-grid": React.HTMLAttributes<HTMLElement> & {
      columns?: string;
      gap?: string;
    };
    /** s-box — generic flex/block container with styling props */
    "s-box": React.HTMLAttributes<HTMLElement> & {
      padding?: string;
      background?: string;
      "border-radius"?: string;
    };
    /** s-divider — horizontal rule separator */
    "s-divider": React.HTMLAttributes<HTMLElement>;

    // ── Typography & Content ──────────────────────────────────────────────────
    /** s-heading — hierarchical heading element */
    "s-heading": React.HTMLAttributes<HTMLElement> & { variant?: string };
    /** s-paragraph — block of text */
    "s-paragraph": React.HTMLAttributes<HTMLElement> & { tone?: string };
    /** s-text — inline text with optional tone/variant */
    "s-text": React.HTMLAttributes<HTMLElement> & {
      variant?: string;
      tone?: string;
      "font-weight"?: string;
    };

    // ── Feedback & Status ─────────────────────────────────────────────────────
    /** s-banner — informational / warning / critical / success banner */
    "s-banner": React.HTMLAttributes<HTMLElement> & {
      tone?: "info" | "success" | "warning" | "critical";
    };
    /** s-badge — small status label */
    "s-badge": React.HTMLAttributes<HTMLElement> & {
      tone?: "info" | "success" | "warning" | "critical" | "enabled" | "attention";
    };
    /** s-spinner — loading indicator */
    "s-spinner": React.HTMLAttributes<HTMLElement> & { size?: string };

    // ── Actions ───────────────────────────────────────────────────────────────
    /** s-button — interactive button (replaces Polaris Button) */
    "s-button": React.HTMLAttributes<HTMLElement> & {
      variant?: "primary" | "secondary" | "plain" | "critical";
      url?: string;
      target?: string;
      disabled?: boolean;
      type?: "button" | "submit" | "reset";
      tone?: string;
      size?: string;
      slot?: string;
    };
    /** s-button-group — groups multiple buttons */
    "s-button-group": React.HTMLAttributes<HTMLElement>;

    // ── Forms ─────────────────────────────────────────────────────────────────
    /** s-text-field — single-line text input */
    "s-text-field": React.HTMLAttributes<HTMLElement> & {
      label?: string;
      value?: string;
      placeholder?: string;
      type?: string;
      "auto-complete"?: string;
      error?: string;
    };
    /** s-select — dropdown select */
    "s-select": React.HTMLAttributes<HTMLElement> & {
      label?: string;
      value?: string;
    };
    /** s-checkbox — checkbox input */
    "s-checkbox": React.HTMLAttributes<HTMLElement> & {
      label?: string;
      checked?: boolean;
    };
    /** s-drop-zone — file upload drop zone */
    "s-drop-zone": React.HTMLAttributes<HTMLElement> & {
      accept?: string;
      label?: string;
    };

    // ── Media & Visuals ───────────────────────────────────────────────────────
    /** s-thumbnail — small preview image */
    "s-thumbnail": React.HTMLAttributes<HTMLElement> & {
      source?: string;
      alt?: string;
      size?: "small" | "medium" | "large";
    };
    /** s-image — responsive image component */
    "s-image": React.HTMLAttributes<HTMLElement> & {
      source?: string;
      alt?: string;
    };
    /** s-icon — Polaris icon */
    "s-icon": React.HTMLAttributes<HTMLElement> & { source?: string };

    // ── Overlays ──────────────────────────────────────────────────────────────
    /** s-modal — dialog overlay (replaces Polaris Modal) */
    "s-modal": React.HTMLAttributes<HTMLElement> & {
      open?: boolean;
      heading?: string;
    };
    /** s-popover — floating popover */
    "s-popover": React.HTMLAttributes<HTMLElement> & { open?: boolean };

    // ── Data ──────────────────────────────────────────────────────────────────
    /** s-table — data table (replaces Polaris DataTable) */
    "s-table": React.HTMLAttributes<HTMLElement>;
  }
}
