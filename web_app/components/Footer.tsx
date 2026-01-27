import Link from "next/link";

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="md:ml-72 border-t border-white/10 bg-[#141414]">
      <div className="px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-[#b4b4b4]">
            {currentYear} ChessBlunders.org
          </p>
          <div className="flex items-center gap-6">
            <Link
              href="/privacy"
              className="text-sm text-[#b4b4b4] hover:text-[#f5f5f5] transition-colors"
            >
              Privacy
            </Link>
            <Link
              href="/terms"
              className="text-sm text-[#b4b4b4] hover:text-[#f5f5f5] transition-colors"
            >
              Terms
            </Link>
            <Link
              href="/feedback"
              className="text-sm text-[#b4b4b4] hover:text-[#f5f5f5] transition-colors"
            >
              Contact
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
