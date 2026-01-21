"use client";

export default function SkipLink() {
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const main = document.querySelector("main");
    if (main) {
      main.tabIndex = -1;
      main.focus();
      main.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <a
      href="#main-content"
      className="skip-link"
      onClick={handleClick}
    >
      Skip to main content
    </a>
  );
}
